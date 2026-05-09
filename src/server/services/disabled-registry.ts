import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import type { DisabledPlugin } from "../types.js";

const PLUGIN_DATA_DIR = path.join(os.homedir(), ".copilot", "plugin-data", "copilot-cli-plugin-manager");
const DISABLED_FILE = path.join(PLUGIN_DATA_DIR, "disabled-plugins.json");

async function readRegistry(): Promise<DisabledPlugin[]> {
  try {
    const content = await readFile(DISABLED_FILE, "utf-8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeRegistry(plugins: DisabledPlugin[]): Promise<void> {
  await mkdir(PLUGIN_DATA_DIR, { recursive: true });
  await writeFile(DISABLED_FILE, JSON.stringify(plugins, null, 2));
}

export async function getDisabledPlugins(): Promise<DisabledPlugin[]> {
  return readRegistry();
}

export async function addDisabledPlugin(plugin: DisabledPlugin): Promise<void> {
  const plugins = await readRegistry();
  const filtered = plugins.filter((p) => p.name !== plugin.name);
  filtered.push(plugin);
  await writeRegistry(filtered);
}

export async function removeDisabledPlugin(name: string): Promise<void> {
  const plugins = await readRegistry();
  await writeRegistry(plugins.filter((p) => p.name !== name));
}

export async function isDisabled(name: string): Promise<boolean> {
  const plugins = await readRegistry();
  return plugins.some((p) => p.name === name);
}

export async function getDisabledPlugin(name: string): Promise<DisabledPlugin | null> {
  const plugins = await readRegistry();
  return plugins.find((p) => p.name === name) ?? null;
}
