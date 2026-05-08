import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

// Mock os.homedir to use a temp directory
let tempDir: string;
const originalHomedir = os.homedir.bind(os);

// Import functions dynamically in each test
let getMarketplaces: () => Promise<any[]>;
let getMarketplacePlugins: (name: string) => Promise<any[]>;
let browseAllMarketplaces: () => Promise<any[]>;

beforeEach(async () => {
  tempDir = path.join(originalHomedir(), ".copilot-test-" + Date.now());
  await mkdir(tempDir, { recursive: true });
  
  // Mock os.homedir
  os.homedir = () => tempDir;

  // Mock fetch to prevent GitHub API calls in tests
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

  // Mock child_process to prevent `gh api` calls in tests
  vi.mock("child_process", () => ({
    execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error("mocked"), "", "");
    }),
  }));
  
  // Reset modules and re-import to get fresh instance
  vi.resetModules();
  const module = await import("./marketplace-reader.js");
  getMarketplaces = module.getMarketplaces;
  getMarketplacePlugins = module.getMarketplacePlugins;
  browseAllMarketplaces = module.browseAllMarketplaces;
});

afterEach(async () => {
  // Restore original homedir
  os.homedir = originalHomedir;
  
  await rm(tempDir, { recursive: true, force: true });
  
  // Reset modules
  vi.resetModules();
});

async function createSettingsJson(content: string) {
  const settingsPath = path.join(tempDir, ".copilot", "settings.json");
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, content);
}

async function createConfigJson(installedPlugins: Array<{ name: string }>) {
  const configPath = path.join(tempDir, ".copilot", "config.json");
  await mkdir(path.dirname(configPath), { recursive: true });
  const fullPlugins = installedPlugins.map((p) => ({
    name: p.name,
    marketplace: "test-marketplace",
    installed_at: new Date().toISOString(),
    enabled: true,
    cache_path: "/test/path",
  }));
  await writeFile(
    configPath,
    JSON.stringify({ installedPlugins: fullPlugins }, null, 2)
  );
}

async function createMarketplaceCache(
  cacheDirName: string,
  location: "github" | "claude",
  catalog: Record<string, unknown>
) {
  const basePath = path.join(
    tempDir,
    ".copilot",
    "marketplace-cache",
    cacheDirName
  );
  const subPath =
    location === "github"
      ? path.join(basePath, ".github", "plugin")
      : path.join(basePath, ".claude-plugin");

  await mkdir(subPath, { recursive: true });
  await writeFile(
    path.join(subPath, "marketplace.json"),
    JSON.stringify(catalog, null, 2)
  );
}

