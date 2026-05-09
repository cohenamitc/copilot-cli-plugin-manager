import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";
import type {
  InstalledPluginEntry,
  PluginDetails,
  MarketplaceInfo,
  MarketplacePlugin,
} from "../types.js";

// Mock fs/promises for settings tests
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readFile: (...args: any[]) => mockReadFile(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    mkdir: (...args: any[]) => mockMkdir(...args),
  };
});

// Mock os.homedir to return a stable test path
vi.mock("os", async () => {
  const actual = await vi.importActual("os");
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      homedir: () => "/mock-home",
    },
    homedir: () => "/mock-home",
  };
});

// Mock service modules before importing routes
vi.mock("../services/plugin-reader.js", () => ({
  getInstalledPlugins: vi.fn(),
  getPluginDetails: vi.fn(),
}));

vi.mock("../services/cli-executor.js", () => ({
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
  updatePlugin: vi.fn(),
}));

vi.mock("../services/marketplace-ops.js", () => ({
  addMarketplace: vi.fn(),
  removeMarketplace: vi.fn(),
  refreshMarketplaces: vi.fn(),
}));

vi.mock("../services/marketplace-reader.js", () => ({
  getMarketplaces: vi.fn(),
  getMarketplacePlugins: vi.fn(),
  browseAllMarketplaces: vi.fn(),
}));

vi.mock("../services/disabled-registry.js", () => ({
  getDisabledPlugins: vi.fn().mockResolvedValue([]),
  addDisabledPlugin: vi.fn().mockResolvedValue(undefined),
  removeDisabledPlugin: vi.fn().mockResolvedValue(undefined),
  isDisabled: vi.fn().mockResolvedValue(false),
  getDisabledPlugin: vi.fn().mockResolvedValue(null),
}));

// Import mocked services
import {
  getInstalledPlugins,
  getPluginDetails,
} from "../services/plugin-reader.js";
import {
  installPlugin,
  uninstallPlugin,
  updatePlugin,
} from "../services/cli-executor.js";
import {
  addMarketplace,
  removeMarketplace,
  refreshMarketplaces,
} from "../services/marketplace-ops.js";
import {
  getMarketplaces,
  getMarketplacePlugins,
  browseAllMarketplaces,
} from "../services/marketplace-reader.js";
import {
  getDisabledPlugins,
  addDisabledPlugin,
  removeDisabledPlugin,
  getDisabledPlugin,
} from "../services/disabled-registry.js";

// Import routes after mocking
import pluginRoutes from "./plugins.js";
import marketplaceRoutes from "./marketplaces.js";
import settingsRoutes from "./settings.js";

// Helper to create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/plugins", pluginRoutes);
  app.use("/api/marketplaces", marketplaceRoutes);
  app.use("/api/settings", settingsRoutes);
  return app;
}

