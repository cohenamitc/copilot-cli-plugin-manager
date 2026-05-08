const { app, BrowserWindow, Menu, Tray, nativeImage, utilityProcess } = require("electron");
const path = require("path");
const http = require("http");

// Prevent multiple instances — critical to avoid fork-bomb when packaged
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let tray = null;
let serverProcess = null;
const serverPort = 3200;

function createWindow() {
  const appIcon = nativeImage.createFromPath(
    path.join(__dirname, "..", "..", "public", "logo.png")
  );

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Copilot Plugin Manager",
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Reload once after a short delay to catch late server starts
  mainWindow.webContents.on("did-fail-load", () => {
    setTimeout(() => mainWindow.loadURL(`http://localhost:${serverPort}`), 1000);
  });

  mainWindow.on("close", (event) => {
    if (tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const logoPath = path.join(__dirname, "..", "..", "public", "favicon-32.png");
  const icon = nativeImage.createFromPath(logoPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Plugin Manager",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        if (tray) { tray.destroy(); tray = null; }
        if (serverProcess) { serverProcess.kill(); }
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Copilot Plugin Manager");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// Wait until the server is actually responding
function waitForServer(port, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(`http://localhost:${port}/api/settings`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error("Server timeout"));
        } else {
          setTimeout(check, 500);
        }
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error("Server timeout"));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

function startBackendServer() {
  const serverScript = app.isPackaged
    ? path.join(process.resourcesPath, "dist", "server", "index.js")
    : path.join(__dirname, "..", "..", "dist", "server", "index.js");

  // utilityProcess.fork() uses Electron's built-in Node.js runtime,
  // avoiding the infinite-loop bug where process.execPath re-launches the app.
  serverProcess = utilityProcess.fork(serverScript, [], {
    env: { ...process.env, PORT: String(serverPort) },
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (data) => {
    console.log("[server]", data.toString().trim());
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[server]", data.toString().trim());
  });

  serverProcess.on("exit", (code) => {
    console.log("Server exited with code:", code);
    serverProcess = null;
    // Auto-restart unless we're quitting
    if (!app.isQuitting) {
      setTimeout(() => startBackendServer(), 2000);
    }
  });
}

app.isQuitting = false;

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  startBackendServer();

  try {
    await waitForServer(serverPort);
    console.log("Server is ready");
  } catch (err) {
    console.error("Server failed to start:", err.message);
  }

  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    app.isQuitting = true;
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess) serverProcess.kill();
  if (tray) { tray.destroy(); tray = null; }
});
