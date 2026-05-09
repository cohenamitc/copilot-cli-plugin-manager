import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";
import type { DisabledPlugin } from "../types.js";

describe("disabled-registry", () => {
  let tmpDir: string;
  let pluginDataDir: string;
  let originalHomedir: () => string;

  let getDisabledPlugins: () => Promise<DisabledPlugin[]>;
  let addDisabledPlugin: (plugin: DisabledPlugin) => Promise<void>;
  let removeDisabledPlugin: (name: string) => Promise<void>;
  let isDisabled: (name: string) => Promise<boolean>;
  let getDisabledPlugin: (name: string) => Promise<DisabledPlugin | null>;

  const makePlugin = (overrides: Partial<DisabledPlugin> = {}): DisabledPlugin => ({
    name: "test-plugin",
    marketplace: "copilot-plugins",
    source: "github:user/test-plugin",
    version: "1.0.0",
    description: "A test plugin",
    disabledAt: "2024-06-01T00:00:00Z",
    skillCount: 2,
    agentCount: 1,
    hookCount: 0,
    mcpCount: 1,
    ...overrides,
  });

  beforeEach(async () => {
    originalHomedir = os.homedir;

    tmpDir = await mkdtemp(path.join(os.tmpdir(), "disabled-registry-test-"));
    pluginDataDir = path.join(tmpDir, ".copilot", "plugin-data", "copilot-cli-plugin-manager");
    await mkdir(pluginDataDir, { recursive: true });

    os.homedir = () => tmpDir;

    vi.resetModules();
    const module = await import("./disabled-registry.js");
    getDisabledPlugins = module.getDisabledPlugins;
    addDisabledPlugin = module.addDisabledPlugin;
    removeDisabledPlugin = module.removeDisabledPlugin;
    isDisabled = module.isDisabled;
    getDisabledPlugin = module.getDisabledPlugin;
  });

  afterEach(async () => {
    os.homedir = originalHomedir;
    await rm(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  describe("getDisabledPlugins", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await getDisabledPlugins();
      expect(result).toEqual([]);
    });

    it("returns empty array for empty file", async () => {
      await writeFile(path.join(pluginDataDir, "disabled-plugins.json"), "");
      const result = await getDisabledPlugins();
      expect(result).toEqual([]);
    });

    it("returns empty array for malformed JSON", async () => {
      await writeFile(path.join(pluginDataDir, "disabled-plugins.json"), "{not valid json");
      const result = await getDisabledPlugins();
      expect(result).toEqual([]);
    });

    it("returns empty array when JSON is not an array", async () => {
      await writeFile(path.join(pluginDataDir, "disabled-plugins.json"), JSON.stringify({ foo: "bar" }));
      const result = await getDisabledPlugins();
      expect(result).toEqual([]);
    });

    it("returns plugins from valid file", async () => {
      const plugin = makePlugin();
      await writeFile(path.join(pluginDataDir, "disabled-plugins.json"), JSON.stringify([plugin]));

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test-plugin");
      expect(result[0].source).toBe("github:user/test-plugin");
    });
  });

  describe("addDisabledPlugin", () => {
    it("adds a plugin to an empty registry", async () => {
      const plugin = makePlugin();
      await addDisabledPlugin(plugin);

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(plugin);
    });

    it("creates the directory if it does not exist", async () => {
      await rm(pluginDataDir, { recursive: true, force: true });

      const plugin = makePlugin();
      await addDisabledPlugin(plugin);

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
    });

    it("replaces existing plugin with same name (duplicate)", async () => {
      const original = makePlugin({ version: "1.0.0" });
      await addDisabledPlugin(original);

      const updated = makePlugin({ version: "2.0.0" });
      await addDisabledPlugin(updated);

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe("2.0.0");
    });

    it("adds multiple different plugins", async () => {
      await addDisabledPlugin(makePlugin({ name: "plugin-a" }));
      await addDisabledPlugin(makePlugin({ name: "plugin-b" }));

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(["plugin-a", "plugin-b"]);
    });
  });

  describe("removeDisabledPlugin", () => {
    it("removes an existing plugin", async () => {
      await addDisabledPlugin(makePlugin({ name: "plugin-a" }));
      await addDisabledPlugin(makePlugin({ name: "plugin-b" }));

      await removeDisabledPlugin("plugin-a");

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("plugin-b");
    });

    it("does nothing when removing non-existent plugin", async () => {
      await addDisabledPlugin(makePlugin({ name: "plugin-a" }));

      await removeDisabledPlugin("non-existent");

      const result = await getDisabledPlugins();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("plugin-a");
    });

    it("handles removing from empty registry", async () => {
      await removeDisabledPlugin("non-existent");

      const result = await getDisabledPlugins();
      expect(result).toEqual([]);
    });
  });

  describe("isDisabled", () => {
    it("returns true for a disabled plugin", async () => {
      await addDisabledPlugin(makePlugin({ name: "disabled-one" }));

      expect(await isDisabled("disabled-one")).toBe(true);
    });

    it("returns false for a non-disabled plugin", async () => {
      expect(await isDisabled("not-disabled")).toBe(false);
    });

    it("returns false after plugin is removed from registry", async () => {
      await addDisabledPlugin(makePlugin({ name: "temp-disabled" }));
      await removeDisabledPlugin("temp-disabled");

      expect(await isDisabled("temp-disabled")).toBe(false);
    });
  });

  describe("getDisabledPlugin", () => {
    it("returns the plugin when it exists", async () => {
      const plugin = makePlugin({ name: "my-plugin", version: "3.0.0" });
      await addDisabledPlugin(plugin);

      const result = await getDisabledPlugin("my-plugin");
      expect(result).toEqual(plugin);
    });

    it("returns null when plugin does not exist", async () => {
      const result = await getDisabledPlugin("missing");
      expect(result).toBeNull();
    });

    it("returns null for empty registry", async () => {
      const result = await getDisabledPlugin("anything");
      expect(result).toBeNull();
    });
  });
});