describe("API Routes Integration Tests", () => {
  let app: express.Application;

  beforeEach(async () => {
    app = createTestApp();
    vi.clearAllMocks();
    
    // Default fs mock behavior - file not found (returns default settings)
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  describe("Plugin Routes", () => {
    describe("GET /api/plugins", () => {
      it("returns list of installed plugins", async () => {
        const mockEntry: InstalledPluginEntry = {
          name: "test-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          cache_path: "/path/to/cache",
        };

        const mockDetails: PluginDetails = {
          name: "test-plugin",
          version: "1.0.0",
          description: "Test plugin",
          author: { name: "Test Author" },
          keywords: ["test"],
          category: "utility",
          marketplace: "copilot-plugins",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          skills: [{ name: "skill1", path: "/skills/skill1" }],
          agents: [],
          hooks: [],
          mcpServers: [],
        };

        vi.mocked(getInstalledPlugins).mockResolvedValue([mockEntry]);
        vi.mocked(getPluginDetails).mockResolvedValue(mockDetails);

        const response = await request(app).get("/api/plugins");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          name: "test-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          enabled: true,
          description: "Test plugin",
          author: { name: "Test Author" },
          keywords: ["test"],
          category: "utility",
          skillCount: 1,
          agentCount: 0,
          hookCount: 0,
          mcpCount: 0,
        });
      });

      it("returns empty array when no plugins installed", async () => {
        vi.mocked(getInstalledPlugins).mockResolvedValue([]);

        const response = await request(app).get("/api/plugins");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });

      it("returns 500 on service error", async () => {
        vi.mocked(getInstalledPlugins).mockRejectedValue(
          new Error("Failed to read plugins")
        );

        const response = await request(app).get("/api/plugins");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Failed to read installed plugins",
        });
      });
    });

    describe("GET /api/plugins/:name/details", () => {
      it("returns plugin details", async () => {
        const mockEntry: InstalledPluginEntry = {
          name: "test-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          cache_path: "/path/to/cache",
        };

        const mockDetails: PluginDetails = {
          name: "test-plugin",
          version: "1.0.0",
          description: "Test plugin",
          marketplace: "copilot-plugins",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          skills: [],
          agents: [],
          hooks: [],
          mcpServers: [],
        };

        vi.mocked(getInstalledPlugins).mockResolvedValue([mockEntry]);
        vi.mocked(getPluginDetails).mockResolvedValue(mockDetails);

        const response = await request(app).get(
          "/api/plugins/test-plugin/details"
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          name: "test-plugin",
          version: "1.0.0",
          description: "Test plugin",
        });
      });

      it("returns 404 for unknown plugin", async () => {
        vi.mocked(getInstalledPlugins).mockResolvedValue([]);

        const response = await request(app).get(
          "/api/plugins/unknown-plugin/details"
        );

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Plugin not found" });
      });
    });

    describe("DELETE /api/plugins/:name", () => {
      it("returns success on successful uninstall", async () => {
        vi.mocked(uninstallPlugin).mockResolvedValue({
          success: true,
          stdout: "Plugin uninstalled",
          stderr: "",
          exitCode: 0,
        });

        const response = await request(app).delete(
          "/api/plugins/test-plugin"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Plugin uninstalled",
        });
        expect(uninstallPlugin).toHaveBeenCalledWith("test-plugin");
      });

      it("returns 500 on failed uninstall", async () => {
        vi.mocked(uninstallPlugin).mockResolvedValue({
          success: false,
          stdout: "",
          stderr: "Failed to uninstall",
          exitCode: 1,
        });

        const response = await request(app).delete(
          "/api/plugins/test-plugin"
        );

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to uninstall",
        });
      });
    });

    describe("POST /api/plugins/install", () => {
      it("returns 400 when source missing", async () => {
        const response = await request(app)
          .post("/api/plugins/install")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "source is required" });
      });

      it("returns success on successful install", async () => {
        vi.mocked(installPlugin).mockResolvedValue({
          success: true,
          stdout: "Plugin installed successfully",
          stderr: "",
          exitCode: 0,
        });

        const response = await request(app)
          .post("/api/plugins/install")
          .send({ source: "github:user/plugin" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Plugin installed successfully",
        });
        expect(installPlugin).toHaveBeenCalledWith("github:user/plugin");
      });

      it("returns 500 on failed install", async () => {
        vi.mocked(installPlugin).mockResolvedValue({
          success: false,
          stdout: "",
          stderr: "Failed to install plugin",
          exitCode: 1,
        });

        const response = await request(app)
          .post("/api/plugins/install")
          .send({ source: "github:user/plugin" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to install plugin",
        });
      });
    });

    describe("POST /api/plugins/:name/update", () => {
      it("returns success on successful update", async () => {
        vi.mocked(updatePlugin).mockResolvedValue({
          success: true,
          stdout: "Plugin updated successfully",
          stderr: "",
          exitCode: 0,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/update"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Plugin updated successfully",
        });
        expect(updatePlugin).toHaveBeenCalledWith("test-plugin");
      });

      it("returns 500 on failed update", async () => {
        vi.mocked(updatePlugin).mockResolvedValue({
          success: false,
          stdout: "",
          stderr: "Failed to update plugin",
          exitCode: 1,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/update"
        );

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to update plugin",
        });
      });
    });

    describe("POST /api/plugins/:name/disable", () => {
      it("disables a plugin successfully", async () => {
        const mockEntry: InstalledPluginEntry = {
          name: "test-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          cache_path: "/path/to/cache",
        };

        const mockDetails: PluginDetails = {
          name: "test-plugin",
          version: "1.0.0",
          description: "Test plugin",
          marketplace: "copilot-plugins",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          skills: [{ name: "skill1", path: "/skills/skill1" }],
          agents: [{ name: "agent1", path: "/agents/agent1" }],
          hooks: [],
          mcpServers: [],
        };

        vi.mocked(getInstalledPlugins).mockResolvedValue([mockEntry]);
        vi.mocked(getPluginDetails).mockResolvedValue(mockDetails);
        vi.mocked(getMarketplacePlugins).mockResolvedValue([
          {
            name: "test-plugin",
            source: "github:user/test-plugin",
            version: "1.0.0",
            installed: true,
            marketplace: "copilot-plugins",
          },
        ]);
        vi.mocked(uninstallPlugin).mockResolvedValue({
          success: true,
          stdout: "Plugin uninstalled",
          stderr: "",
          exitCode: 0,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/disable"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Plugin test-plugin disabled",
        });
        expect(uninstallPlugin).toHaveBeenCalledWith("test-plugin");
        expect(addDisabledPlugin).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "test-plugin",
            marketplace: "copilot-plugins",
            source: "github:user/test-plugin",
            version: "1.0.0",
            description: "Test plugin",
            skillCount: 1,
            agentCount: 1,
            hookCount: 0,
            mcpCount: 0,
          })
        );
      });

      it("returns 404 when plugin not found", async () => {
        vi.mocked(getInstalledPlugins).mockResolvedValue([]);

        const response = await request(app).post(
          "/api/plugins/unknown-plugin/disable"
        );

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Plugin not found" });
      });

      it("returns 500 when uninstall fails and does not save to registry", async () => {
        const mockEntry: InstalledPluginEntry = {
          name: "test-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          installed_at: "2024-01-01T00:00:00Z",
          enabled: true,
          cache_path: "/path/to/cache",
        };

        const mockDetails: PluginDetails = {
          name: "test-plugin",
          version: "1.0.0",
          description: "Test plugin",
          marketplace: "copilot-plugins",
          enabled: true,
          skills: [],
          agents: [],
          hooks: [],
          mcpServers: [],
        };

        vi.mocked(getInstalledPlugins).mockResolvedValue([mockEntry]);
        vi.mocked(getPluginDetails).mockResolvedValue(mockDetails);
        vi.mocked(getMarketplacePlugins).mockResolvedValue([]);
        vi.mocked(uninstallPlugin).mockResolvedValue({
          success: false,
          stdout: "",
          stderr: "Failed to uninstall",
          exitCode: 1,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/disable"
        );

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to uninstall",
        });
        expect(addDisabledPlugin).not.toHaveBeenCalled();
      });
    });

    describe("POST /api/plugins/:name/enable", () => {
      it("enables a disabled plugin successfully", async () => {
        vi.mocked(getDisabledPlugin).mockResolvedValue({
          name: "test-plugin",
          marketplace: "copilot-plugins",
          source: "github:user/test-plugin",
          version: "1.0.0",
          description: "Test plugin",
          disabledAt: "2024-06-01T00:00:00Z",
          skillCount: 1,
          agentCount: 0,
          hookCount: 0,
          mcpCount: 0,
        });
        vi.mocked(installPlugin).mockResolvedValue({
          success: true,
          stdout: "Plugin installed",
          stderr: "",
          exitCode: 0,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/enable"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Plugin test-plugin enabled",
        });
        expect(installPlugin).toHaveBeenCalledWith("test-plugin@copilot-plugins");
        expect(removeDisabledPlugin).toHaveBeenCalledWith("test-plugin");
      });

      it("returns 404 when plugin not in disabled registry", async () => {
        vi.mocked(getDisabledPlugin).mockResolvedValue(null);

        const response = await request(app).post(
          "/api/plugins/unknown-plugin/enable"
        );

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          error: "Plugin not found in disabled registry",
        });
      });

      it("returns 400 when no source available", async () => {
        vi.mocked(getDisabledPlugin).mockResolvedValue({
          name: "test-plugin",
          marketplace: "",
          source: "",
          version: "1.0.0",
          disabledAt: "2024-06-01T00:00:00Z",
          skillCount: 0,
          agentCount: 0,
          hookCount: 0,
          mcpCount: 0,
        });

        const response = await request(app).post(
          "/api/plugins/test-plugin/enable"
        );

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "No install source available for this plugin. Try installing manually from the marketplace.",
        });
        expect(installPlugin).not.toHaveBeenCalled();
      });
    });

    describe("GET /api/plugins (with disabled plugins)", () => {
      it("includes disabled plugins in the list", async () => {
        vi.mocked(getInstalledPlugins).mockResolvedValue([]);
        vi.mocked(getDisabledPlugins).mockResolvedValue([
          {
            name: "disabled-plugin",
            marketplace: "copilot-plugins",
            source: "github:user/disabled-plugin",
            version: "1.0.0",
            description: "A disabled plugin",
            disabledAt: "2024-06-01T00:00:00Z",
            skillCount: 2,
            agentCount: 0,
            hookCount: 1,
            mcpCount: 0,
          },
        ]);

        const response = await request(app).get("/api/plugins");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          name: "disabled-plugin",
          marketplace: "copilot-plugins",
          version: "1.0.0",
          disabled: true,
          enabled: false,
          description: "A disabled plugin",
          skillCount: 2,
          agentCount: 0,
          hookCount: 1,
          mcpCount: 0,
        });
      });
    });
  });

  describe("Marketplace Routes", () => {
    describe("GET /api/marketplaces", () => {
      it("returns list of marketplaces", async () => {
        const mockMarketplaces: MarketplaceInfo[] = [
          {
            name: "copilot-plugins",
            source: {
              source: "github:github/copilot-plugins",
              repo: "github/copilot-plugins",
            },
            isDefault: true,
          },
        ];

        vi.mocked(getMarketplaces).mockResolvedValue(mockMarketplaces);

        const response = await request(app).get("/api/marketplaces");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockMarketplaces);
      });
    });

    describe("GET /api/marketplaces/browse", () => {
      it("returns all plugins", async () => {
        const mockPlugins: MarketplacePlugin[] = [
          {
            name: "plugin1",
            description: "Plugin 1",
            version: "1.0.0",
            source: "github:user/plugin1",
            keywords: ["test"],
            installed: false,
          },
        ];

        vi.mocked(browseAllMarketplaces).mockResolvedValue(mockPlugins);

        const response = await request(app).get("/api/marketplaces/browse");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockPlugins.map((p) => ({ ...p, disabled: false })));
      });

      it("filters by search term", async () => {
        const mockPlugins: MarketplacePlugin[] = [
          {
            name: "bug-tracker",
            description: "Track bugs",
            version: "1.0.0",
            source: "github:user/bug-tracker",
            keywords: ["bug", "tracking"],
            installed: false,
          },
          {
            name: "feature-tracker",
            description: "Track features",
            version: "1.0.0",
            source: "github:user/feature-tracker",
            keywords: ["feature"],
            installed: false,
          },
        ];

        vi.mocked(browseAllMarketplaces).mockResolvedValue(mockPlugins);

        const response = await request(app).get(
          "/api/marketplaces/browse?search=bug"
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].name).toBe("bug-tracker");
      });

      it("filters by marketplace", async () => {
        const mockPlugins: MarketplacePlugin[] = [
          {
            name: "plugin1",
            description: "Plugin 1",
            version: "1.0.0",
            source: "github:user/plugin1",
            installed: false,
          },
        ];

        vi.mocked(getMarketplacePlugins).mockResolvedValue(mockPlugins);

        const response = await request(app).get(
          "/api/marketplaces/browse?marketplace=copilot-plugins"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockPlugins.map((p) => ({ ...p, disabled: false })));
        expect(getMarketplacePlugins).toHaveBeenCalledWith("copilot-plugins");
      });
    });

    describe("GET /api/marketplaces/:name/plugins", () => {
      it("returns plugins for specific marketplace", async () => {
        const mockPlugins: MarketplacePlugin[] = [
          {
            name: "plugin1",
            description: "Plugin 1",
            version: "1.0.0",
            source: "github:user/plugin1",
            installed: false,
          },
        ];

        vi.mocked(getMarketplacePlugins).mockResolvedValue(mockPlugins);

        const response = await request(app).get(
          "/api/marketplaces/copilot-plugins/plugins"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockPlugins);
        expect(getMarketplacePlugins).toHaveBeenCalledWith("copilot-plugins");
      });
    });

    describe("POST /api/marketplaces", () => {
      it("adds marketplace", async () => {
        vi.mocked(addMarketplace).mockResolvedValue({
          success: true,
          message: "Marketplace added",
        });

        const response = await request(app)
          .post("/api/marketplaces")
          .send({ source: "github:user/marketplace" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Marketplace added",
        });
        expect(addMarketplace).toHaveBeenCalledWith("github:user/marketplace");
      });

      it("returns 400 when source missing", async () => {
        const response = await request(app)
          .post("/api/marketplaces")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "source is required" });
      });

      it("returns 500 on failed add", async () => {
        vi.mocked(addMarketplace).mockResolvedValue({
          success: false,
          message: "Failed to add marketplace",
        });

        const response = await request(app)
          .post("/api/marketplaces")
          .send({ source: "github:user/marketplace" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to add marketplace",
        });
      });
    });

    describe("DELETE /api/marketplaces/:name", () => {
      it("removes marketplace", async () => {
        vi.mocked(removeMarketplace).mockResolvedValue({
          success: true,
          message: "Marketplace removed",
        });

        const response = await request(app).delete(
          "/api/marketplaces/test-marketplace"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Marketplace removed",
        });
        expect(removeMarketplace).toHaveBeenCalledWith("test-marketplace");
      });

      it("returns 500 on failed remove", async () => {
        vi.mocked(removeMarketplace).mockResolvedValue({
          success: false,
          message: "Failed to remove marketplace",
        });

        const response = await request(app).delete(
          "/api/marketplaces/test-marketplace"
        );

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to remove marketplace",
        });
      });
    });

    describe("POST /api/marketplaces/refresh", () => {
      it("refreshes marketplaces", async () => {
        vi.mocked(refreshMarketplaces).mockResolvedValue({
          success: true,
          message: "Marketplaces refreshed",
        });

        const response = await request(app)
          .post("/api/marketplaces/refresh")
          .send({});

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Marketplaces refreshed",
        });
        expect(refreshMarketplaces).toHaveBeenCalledWith(undefined);
      });

      it("refreshes specific marketplace", async () => {
        vi.mocked(refreshMarketplaces).mockResolvedValue({
          success: true,
          message: "Marketplace refreshed",
        });

        const response = await request(app)
          .post("/api/marketplaces/refresh")
          .send({ name: "copilot-plugins" });

        expect(response.status).toBe(200);
        expect(refreshMarketplaces).toHaveBeenCalledWith("copilot-plugins");
      });

      it("returns 500 on failed refresh", async () => {
        vi.mocked(refreshMarketplaces).mockResolvedValue({
          success: false,
          message: "Failed to refresh marketplaces",
        });

        const response = await request(app)
          .post("/api/marketplaces/refresh")
          .send({});

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to refresh marketplaces",
        });
      });
    });
  });

  describe("Settings Routes", () => {
    describe("GET /api/settings", () => {
      it("returns current settings", async () => {
        // Mock file not found - should return default settings
        mockReadFile.mockRejectedValue(new Error("ENOENT"));

        const response = await request(app).get("/api/settings");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ theme: "light" });
      });

      it("returns saved settings if file exists", async () => {
        // Mock file exists with saved settings
        mockReadFile.mockResolvedValue(JSON.stringify({ theme: "dark" }));

        const response = await request(app).get("/api/settings");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ theme: "dark" });
      });
    });

    describe("PUT /api/settings", () => {
      it("updates theme", async () => {
        // Mock reading existing settings (none exist)
        mockReadFile.mockRejectedValue(new Error("ENOENT"));
        
        const response = await request(app)
          .put("/api/settings")
          .send({ theme: "dark" });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ theme: "dark" });

        // Verify mkdir and writeFile were called
        expect(mockMkdir).toHaveBeenCalledWith(
          path.join(
            "/mock-home",
            ".copilot",
            "plugin-data",
            "copilot-cli-plugin-manager"
          ),
          { recursive: true }
        );
        
        expect(mockWriteFile).toHaveBeenCalledWith(
          path.join(
            "/mock-home",
            ".copilot",
            "plugin-data",
            "copilot-cli-plugin-manager",
            "settings.json"
          ),
          JSON.stringify({ theme: "dark" }, null, 2)
        );
      });

      it("rejects invalid theme", async () => {
        mockReadFile.mockRejectedValue(new Error("ENOENT"));
        
        const response = await request(app)
          .put("/api/settings")
          .send({ theme: "invalid" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "Invalid theme. Must be light, dark, or copilot.",
        });
      });

      it("accepts copilot theme", async () => {
        mockReadFile.mockRejectedValue(new Error("ENOENT"));
        
        const response = await request(app)
          .put("/api/settings")
          .send({ theme: "copilot" });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ theme: "copilot" });
      });
    });
  });
});
