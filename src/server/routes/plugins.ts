import { Router } from "express";
import { getInstalledPlugins, getPluginDetails } from "../services/plugin-reader.js";
import { installPlugin, uninstallPlugin, updatePlugin } from "../services/plugin-ops.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const entries = await getInstalledPlugins();
    const plugins = await Promise.all(
      entries.map(async (entry) => {
        const details = await getPluginDetails(entry);
        return {
          name: details.name,
          marketplace: entry.marketplace,
          version: details.version,
          installed_at: entry.installed_at,
          enabled: entry.enabled,
          description: details.description,
          author: details.author,
          keywords: details.keywords,
          category: details.category,
          skillCount: details.skills.length,
          agentCount: details.agents.length,
          hookCount: details.hooks.length,
          mcpCount: details.mcpServers.length,
        };
      })
    );
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: "Failed to read installed plugins" });
  }
});

router.get("/:name/details", async (req, res) => {
  try {
    const entries = await getInstalledPlugins();
    const entry = entries.find((e) => e.name === req.params.name);
    if (!entry) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }
    const details = await getPluginDetails(entry);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: "Failed to read plugin details" });
  }
});

router.post("/install", async (req, res) => {
  const { source } = req.body as { source: string };
  if (!source) {
    res.status(400).json({ error: "source is required" });
    return;
  }

  const result = await installPlugin(source);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

router.delete("/:name", async (req, res) => {
  const pluginName = req.params.name;
  const result = await uninstallPlugin(pluginName);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

router.post("/:name/update", async (req, res) => {
  const pluginName = req.params.name;
  const result = await updatePlugin(pluginName);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

export default router;
