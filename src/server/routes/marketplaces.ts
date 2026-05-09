import { Router } from "express";
import { getMarketplaces, getMarketplacePlugins, browseAllMarketplaces } from "../services/marketplace-reader.js";
import { addMarketplace, removeMarketplace, refreshMarketplaces } from "../services/marketplace-ops.js";
import { getDisabledPlugins } from "../services/disabled-registry.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const marketplaces = await getMarketplaces();
    res.json(marketplaces);
  } catch (error) {
    res.status(500).json({ error: "Failed to read marketplaces" });
  }
});

router.get("/browse", async (req, res) => {
  try {
    const { search, marketplace: marketplaceFilter } = req.query;
    let plugins = marketplaceFilter
      ? await getMarketplacePlugins(marketplaceFilter as string)
      : await browseAllMarketplaces();

    if (search) {
      const searchLower = (search as string).toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          p.keywords?.some((k) => k.toLowerCase().includes(searchLower))
      );
    }

    // Annotate disabled plugins
    const disabled = await getDisabledPlugins();
    const disabledNames = new Set(disabled.map((d) => d.name));
    const annotated = plugins.map((p) => ({
      ...p,
      disabled: disabledNames.has(p.name),
    }));

    res.json(annotated);
  } catch (error) {
    res.status(500).json({ error: "Failed to browse marketplace plugins" });
  }
});

router.get("/:name/plugins", async (req, res) => {
  try {
    const plugins = await getMarketplacePlugins(req.params.name);
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: "Failed to read marketplace plugins" });
  }
});

router.post("/:name/fetch", async (req, res) => {
  try {
    const result = await refreshMarketplaces(req.params.name);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch marketplace catalog" });
  }
});

router.post("/", async (req, res) => {
  const { source } = req.body as { source: string };
  if (!source) {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const result = await addMarketplace(source);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

router.delete("/:name", async (req, res) => {
  const result = await removeMarketplace(req.params.name);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

router.post("/refresh", async (req, res) => {
  const { name } = req.body as { name?: string };
  const result = await refreshMarketplaces(name);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(500).json({ success: false, error: result.message });
  }
});

export default router;