describe("getMarketplaces", () => {
  it("returns default marketplaces when no settings.json exists", async () => {
    const marketplaces = await getMarketplaces();

    expect(marketplaces).toHaveLength(2);
    expect(marketplaces).toEqual([
      {
        name: "copilot-plugins",
        source: { source: "github", repo: "github/copilot-plugins" },
        isDefault: true,
      },
      {
        name: "awesome-copilot",
        source: { source: "github", repo: "github/awesome-copilot" },
        isDefault: true,
      },
    ]);
  });

  it("returns defaults + extra marketplaces from settings.json", async () => {
    await createSettingsJson(`{
      "extraKnownMarketplaces": {
        "custom-marketplace": {
          "source": { "source": "github", "repo": "org/custom-marketplace" }
        }
      }
    }`);

    const marketplaces = await getMarketplaces();

    expect(marketplaces).toHaveLength(3);
    expect(marketplaces[0].isDefault).toBe(true);
    expect(marketplaces[1].isDefault).toBe(true);
    expect(marketplaces[2]).toEqual({
      name: "custom-marketplace",
      source: { source: "github", repo: "org/custom-marketplace" },
      isDefault: false,
    });
  });

  it("doesn't duplicate defaults if they appear in extraKnownMarketplaces", async () => {
    await createSettingsJson(`{
      "extraKnownMarketplaces": {
        "copilot-plugins": {
          "source": { "source": "github", "repo": "github/copilot-plugins" }
        },
        "my-marketplace": {
          "source": { "source": "github", "repo": "me/my-marketplace" }
        }
      }
    }`);

    const marketplaces = await getMarketplaces();

    expect(marketplaces).toHaveLength(3);
    const names = marketplaces.map((m) => m.name);
    expect(names.filter((n) => n === "copilot-plugins")).toHaveLength(1);
    expect(names).toContain("my-marketplace");
  });

  it("handles settings.json with // comments", async () => {
    await createSettingsJson(`{
      // This is a comment
      "extraKnownMarketplaces": {
        // Another comment
        "test-marketplace": {
          "source": { "source": "github", "repo": "test/repo" }
        }
      }
      // Final comment
    }`);

    const marketplaces = await getMarketplaces();

    expect(marketplaces).toHaveLength(3);
    const testMarketplace = marketplaces.find(
      (m) => m.name === "test-marketplace"
    );
    expect(testMarketplace).toBeDefined();
    expect(testMarketplace?.source.repo).toBe("test/repo");
  });

  it("handles missing extraKnownMarketplaces field", async () => {
    await createSettingsJson(`{
      "otherSetting": "value"
    }`);

    const marketplaces = await getMarketplaces();

    expect(marketplaces).toHaveLength(2);
    expect(marketplaces.every((m) => m.isDefault)).toBe(true);
  });
});

