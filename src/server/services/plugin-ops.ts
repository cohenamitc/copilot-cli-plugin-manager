import { readFile, writeFile, mkdir, rm, cp, access, readdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import type { InstalledPluginEntry, PluginMetadata, MarketplaceInfo, MarketplaceSource } from "../types.js";

const execFileAsync = promisify(execFile);

const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const CONFIG_PATH = path.join(COPILOT_DIR, "config.json");
const SETTINGS_PATH = path.join(COPILOT_DIR, "settings.json");
const INSTALLED_PLUGINS_DIR = path.join(COPILOT_DIR, "installed-plugins");
const MARKETPLACE_CACHE_DIR = path.join(COPILOT_DIR, "marketplace-cache");

const DEFAULT_MARKETPLACES: Record<string, MarketplaceSource> = {
  "copilot-plugins": { source: "github", repo: "github/copilot-plugins" },
  "awesome-copilot": { source: "github", repo: "github/awesome-copilot" },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripJsonComments(text: string): string {
  return text.replace(/^\s*\/\/.*$/gm, "");
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(stripJsonComments(content)) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function getMarketplaces(): Promise<MarketplaceInfo[]> {
  const settings = await readJsonFile<{
    extraKnownMarketplaces?: Record<string, { source: MarketplaceSource }>;
  }>(SETTINGS_PATH);

  const marketplaces: MarketplaceInfo[] = [];

  for (const [name, source] of Object.entries(DEFAULT_MARKETPLACES)) {
    marketplaces.push({ name, source, isDefault: true });
  }

  if (settings?.extraKnownMarketplaces) {
    for (const [name, config] of Object.entries(settings.extraKnownMarketplaces)) {
      if (!DEFAULT_MARKETPLACES[name]) {
        marketplaces.push({
          name,
          source: config.source,
          isDefault: false,
        });
      }
    }
  }

  return marketplaces;
}

async function findCacheDir(marketplace: MarketplaceInfo): Promise<string | null> {
  const candidates: string[] = [marketplace.name];
  if (marketplace.source.repo) {
    candidates.push(marketplace.source.repo.replace("/", "-"));
    const repoName = marketplace.source.repo.split("/").pop();
    if (repoName && !candidates.includes(repoName)) candidates.push(repoName);
  }
  if (marketplace.source.url) {
    const repoName = marketplace.source.url.split("/").pop()?.replace(".git", "");
    if (repoName && !candidates.includes(repoName)) candidates.push(repoName);
  }
  for (const name of candidates) {
    const dir = path.join(MARKETPLACE_CACHE_DIR, name);
    if (await fileExists(dir)) return dir;
  }
  // Fallback: fuzzy match on cache dir names
  try {
    const entries = await readdir(MARKETPLACE_CACHE_DIR);
    const searchTerms = candidates.map((c) => c.toLowerCase());
    for (const entry of entries) {
      const lower = entry.toLowerCase();
      if (searchTerms.some((term) => lower.includes(term) || term.includes(lower))) {
        return path.join(MARKETPLACE_CACHE_DIR, entry);
      }
    }
  } catch { /* ignore */ }
  return null;
}

interface ResolvedPlugin {
  sourcePath: string;
  pluginName: string;
  marketplace: string;
  isTemporary: boolean;
}

interface PluginSourceDef {
  source?: string;
  repo?: string;
  path?: string;
}

// Read the marketplace catalog to find a plugin's source definition
async function findPluginInCatalog(
  pluginName: string,
  marketplace: MarketplaceInfo
): Promise<string | PluginSourceDef | null> {
  const catalogPaths: string[] = [];

  // Check marketplace-cache for catalog
  const cacheDir = await findCacheDir(marketplace);
  if (cacheDir) {
    catalogPaths.push(
      path.join(cacheDir, ".github", "plugin", "marketplace.json"),
      path.join(cacheDir, ".claude-plugin", "marketplace.json"),
    );
  }

  // Also check local path if applicable
  if (marketplace.source.url && (marketplace.source.source === "local" || marketplace.source.url.startsWith("/"))) {
    catalogPaths.push(
      path.join(marketplace.source.url, ".github", "plugin", "marketplace.json"),
      path.join(marketplace.source.url, ".claude-plugin", "marketplace.json"),
    );
  }

  for (const catalogPath of catalogPaths) {
    const catalog = await readJsonFile<{ plugins: Array<{ name: string; source: string | PluginSourceDef }> }>(catalogPath);
    if (catalog) {
      const plugin = catalog.plugins.find((p) => p.name === pluginName);
      if (plugin) return plugin.source;
    }
  }

  // For GitHub marketplaces without local cache, fetch catalog via `gh api`
  if (marketplace.source.repo) {
    try {
      for (const apiPath of [".github/plugin/marketplace.json", ".claude-plugin/marketplace.json"]) {
        try {
          const { stdout } = await execFileAsync("gh", [
            "api", `repos/${marketplace.source.repo}/contents/${apiPath}`,
            "--jq", ".content",
          ], { timeout: 30_000 });
          const decoded = Buffer.from(stdout.trim(), "base64").toString("utf-8");
          const catalog = JSON.parse(decoded) as { plugins: Array<{ name: string; source: string | PluginSourceDef }> };
          const plugin = catalog.plugins.find((p) => p.name === pluginName);
          if (plugin) return plugin.source;
        } catch { /* try next path */ }
      }
    } catch { /* ignore */ }
  }

  return null;
}

async function resolvePluginSource(source: string): Promise<ResolvedPlugin> {
  // Format: name@marketplace
  if (source.includes("@")) {
    const [pluginName, marketplaceName] = source.split("@");
    const marketplaces = await getMarketplaces();
    const marketplace = marketplaces.find((m) => m.name === marketplaceName);

    if (!marketplace) {
      throw new Error(`Marketplace "${marketplaceName}" not found`);
    }

    // First, try to read the marketplace catalog to find the plugin's source definition
    const pluginSourceDef = await findPluginInCatalog(pluginName, marketplace);

    // If the plugin has its own repo (e.g., awesome-copilot plugins), clone from there
    if (pluginSourceDef && typeof pluginSourceDef === "object" && pluginSourceDef.repo) {
      const tmpDir = path.join(COPILOT_DIR, "tmp", `clone-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const repoUrl = pluginSourceDef.repo.startsWith("http")
        ? pluginSourceDef.repo
        : `https://github.com/${pluginSourceDef.repo}.git`;
      try {
        await execFileAsync("git", ["clone", "--depth", "1", repoUrl, tmpDir], { timeout: 60_000 });
        const pluginPath = pluginSourceDef.path ? path.join(tmpDir, pluginSourceDef.path) : tmpDir;
        if (await fileExists(pluginPath)) {
          return { sourcePath: pluginPath, pluginName, marketplace: marketplaceName, isTemporary: true };
        }
        // If specific path doesn't exist, use the repo root
        return { sourcePath: tmpDir, pluginName, marketplace: marketplaceName, isTemporary: true };
      } catch (error) {
        await rm(tmpDir, { recursive: true, force: true });
        throw new Error(`Failed to clone plugin repo: ${error}`);
      }
    }

    // Plugin source is a relative path within the marketplace
    const pluginRelPath = typeof pluginSourceDef === "string" ? pluginSourceDef : `plugins/${pluginName}`;

    // Check marketplace cache
    const cacheDir = await findCacheDir(marketplace);
    if (cacheDir) {
      for (const tryPath of [pluginRelPath, `plugins/${pluginName}`, pluginName]) {
        const pluginPath = path.join(cacheDir, tryPath);
        if (await fileExists(pluginPath)) {
          return { sourcePath: pluginPath, pluginName, marketplace: marketplaceName, isTemporary: false };
        }
      }
    }

    // If marketplace is local path
    if (marketplace.source.source === "local" && marketplace.source.url) {
      for (const tryPath of [pluginRelPath, `plugins/${pluginName}`, pluginName]) {
        const localPath = path.join(marketplace.source.url, tryPath);
        if (await fileExists(localPath)) {
          return { sourcePath: localPath, pluginName, marketplace: marketplaceName, isTemporary: false };
        }
      }
    }

    // If marketplace is GitHub, clone it to temp and find the plugin
    if (marketplace.source.repo) {
      const tmpDir = path.join(COPILOT_DIR, "tmp", `clone-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });

      try {
        await execFileAsync("git", [
          "clone", "--depth", "1",
          `https://github.com/${marketplace.source.repo}.git`, tmpDir,
        ], { timeout: 60_000 });

        for (const tryPath of [pluginRelPath, `plugins/${pluginName}`, pluginName]) {
          const pluginPath = path.join(tmpDir, tryPath);
          if (await fileExists(pluginPath)) {
            return { sourcePath: pluginPath, pluginName, marketplace: marketplaceName, isTemporary: true };
          }
        }
      } catch (error) {
        await rm(tmpDir, { recursive: true, force: true });
        throw new Error(`Failed to clone marketplace: ${error}`);
      }
    }

    throw new Error(`Plugin "${pluginName}" not found in marketplace "${marketplaceName}"`);
  }

  // Format: owner/repo or URL
  if (source.includes("/") || source.startsWith("http")) {
    const tmpDir = path.join(COPILOT_DIR, "tmp", `clone-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    let repoUrl = source;
    if (!source.startsWith("http")) {
      repoUrl = `https://github.com/${source}.git`;
    }

    try {
      await execFileAsync("git", ["clone", "--depth", "1", repoUrl, tmpDir]);

      // Read plugin.json to get name
      const pluginJsonPath = path.join(tmpDir, ".claude-plugin", "plugin.json");
      const pluginMeta = await readJsonFile<PluginMetadata>(pluginJsonPath);
      const pluginName = pluginMeta?.name ?? source.split("/").pop()?.replace(".git", "") ?? "unknown";

      return {
        sourcePath: tmpDir,
        pluginName,
        marketplace: "github",
        isTemporary: true,
      };
    } catch (error) {
      await rm(tmpDir, { recursive: true, force: true });
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  throw new Error(`Invalid plugin source format: ${source}`);
}

export async function installPlugin(source: string): Promise<{ success: boolean; message: string }> {
  try {
    let resolved: ResolvedPlugin | null = null;
    try {
      resolved = await resolvePluginSource(source);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }

    // Create destination directory
    const destDir = path.join(INSTALLED_PLUGINS_DIR, resolved.marketplace, resolved.pluginName);
    await mkdir(path.dirname(destDir), { recursive: true });

    // Copy plugin files
    await cp(resolved.sourcePath, destDir, { recursive: true });

    // Clean up temp if needed
    if (resolved.isTemporary) {
      const tmpParent = path.dirname(resolved.sourcePath);
      await rm(tmpParent, { recursive: true, force: true });
    }

    // Read plugin metadata
    const pluginJsonPath = path.join(destDir, ".claude-plugin", "plugin.json");
    const pluginMeta = await readJsonFile<PluginMetadata>(pluginJsonPath);
    const version = pluginMeta?.version ?? "1.0.0";

    // Update config.json
    const config = await readJsonFile<{
      installedPlugins?: InstalledPluginEntry[];
    }>(CONFIG_PATH);

    const installedPlugins = config?.installedPlugins ?? [];
    const existingIndex = installedPlugins.findIndex(
      (p) => p.name === resolved!.pluginName && p.marketplace === resolved!.marketplace
    );

    const entry: InstalledPluginEntry = {
      name: resolved.pluginName,
      marketplace: resolved.marketplace,
      version,
      installed_at: new Date().toISOString(),
      enabled: true,
      cache_path: destDir,
    };

    if (existingIndex >= 0) {
      installedPlugins[existingIndex] = entry;
    } else {
      installedPlugins.push(entry);
    }

    await writeJsonFile(CONFIG_PATH, { ...config, installedPlugins });

    // Update settings.json
    const settings = await readJsonFile<{
      enabledPlugins?: Record<string, boolean>;
    }>(SETTINGS_PATH);

    const enabledPlugins = settings?.enabledPlugins ?? {};
    enabledPlugins[`${resolved.pluginName}@${resolved.marketplace}`] = true;

    await writeJsonFile(SETTINGS_PATH, { ...settings, enabledPlugins });

    return {
      success: true,
      message: `Plugin "${resolved.pluginName}" installed successfully`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function uninstallPlugin(
  nameWithMarketplace: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Parse name@marketplace or just name
    let pluginName = nameWithMarketplace;
    let marketplaceName: string | undefined;

    if (nameWithMarketplace.includes("@")) {
      [pluginName, marketplaceName] = nameWithMarketplace.split("@");
    }

    // Read config to find the plugin
    const config = await readJsonFile<{
      installedPlugins?: InstalledPluginEntry[];
    }>(CONFIG_PATH);

    const installedPlugins = config?.installedPlugins ?? [];
    const pluginEntry = installedPlugins.find(
      (p) => p.name === pluginName && (!marketplaceName || p.marketplace === marketplaceName)
    );

    if (!pluginEntry) {
      return {
        success: false,
        message: `Plugin "${nameWithMarketplace}" not found`,
      };
    }

    // Remove plugin directory
    const pluginDir = path.join(INSTALLED_PLUGINS_DIR, pluginEntry.marketplace, pluginEntry.name);
    if (await fileExists(pluginDir)) {
      await rm(pluginDir, { recursive: true, force: true });
    }

    // Update config.json
    const updatedPlugins = installedPlugins.filter(
      (p) => !(p.name === pluginEntry.name && p.marketplace === pluginEntry.marketplace)
    );
    await writeJsonFile(CONFIG_PATH, { ...config, installedPlugins: updatedPlugins });

    // Update settings.json
    const settings = await readJsonFile<{
      enabledPlugins?: Record<string, boolean>;
    }>(SETTINGS_PATH);

    const enabledPlugins = settings?.enabledPlugins ?? {};
    delete enabledPlugins[`${pluginEntry.name}@${pluginEntry.marketplace}`];

    await writeJsonFile(SETTINGS_PATH, { ...settings, enabledPlugins });

    return {
      success: true,
      message: `Plugin "${pluginEntry.name}" uninstalled successfully`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updatePlugin(
  nameWithMarketplace: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Parse name@marketplace or just name
    let pluginName = nameWithMarketplace;
    let marketplaceName: string | undefined;

    if (nameWithMarketplace.includes("@")) {
      [pluginName, marketplaceName] = nameWithMarketplace.split("@");
    }

    // Read config to find the plugin
    const config = await readJsonFile<{
      installedPlugins?: InstalledPluginEntry[];
    }>(CONFIG_PATH);

    const installedPlugins = config?.installedPlugins ?? [];
    const pluginEntry = installedPlugins.find(
      (p) => p.name === pluginName && (!marketplaceName || p.marketplace === marketplaceName)
    );

    if (!pluginEntry) {
      return {
        success: false,
        message: `Plugin "${nameWithMarketplace}" not found`,
      };
    }

    // Uninstall and reinstall
    const source = `${pluginEntry.name}@${pluginEntry.marketplace}`;
    await uninstallPlugin(source);
    return await installPlugin(source);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
