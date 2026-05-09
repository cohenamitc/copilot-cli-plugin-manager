import { Router } from "express";
import { getInstalledPlugins, getPluginDetails } from "../services/plugin-reader.js";
import { installPlugin, uninstallPlugin, updatePlugin } from "../services/cli-executor.js";
import { getDisabledPlugins, addDisabledPlugin, removeDisabledPlugin, getDisabledPlugin } from "../services/disabled-registry.js";
import { getMarketplacePlugins } from "../services/marketplace-reader.js";
import type { DisabledPlugin } from "../types.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const entries = await getInstalledPlugins();
    const installedNames = new Set(entries.map((e) => e.name));

    const plugins = await Promise.all(
      entries.map(async (entry) => {
        const details = await getPluginDetails(entry);
        return {
          name: details.name,
          marketplace: entry.marketplace,
          version: details.version,
          installed_at: entry.installed_at,
          enabled: entry.enabled,
          disabled: false,
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

    // Merge disabled plugins that aren't currently installed
    const disabled = await getDisabledPlugins();
    for (const dp of disabled) {
      if (!installedNames.has(dp.name)) {
        plugins.push({
          name: dp.name,
          marketplace: dp.marketplace,
          version: dp.version,
          installed_at: dp.disabledAt,
          enabled: false,
          disabled: true,
          description: dp.description,
          author: undefined,
          keywords: undefined,
          category: undefined,
          skillCount: dp.skillCount,
          agentCount: dp.agentCount,
          hookCount: dp.hookCount,
          mcpCount: dp.mcpCount,
        });
      }
    }

    // Reconcile: if a plugin is both installed and in disabled registry, remove from registry
    for (const name of installedNames) {
      await removeDisabledPlugin(name);
    }

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
    res.json({ success: true, message: result.stdout || `Plugin installed successfully` });
  } else {
    res.status(500).json({ success: false, error: result.stderr || result.stdout || "Install failed" });
  }
});

router.delete("/:name", async (req, res) => {
  const pluginName = req.params.name;
  const result = await uninstallPlugin(pluginName);
  if (result.success) {
    res.json({ success: true, message: result.stdout || `Plugin uninstalled successfully` });
  } else {
    res.status(500).json({ success: false, error: result.stderr || result.stdout || "Uninstall failed" });
  }
});

router.post("/:name/update", async (req, res) => {
  const pluginName = req.params.name;
  const result = await updatePlugin(pluginName);
  if (result.success) {
    res.json({ success: true, message: result.stdout || `Plugin updated successfully` });
  } else {
    res.status(500).json({ success: false, error: result.stderr || result.stdout || "Update failed" });
  }
});

router.post("/:name/disable", async (req, res) => {
  const pluginName = req.params.name;
  try {
    // Gather plugin metadata before uninstalling
    const entries = await getInstalledPlugins();
    const entry = entries.find((e) => e.name === pluginName);
    if (!entry) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    const details = await getPluginDetails(entry);

    // Resolve install source from marketplace catalog
    let source = "";
    try {
      const marketplacePlugins = await getMarketplacePlugins(entry.marketplace);
      const mp = marketplacePlugins.find((p) => p.name === pluginName);
      if (mp) source = mp.source;
    } catch { /* best effort */ }

    const disabled: DisabledPlugin = {
      name: pluginName,
      marketplace: entry.marketplace,
      source,
      version: details.version,
      description: details.description,
      disabledAt: new Date().toISOString(),
      skillCount: details.skills.length,
      agentCount: details.agents.length,
      hookCount: details.hooks.length,
      mcpCount: details.mcpServers.length,
    };

    // Uninstall the plugin
    const result = await uninstallPlugin(pluginName);
    if (!result.success) {
      res.status(500).json({ success: false, error: result.stderr || result.stdout || "Uninstall failed" });
      return;
    }

    // Save to disabled registry
    await addDisabledPlugin(disabled);
    res.json({ success: true, message: `Plugin ${pluginName} disabled` });
  } catch (error) {
    res.status(500).json({ error: "Failed to disable plugin" });
  }
});

router.post("/:name/enable", async (req, res) => {
  const pluginName = req.params.name;
  try {
    const disabled = await getDisabledPlugin(pluginName);
    if (!disabled) {
      res.status(404).json({ error: "Plugin not found in disabled registry" });
      return;
    }

    // Reinstall using plugin-name@marketplace format
    const installSpec = disabled.marketplace
      ? `${pluginName}@${disabled.marketplace}`
      : disabled.source;

    if (!installSpec) {
      res.status(400).json({ error: "No install source available for this plugin. Try installing manually from the marketplace." });
      return;
    }

    const result = await installPlugin(installSpec);
    if (!result.success) {
      res.status(500).json({ success: false, error: result.stderr || result.stdout || "Install failed" });
      return;
    }

    await removeDisabledPlugin(pluginName);
    res.json({ success: true, message: `Plugin ${pluginName} enabled` });
  } catch (error) {
    res.status(500).json({ error: "Failed to enable plugin" });
  }
});

export default router;
