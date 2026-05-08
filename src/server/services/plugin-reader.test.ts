import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import type { InstalledPluginEntry } from "../types.js";

describe("plugin-reader", () => {
  let tmpDir: string;
  let copilotDir: string;
  let originalHomedir: () => string;

  // Import the module dynamically in each test to ensure fresh state
  let getInstalledPlugins: () => Promise<any[]>;
  let getPluginDetails: (entry: InstalledPluginEntry) => Promise<any>;

  beforeEach(async () => {
    // Save original homedir
    originalHomedir = os.homedir;
    
    // Create a temp directory for testing
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "plugin-reader-test-"));
    copilotDir = path.join(tmpDir, ".copilot");
    await mkdir(copilotDir, { recursive: true });
    
    // Mock os.homedir() to return our temp directory
    os.homedir = () => tmpDir;
    
    // Clear module cache and re-import to get fresh instance with new homedir
    vi.resetModules();
    const module = await import("./plugin-reader.js");
    getInstalledPlugins = module.getInstalledPlugins;
    getPluginDetails = module.getPluginDetails;
  });

  afterEach(async () => {
    // Restore original homedir
    os.homedir = originalHomedir;
    
    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true });
    
    // Reset modules
    vi.resetModules();
  });

  describe("getInstalledPlugins", () => {
    it("returns plugins from config.json", async () => {
      const config = {
        installedPlugins: [
          {
            name: "test-plugin",
            marketplace: "user",
            version: "1.0.0",
            installed_at: "2024-01-01T00:00:00Z",
            enabled: true,
            cache_path: "/path/to/plugin",
          },
          {
            name: "another-plugin",
            marketplace: "community",
            version: "2.0.0",
            installed_at: "2024-01-02T00:00:00Z",
            enabled: false,
            cache_path: "/path/to/another",
          },
        ],
      };
      await writeFile(
        path.join(copilotDir, "config.json"),
        JSON.stringify(config, null, 2)
      );

      const plugins = await getInstalledPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe("test-plugin");
      expect(plugins[0].enabled).toBe(true);
      expect(plugins[1].name).toBe("another-plugin");
      expect(plugins[1].enabled).toBe(false);
    });

    it("returns empty array when config.json doesn't exist", async () => {
      const plugins = await getInstalledPlugins();
      expect(plugins).toEqual([]);
    });

    it("returns empty array when config.json has no installedPlugins field", async () => {
      const config = { otherField: "value" };
      await writeFile(
        path.join(copilotDir, "config.json"),
        JSON.stringify(config)
      );

      const plugins = await getInstalledPlugins();
      expect(plugins).toEqual([]);
    });

    it("handles config.json with leading // comments", async () => {
      const configWithComments = `// This is a comment
{
  // Another comment
  "installedPlugins": [
    // Comment in array
    {
      "name": "test-plugin",
      "marketplace": "user",
      "installed_at": "2024-01-01T00:00:00Z",
      "enabled": true,
      "cache_path": "/path/to/plugin"
    }
  ]
}`;
      await writeFile(path.join(copilotDir, "config.json"), configWithComments);

      const plugins = await getInstalledPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe("test-plugin");
    });

    it("handles malformed JSON gracefully", async () => {
      await writeFile(
        path.join(copilotDir, "config.json"),
        "{ invalid json: }"
      );

      const plugins = await getInstalledPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe("getPluginDetails", () => {
    let pluginCachePath: string;
    let entry: InstalledPluginEntry;

    beforeEach(async () => {
      pluginCachePath = path.join(copilotDir, "plugins", "test-plugin");
      await mkdir(pluginCachePath, { recursive: true });

      entry = {
        name: "test-plugin",
        marketplace: "user",
        version: "1.0.0",
        installed_at: "2024-01-01T00:00:00Z",
        enabled: true,
        cache_path: pluginCachePath,
      };
    });

    it("returns full details with skills, agents, hooks, MCP servers", async () => {
      // Create plugin.json
      const pluginJson = {
        name: "Test Plugin",
        version: "1.0.0",
        description: "A test plugin",
        author: { name: "Test Author", email: "test@example.com" },
        keywords: ["test", "demo"],
        category: "productivity",
        homepage: "https://example.com",
        repository: "https://github.com/test/plugin",
        license: "MIT",
      };
      await mkdir(path.join(pluginCachePath, ".claude-plugin"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, ".claude-plugin", "plugin.json"),
        JSON.stringify(pluginJson)
      );

      // Create skills
      await mkdir(path.join(pluginCachePath, "skills", "skill1"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "skill1", "SKILL.md"),
        'description: "First skill"\n\nContent here'
      );

      await mkdir(path.join(pluginCachePath, "skills", "skill2"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "skill2", "SKILL.md"),
        "description: 'Second skill'\n\nContent here"
      );

      // Create agents
      await mkdir(path.join(pluginCachePath, "agents", "agent1"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "agents", "agent1", "SKILL.md"),
        'description: "Test agent"\n'
      );

      // Create hooks
      await mkdir(path.join(pluginCachePath, "hooks"), { recursive: true });
      await writeFile(
        path.join(pluginCachePath, "hooks", "hooks.json"),
        JSON.stringify({
          "pre-commit": { script: "echo test" },
          "post-merge": { script: "echo test2" },
        })
      );

      // Create MCP servers
      await writeFile(
        path.join(pluginCachePath, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            server1: { command: "node", args: ["server1.js"] },
            server2: { command: "node", args: ["server2.js"] },
          },
        })
      );

      const details = await getPluginDetails(entry);

      expect(details.name).toBe("Test Plugin");
      expect(details.version).toBe("1.0.0");
      expect(details.description).toBe("A test plugin");
      expect(details.author).toEqual({ name: "Test Author", email: "test@example.com" });
      expect(details.keywords).toEqual(["test", "demo"]);
      expect(details.category).toBe("productivity");
      expect(details.homepage).toBe("https://example.com");
      expect(details.repository).toBe("https://github.com/test/plugin");
      expect(details.license).toBe("MIT");
      expect(details.marketplace).toBe("user");
      expect(details.installed_at).toBe("2024-01-01T00:00:00Z");
      expect(details.enabled).toBe(true);

      expect(details.skills).toHaveLength(2);
      expect(details.skills[0].name).toBe("skill1");
      expect(details.skills[0].description).toBe("First skill");
      expect(details.skills[1].name).toBe("skill2");
      expect(details.skills[1].description).toBe("Second skill");

      expect(details.agents).toHaveLength(1);
      expect(details.agents[0].name).toBe("agent1");
      expect(details.agents[0].description).toBe("Test agent");

      expect(details.hooks).toHaveLength(2);
      expect(details.hooks[0].name).toBe("pre-commit");
      expect(details.hooks[0].description).toBe("Hook: pre-commit");
      expect(details.hooks[1].name).toBe("post-merge");

      expect(details.mcpServers).toHaveLength(2);
      expect(details.mcpServers[0].name).toBe("server1");
      expect(details.mcpServers[0].description).toContain("Type:");
      expect(details.mcpServers[0].description).toContain("Command: node server1.js");
      expect(details.mcpServers[0].metadata).toBeDefined();
      expect(details.mcpServers[0].metadata?.command).toBe("node");
      expect(details.mcpServers[1].name).toBe("server2");
    });

    it("handles plugin with no skills/agents/hooks/mcp (empty arrays)", async () => {
      const details = await getPluginDetails(entry);

      expect(details.name).toBe("test-plugin");
      expect(details.version).toBe("1.0.0");
      expect(details.skills).toEqual([]);
      expect(details.agents).toEqual([]);
      expect(details.hooks).toEqual([]);
      expect(details.mcpServers).toEqual([]);
    });

    it("reads SKILL.md description from frontmatter-style description line", async () => {
      await mkdir(path.join(pluginCachePath, "skills", "test-skill"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "test-skill", "SKILL.md"),
        'description: "This is a description"\n\nSome content'
      );

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].description).toBe("This is a description");
    });

    it("handles SKILL.md with single-quoted description", async () => {
      await mkdir(path.join(pluginCachePath, "skills", "test-skill"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "test-skill", "SKILL.md"),
        "description: 'Single quoted description'\n"
      );

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].description).toBe("Single quoted description");
    });

    it("handles SKILL.md with no quotes in description", async () => {
      await mkdir(path.join(pluginCachePath, "skills", "test-skill"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "test-skill", "SKILL.md"),
        "description: No quotes here\n"
      );

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].description).toBe("No quotes here");
    });

    it("handles SKILL.md with no description line", async () => {
      await mkdir(path.join(pluginCachePath, "skills", "test-skill"), {
        recursive: true,
      });
      await writeFile(
        path.join(pluginCachePath, "skills", "test-skill", "SKILL.md"),
        "# Just a heading\n\nSome content"
      );

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].description).toBeUndefined();
    });

    it("handles missing .claude-plugin/plugin.json (falls back to entry data)", async () => {
      const details = await getPluginDetails(entry);

      expect(details.name).toBe("test-plugin");
      expect(details.version).toBe("1.0.0");
      expect(details.description).toBeUndefined();
      expect(details.marketplace).toBe("user");
    });

    it("handles missing cache_path directory gracefully", async () => {
      const nonExistentEntry: InstalledPluginEntry = {
        name: "non-existent",
        marketplace: "user",
        version: "1.0.0",
        installed_at: "2024-01-01T00:00:00Z",
        enabled: false,
        cache_path: "/nonexistent/path",
      };

      const details = await getPluginDetails(nonExistentEntry);

      expect(details.name).toBe("non-existent");
      expect(details.skills).toEqual([]);
      expect(details.agents).toEqual([]);
      expect(details.hooks).toEqual([]);
      expect(details.mcpServers).toEqual([]);
    });

    it("skips non-directory entries in skills/ dir", async () => {
      await mkdir(path.join(pluginCachePath, "skills"), { recursive: true });
      
      // Create a directory (should be included)
      await mkdir(path.join(pluginCachePath, "skills", "valid-skill"));
      await writeFile(
        path.join(pluginCachePath, "skills", "valid-skill", "SKILL.md"),
        'description: "Valid skill"'
      );

      // Create a file (should be skipped)
      await writeFile(
        path.join(pluginCachePath, "skills", "not-a-dir.txt"),
        "This is a file"
      );

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].name).toBe("valid-skill");
    });

    it("handles hooks.json with nested structure", async () => {
      await mkdir(path.join(pluginCachePath, "hooks"), { recursive: true });
      await writeFile(
        path.join(pluginCachePath, "hooks", "hooks.json"),
        JSON.stringify({
          "pre-commit": {
            script: "lint.sh",
            description: "Run linter",
          },
          "post-checkout": {
            script: "install.sh",
            args: ["--production"],
          },
        })
      );

      const details = await getPluginDetails(entry);

      expect(details.hooks).toHaveLength(2);
      expect(details.hooks.map((h) => h.name)).toContain("pre-commit");
      expect(details.hooks.map((h) => h.name)).toContain("post-checkout");
    });

    it("handles .mcp.json with mcpServers key", async () => {
      await writeFile(
        path.join(pluginCachePath, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            server1: { command: "node" },
            server2: { command: "python" },
          },
        })
      );

      const details = await getPluginDetails(entry);

      expect(details.mcpServers).toHaveLength(2);
      expect(details.mcpServers[0].name).toBe("server1");
      expect(details.mcpServers[1].name).toBe("server2");
    });

    it("handles .mcp.json without mcpServers key (top-level keys as servers)", async () => {
      await writeFile(
        path.join(pluginCachePath, ".mcp.json"),
        JSON.stringify({
          server1: { command: "node" },
          server2: { command: "python" },
        })
      );

      const details = await getPluginDetails(entry);

      expect(details.mcpServers).toHaveLength(2);
      expect(details.mcpServers.map((s) => s.name)).toContain("server1");
      expect(details.mcpServers.map((s) => s.name)).toContain("server2");
    });

    it("handles skill directory with no SKILL.md file", async () => {
      await mkdir(path.join(pluginCachePath, "skills", "no-md-skill"), {
        recursive: true,
      });
      // Don't create SKILL.md

      const details = await getPluginDetails(entry);

      expect(details.skills).toHaveLength(1);
      expect(details.skills[0].name).toBe("no-md-skill");
      expect(details.skills[0].description).toBeUndefined();
    });

    it("handles malformed hooks.json gracefully", async () => {
      await mkdir(path.join(pluginCachePath, "hooks"), { recursive: true });
      await writeFile(
        path.join(pluginCachePath, "hooks", "hooks.json"),
        "{ invalid json }"
      );

      const details = await getPluginDetails(entry);

      expect(details.hooks).toEqual([]);
    });

    it("handles malformed .mcp.json gracefully", async () => {
      await writeFile(
        path.join(pluginCachePath, ".mcp.json"),
        "{ not valid json }"
      );

      const details = await getPluginDetails(entry);

      expect(details.mcpServers).toEqual([]);
    });
  });
});
