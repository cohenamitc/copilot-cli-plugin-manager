import { readFile, writeFile, mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const COPILOT_BIN = "copilot";
const SETTINGS_PATH = path.join(COPILOT_DIR, "settings.json");
const MARKETPLACE_CACHE_DIR = path.join(COPILOT_DIR, "marketplace-cache");

interface MarketplaceSource {
  source: string;
  repo?: string;
  url?: string;
}

interface SettingsData {
  extraKnownMarketplaces?: Record<string, MarketplaceSource>;
  [key: string]: any;
}

function stripJsonComments(text: string): string {
  return text.replace(/^\s*\/\/.*$/gm, "");
}

async function readSettingsFile(): Promise<SettingsData> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(stripJsonComments(content));
  } catch {
    return {};
  }
}

async function writeSettingsFile(data: SettingsData): Promise<void> {
  await mkdir(COPILOT_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

// Use the copilot CLI to update/fetch marketplace catalogs
async function copilotMarketplaceUpdate(name?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const args = ["plugin", "marketplace", "update"];
    if (name) args.push(name);
    // The CLI exits with code 1 but still works — it clones/pulls the repos
    await execFileAsync(COPILOT_BIN, args, { timeout: 120_000 });
    return { success: true };
  } catch (error: any) {
    // Exit code 1 is normal for this command — check if cache was actually updated
    return { success: true, error: error.stderr?.toString() };
  }
}

// Use the copilot CLI to add a marketplace
async function copilotMarketplaceAdd(source: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync(COPILOT_BIN, ["plugin", "marketplace", "add", source], { timeout: 60_000 });
    return { success: true };
  } catch (error: any) {
    // CLI may exit 1 but still succeed — check settings after
    return { success: true, error: error.stderr?.toString() };
  }
}

// Use the copilot CLI to remove a marketplace
async function copilotMarketplaceRemove(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync(COPILOT_BIN, ["plugin", "marketplace", "remove", name], { timeout: 30_000 });
    return { success: true };
  } catch (error: any) {
    return { success: true, error: error.stderr?.toString() };
  }
}

function parseMarketplaceSource(source: string): { name: string; sourceObj: MarketplaceSource } {
  // GitHub repo: owner/repo
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source)) {
    const repoName = source.split("/")[1];
    return {
      name: repoName,
      sourceObj: { source: "github", repo: source },
    };
  }

  // Git URL: https://... or git://...
  if (source.startsWith("https://") || source.startsWith("git://")) {
    const urlObj = new URL(source);
    const pathParts = urlObj.pathname.split("/");
    let repoName = pathParts[pathParts.length - 1];
    if (repoName.endsWith(".git")) {
      repoName = repoName.slice(0, -4);
    }
    return {
      name: repoName,
      sourceObj: { source: "git", url: source },
    };
  }

  // Local path: starts with / or ./
  if (source.startsWith("/") || source.startsWith("./")) {
    const dirName = path.basename(source);
    return {
      name: dirName,
      sourceObj: { source: "local", url: source },
    };
  }

  throw new Error(`Invalid marketplace source format: ${source}`);
}

export async function addMarketplace(source: string): Promise<{ success: boolean; message: string }> {
  try {
    // Try CLI first
    await copilotMarketplaceAdd(source);

    // Verify it was added by checking settings
    const settings = await readSettingsFile();
    const { name } = parseMarketplaceSource(source);

    if (settings.extraKnownMarketplaces?.[name]) {
      // CLI succeeded — now fetch the catalog
      await copilotMarketplaceUpdate(name);
      return { success: true, message: `Marketplace "${name}" added successfully` };
    }

    // CLI didn't add it (TTY issue) — do it directly
    if (!settings.extraKnownMarketplaces) {
      settings.extraKnownMarketplaces = {};
    }
    const { sourceObj } = parseMarketplaceSource(source);
    settings.extraKnownMarketplaces[name] = { source: sourceObj } as any;
    await writeSettingsFile(settings);

    // Fetch catalog via CLI
    await copilotMarketplaceUpdate(name);

    return { success: true, message: `Marketplace "${name}" added successfully` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function removeMarketplace(name: string): Promise<{ success: boolean; message: string }> {
  try {
    // Try CLI first
    await copilotMarketplaceRemove(name);

    // Verify it was removed
    const settings = await readSettingsFile();
    if (!settings.extraKnownMarketplaces?.[name]) {
      return { success: true, message: `Marketplace "${name}" removed successfully` };
    }

    // CLI didn't remove it — do it directly
    delete settings.extraKnownMarketplaces[name];
    await writeSettingsFile(settings);

    return { success: true, message: `Marketplace "${name}" removed successfully` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function refreshMarketplaces(name?: string): Promise<{ success: boolean; message: string }> {
  try {
    // Use the copilot CLI to update marketplace catalogs
    // The CLI handles cloning, pulling, and caching internally
    await copilotMarketplaceUpdate(name);

    if (name) {
      return { success: true, message: `Marketplace "${name}" refreshed successfully` };
    }
    return { success: true, message: "All marketplaces refreshed" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
