import { readFile, readdir, access } from "fs/promises";
import path from "path";
import os from "os";
import type { MarketplaceInfo, MarketplaceCatalog, MarketplacePlugin, MarketplaceSource, PluginMetadata } from "../types.js";
import { getInstalledPlugins } from "./plugin-reader.js";

const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const SETTINGS_PATH = path.join(COPILOT_DIR, "settings.json");
const MARKETPLACE_CACHE_DIR = path.join(COPILOT_DIR, "marketplace-cache");
const INSTALLED_PLUGINS_DIR = path.join(COPILOT_DIR, "installed-plugins");

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

export async function getMarketplaces(): Promise<MarketplaceInfo[]> {
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
  // Build list of candidate dir names
  const candidates: string[] = [marketplace.name];

  if (marketplace.source.repo) {
    candidates.push(marketplace.source.repo.replace("/", "-"));
    // Also try just the repo name part
    const repoName = marketplace.source.repo.split("/").pop();
    if (repoName && !candidates.includes(repoName)) candidates.push(repoName);
  }

  if (marketplace.source.url) {
    const repoName = marketplace.source.url.split("/").pop()?.replace(".git", "");
    if (repoName && !candidates.includes(repoName)) candidates.push(repoName);
  }

  // Check each candidate
  for (const name of candidates) {
    const dir = path.join(MARKETPLACE_CACHE_DIR, name);
    if (await fileExists(dir)) return dir;
  }

  // Fallback: scan cache dir for any directory containing the repo/marketplace name
  try {
    const entries = await readdir(MARKETPLACE_CACHE_DIR);
    const searchTerms = candidates.map((c) => c.toLowerCase());
    for (const entry of entries) {
      const lower = entry.toLowerCase();
      if (searchTerms.some((term) => lower.includes(term) || term.includes(lower))) {
        const dir = path.join(MARKETPLACE_CACHE_DIR, entry);
        if (await fileExists(dir)) return dir;
      }
    }
  } catch { /* cache dir may not exist */ }

  return null;
}

async function findMarketplaceJson(cacheDir: string): Promise<MarketplaceCatalog | null> {
  const githubPath = path.join(cacheDir, ".github", "plugin", "marketplace.json");
  const claudePath = path.join(cacheDir, ".claude-plugin", "marketplace.json");

  if (await fileExists(githubPath)) {
    return readJsonFile<MarketplaceCatalog>(githubPath);
  }
  if (await fileExists(claudePath)) {
    return readJsonFile<MarketplaceCatalog>(claudePath);
  }
  return null;
}

// Scan installed-plugins/<marketplace>/ for plugin dirs, reading each plugin.json
async function scanInstalledPluginDirs(marketplaceName: string): Promise<MarketplacePlugin[]> {
  const marketplaceDir = path.join(INSTALLED_PLUGINS_DIR, marketplaceName);
  if (!(await fileExists(marketplaceDir))) return [];

  try {
    const entries = await readdir(marketplaceDir, { withFileTypes: true });
    const plugins: MarketplacePlugin[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(marketplaceDir, entry.name);
      const pluginJson = await readJsonFile<PluginMetadata>(
        path.join(pluginDir, ".claude-plugin", "plugin.json")
      );

      plugins.push({
        name: pluginJson?.name ?? entry.name,
        description: pluginJson?.description,
        version: pluginJson?.version,
        source: pluginDir,
        author: pluginJson?.author,
        keywords: pluginJson?.keywords,
        category: pluginJson?.category,
        installed: true,
        marketplace: marketplaceName,
      });
    }
    return plugins;
  } catch {
    return [];
  }
}

// Search for marketplace.json inside installed-plugins/<marketplace>/<plugin>/
async function findInstalledMarketplaceJson(marketplaceName: string): Promise<MarketplaceCatalog | null> {
  const marketplaceDir = path.join(INSTALLED_PLUGINS_DIR, marketplaceName);
  if (!(await fileExists(marketplaceDir))) return null;

  try {
    const entries = await readdir(marketplaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(marketplaceDir, entry.name);
      const catalog = await findMarketplaceJson(pluginDir);
      if (catalog) return catalog;
    }
  } catch { /* ignore */ }
  return null;
}

