import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "net";
import pluginRoutes from "./routes/plugins.js";
import marketplaceRoutes from "./routes/marketplaces.js";
import settingsRoutes from "./routes/settings.js";

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(express.json());

// API routes
app.use("/api/plugins", pluginRoutes);
app.use("/api/marketplaces", marketplaceRoutes);
app.use("/api/settings", settingsRoutes);

// Global error handler for async route errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Express error:", err.message);
  res.status(500).json({ error: err.message });
});

// Serve React SPA — use dist/client for built assets
const projectRoot = path.resolve(__dirname, "..", "..");
const clientDistDir = path.join(projectRoot, "dist", "client");
app.use(express.static(clientDistDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistDir, "index.html"));
});

// Find a free port
async function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, "127.0.0.1", () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", () => {
      // Preferred port busy, find a random free one
      const server2 = createServer();
      server2.listen(0, "127.0.0.1", () => {
        const port = (server2.address() as { port: number }).port;
        server2.close(() => resolve(port));
      });
    });
  });
}

export async function startServer(preferredPort = 3200): Promise<number> {
  const port = await findFreePort(preferredPort);
  return new Promise((resolve) => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`🔌 Plugin Manager running at http://localhost:${port}`);
      // Notify parent process (Electron main) of the actual port
      const parentPort = (process as unknown as { parentPort?: { postMessage: (msg: unknown) => void } }).parentPort;
      if (parentPort) {
        parentPort.postMessage({ type: "server-port", port });
      }
      resolve(port);
    });
  });
}

// Auto-start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3200;
startServer(PORT);