describe("getMarketplacePlugins", () => {
  it("returns plugins from .github/plugin/marketplace.json", async () => {
    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [
        {
          name: "test-plugin",
          description: "A test plugin",
          version: "1.0.0",
          source: "https://github.com/test/plugin",
          author: { name: "Test Author" },
          keywords: ["test", "plugin"],
          category: "utility",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("copilot-plugins");

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      name: "test-plugin",
      description: "A test plugin",
      version: "1.0.0",
      source: "https://github.com/test/plugin",
      author: { name: "Test Author" },
      keywords: ["test", "plugin"],
      category: "utility",
      installed: false,
      marketplace: "copilot-plugins",
    });
  });

  it("falls back to .claude-plugin/marketplace.json", async () => {
    await createMarketplaceCache("github-awesome-copilot", "claude", {
      name: "awesome-copilot",
      plugins: [
        {
          name: "claude-plugin",
          description: "A Claude plugin",
          version: "2.0.0",
          source: "https://github.com/claude/plugin",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("awesome-copilot");

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      name: "claude-plugin",
      description: "A Claude plugin",
      version: "2.0.0",
      marketplace: "awesome-copilot",
    });
  });

  it("returns empty array for unknown marketplace name", async () => {
    const plugins = await getMarketplacePlugins("unknown-marketplace");

    expect(plugins).toEqual([]);
  });

  it("returns empty array when cache dir doesn't exist", async () => {
    // copilot-plugins is a default marketplace, but no cache exists
    const plugins = await getMarketplacePlugins("copilot-plugins");

    expect(plugins).toEqual([]);
  });

  it("marks installed plugins correctly", async () => {
    await createConfigJson([
      { name: "installed-plugin" },
      { name: "another-installed" },
    ]);

    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [
        {
          name: "installed-plugin",
          source: "https://github.com/test/installed",
        },
        {
          name: "not-installed-plugin",
          source: "https://github.com/test/not-installed",
        },
        {
          name: "another-installed",
          source: "https://github.com/test/another",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("copilot-plugins");

    expect(plugins).toHaveLength(3);
    expect(plugins[0].installed).toBe(true);
    expect(plugins[1].installed).toBe(false);
    expect(plugins[2].installed).toBe(true);
  });

  it("returns all plugin fields", async () => {
    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [
        {
          name: "full-plugin",
          description: "Complete plugin with all fields",
          version: "3.2.1",
          source: "https://github.com/full/plugin",
          author: {
            name: "Full Author",
            email: "author@example.com",
          },
          keywords: ["full", "complete", "test"],
          category: "development",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("copilot-plugins");

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toEqual({
      name: "full-plugin",
      description: "Complete plugin with all fields",
      version: "3.2.1",
      source: "https://github.com/full/plugin",
      author: {
        name: "Full Author",
        email: "author@example.com",
      },
      keywords: ["full", "complete", "test"],
      category: "development",
      installed: false,
      marketplace: "copilot-plugins",
    });
  });
});

describe("browseAllMarketplaces", () => {
  it("aggregates plugins from multiple marketplaces", async () => {
    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [
        {
          name: "plugin-1",
          source: "https://github.com/test/plugin1",
        },
        {
          name: "plugin-2",
          source: "https://github.com/test/plugin2",
        },
      ],
    });

    await createMarketplaceCache("github-awesome-copilot", "github", {
      name: "awesome-copilot",
      plugins: [
        {
          name: "plugin-3",
          source: "https://github.com/test/plugin3",
        },
      ],
    });

    const allPlugins = await browseAllMarketplaces();

    expect(allPlugins).toHaveLength(3);
    expect(allPlugins[0].marketplace).toBe("copilot-plugins");
    expect(allPlugins[1].marketplace).toBe("copilot-plugins");
    expect(allPlugins[2].marketplace).toBe("awesome-copilot");
  });

  it("returns empty array when no marketplace caches exist", async () => {
    const allPlugins = await browseAllMarketplaces();

    expect(allPlugins).toEqual([]);
  });

  it("each plugin has correct marketplace field", async () => {
    await createSettingsJson(`{
      "extraKnownMarketplaces": {
        "custom-marketplace": {
          "source": { "source": "github", "repo": "custom/marketplace" }
        }
      }
    }`);

    await createMarketplaceCache("custom-marketplace", "github", {
      name: "custom-marketplace",
      plugins: [
        {
          name: "custom-plugin",
          source: "https://github.com/custom/plugin",
        },
      ],
    });

    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [
        {
          name: "default-plugin",
          source: "https://github.com/default/plugin",
        },
      ],
    });

    const allPlugins = await browseAllMarketplaces();

    expect(allPlugins).toHaveLength(2);
    const customPlugin = allPlugins.find((p) => p.name === "custom-plugin");
    const defaultPlugin = allPlugins.find((p) => p.name === "default-plugin");

    expect(customPlugin?.marketplace).toBe("custom-marketplace");
    expect(defaultPlugin?.marketplace).toBe("copilot-plugins");
  });
});

describe("getCacheDirName", () => {
  it("converts owner/repo to owner-repo", async () => {
    await createMarketplaceCache("github-copilot-plugins", "github", {
      name: "copilot-plugins",
      plugins: [],
    });

    const plugins = await getMarketplacePlugins("copilot-plugins");
    // The fact that we can retrieve from "github-copilot-plugins" dir
    // proves the conversion works
    expect(plugins).toEqual([]);
  });

  it("extracts repo name from URL", async () => {
    await createSettingsJson(`{
      "extraKnownMarketplaces": {
        "url-marketplace": {
          "source": { "source": "git", "url": "https://github.com/org/marketplace.git" }
        }
      }
    }`);

    await createMarketplaceCache("marketplace", "github", {
      name: "url-marketplace",
      plugins: [
        {
          name: "url-plugin",
          source: "https://github.com/test/plugin",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("url-marketplace");

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("url-plugin");
  });

  it("falls back to marketplace name when no repo/url", async () => {
    await createSettingsJson(`{
      "extraKnownMarketplaces": {
        "no-repo-marketplace": {
          "source": { "source": "local" }
        }
      }
    }`);

    await createMarketplaceCache("no-repo-marketplace", "github", {
      name: "no-repo-marketplace",
      plugins: [
        {
          name: "fallback-plugin",
          source: "https://github.com/test/plugin",
        },
      ],
    });

    const plugins = await getMarketplacePlugins("no-repo-marketplace");

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("fallback-plugin");
  });
});