function mapCatalogPlugins(
  catalog: MarketplaceCatalog,
  marketplaceName: string,
  installedNames: Set<string>
): MarketplacePlugin[] {
  return catalog.plugins.map((plugin) => ({
    name: plugin.name,
    description: (plugin as unknown as Record<string, unknown>).description as string | undefined,
    version: (plugin as unknown as Record<string, unknown>).version as string | undefined,
    source: (plugin as unknown as Record<string, unknown>).source as string,
    author: (plugin as unknown as Record<string, unknown>).author as { name: string; email?: string } | undefined,
    keywords: (plugin as unknown as Record<string, unknown>).keywords as string[] | undefined,
    category: (plugin as unknown as Record<string, unknown>).category as string | undefined,
    installed: installedNames.has(plugin.name),
    marketplace: marketplaceName,
  }));
}

// Fetch marketplace.json from GitHub using `gh api` for authenticated access
async function fetchMarketplaceFromGitHub(repo: string): Promise<MarketplaceCatalog | null> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { GH_BIN } = await import("./bin-resolver.js");
  const execFileAsync = promisify(execFile);

  const paths = [
    `.github/plugin/marketplace.json`,
    `.claude-plugin/marketplace.json`,
  ];

  for (const filePath of paths) {
    try {
      const { stdout } = await execFileAsync(GH_BIN, [
        "api",
        `repos/${repo}/contents/${filePath}`,
        "--jq", ".content",
      ], { timeout: 30_000 });

      const decoded = Buffer.from(stdout.trim(), "base64").toString("utf-8");
      return JSON.parse(decoded) as MarketplaceCatalog;
    } catch { /* try next path */ }
  }
  return null;
}

export async function getMarketplacePlugins(
  marketplaceName: string
): Promise<MarketplacePlugin[]> {
  const marketplaces = await getMarketplaces();
  const marketplace = marketplaces.find((m) => m.name === marketplaceName);
  if (!marketplace) return [];

  const installed = await getInstalledPlugins();
  const installedNames = new Set(installed.map((p) => p.name));

  // Strategy 1: Check marketplace-cache directory for catalog
  const cacheDir = await findCacheDir(marketplace);

  if (cacheDir) {
    const catalog = await findMarketplaceJson(cacheDir);
    if (catalog) {
      return mapCatalogPlugins(catalog, marketplaceName, installedNames);
    }
  }

  // Strategy 1b: For local-source marketplaces, check the URL as a directory path
  if (marketplace.source.url && (marketplace.source.source === "local" || marketplace.source.url.startsWith("/"))) {
    const localDir = marketplace.source.url;
    if (await fileExists(localDir)) {
      const catalog = await findMarketplaceJson(localDir);
      if (catalog) {
        return mapCatalogPlugins(catalog, marketplaceName, installedNames);
      }
    }
  }

  // Strategy 3: Scan installed-plugins/<marketplace>/ dirs for individual plugin.json files
  const scanned = await scanInstalledPluginDirs(marketplaceName);

  // Strategy 4: For github-source marketplaces, fetch catalog from GitHub API
  // This is preferred over installed catalogs since it has the complete plugin list
  let remoteCatalog: MarketplaceCatalog | null = null;
  if (marketplace.source.repo) {
    remoteCatalog = await fetchMarketplaceFromGitHub(marketplace.source.repo);
  } else if (marketplace.source.url) {
    // Try to extract GitHub repo from git URL (e.g., https://github.com/org/repo.git)
    const ghMatch = marketplace.source.url.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (ghMatch) {
      remoteCatalog = await fetchMarketplaceFromGitHub(ghMatch[1]);
    }
  }

  if (remoteCatalog) {
    const catalogPlugins = mapCatalogPlugins(remoteCatalog, marketplaceName, installedNames);
    // Merge: prefer catalog info but include installed-only plugins too
    const catalogNames = new Set(catalogPlugins.map((p) => p.name));
    const mergedPlugins = [...catalogPlugins];
    for (const p of scanned) {
      if (!catalogNames.has(p.name)) mergedPlugins.push(p);
    }
    return mergedPlugins;
  }

  // Strategy 5: Check installed-plugins/<marketplace>/<plugin>/ for embedded marketplace.json
  // This is a last resort since installed plugins may bundle partial catalogs
  const installedCatalog = await findInstalledMarketplaceJson(marketplaceName);
  if (installedCatalog) {
    return mapCatalogPlugins(installedCatalog, marketplaceName, installedNames);
  }

  return scanned.length > 0 ? scanned : [];
}

export async function browseAllMarketplaces(): Promise<MarketplacePlugin[]> {
  const marketplaces = await getMarketplaces();
  const allPlugins: MarketplacePlugin[] = [];

  for (const marketplace of marketplaces) {
    const plugins = await getMarketplacePlugins(marketplace.name);
    allPlugins.push(...plugins);
  }

  return allPlugins;
}
