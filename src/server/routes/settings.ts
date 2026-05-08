import { Router } from "express";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import type { AppSettings } from "../types.js";

const router = Router();

const PLUGIN_DATA_DIR = path.join(os.homedir(), ".copilot", "plugin-data", "copilot-cli-plugin-manager");
const SETTINGS_FILE = path.join(PLUGIN_DATA_DIR, "settings.json");

const DEFAULT_SETTINGS: AppSettings = { theme: "light" };

async function readSettings(): Promise<AppSettings> {
  try {
    const content = await readFile(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  await mkdir(PLUGIN_DATA_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

router.get("/", async (_req, res) => {
  const settings = await readSettings();
  res.json(settings);
});

router.put("/", async (req, res) => {
  try {
    const current = await readSettings();
    const updated = { ...current, ...req.body } as AppSettings;

    const validThemes = ["light", "dark", "copilot"];
    if (!validThemes.includes(updated.theme)) {
      res.status(400).json({ error: "Invalid theme. Must be light, dark, or copilot." });
      return;
    }

    await writeSettings(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
