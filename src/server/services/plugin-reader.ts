import { readFile, readdir, access } from "fs/promises";
import path from "path";
import os from "os";
import type { InstalledPluginEntry, PluginMetadata, PluginDetails, PluginComponent } from "../types.js";

const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const CONFIG_PATH = path.join(COPILOT_DIR, "config.json");

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

export async function getInstalledPlugins(): Promise<InstalledPluginEntry[]> {
  const config = await readJsonFile<{ installedPlugins?: InstalledPluginEntry[] }>(CONFIG_PATH);
  return config?.installedPlugins ?? [];
}

async function readPluginJson(cachePath: string): Promise<PluginMetadata | null> {
  // Check multiple possible locations for plugin.json
  const paths = [
    path.join(cachePath, ".claude-plugin", "plugin.json"),
    path.join(cachePath, ".github", "plugin", "plugin.json"),
  ];
  for (const p of paths) {
    const meta = await readJsonFile<PluginMetadata>(p);
    if (meta) return meta;
  }
  return null;
}

async function scanDirectory(dirPath: string): Promise<PluginComponent[]> {
  if (!(await fileExists(dirPath))) return [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const components: PluginComponent[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Pattern 1: directory with optional SKILL.md inside
        const skillMdPath = path.join(dirPath, entry.name, "SKILL.md");
        const hasSkillMd = await fileExists(skillMdPath);
        let description: string | undefined;

        if (hasSkillMd) {
          try {
            const content = await readFile(skillMdPath, "utf-8");
            const descMatch = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
            if (descMatch) description = descMatch[1];
          } catch { /* ignore */ }
        }

        components.push({
          name: entry.name,
          description,
          path: path.join(dirPath, entry.name),
        });
      } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
        // Pattern 2: standalone .md file as a component
        const filePath = path.join(dirPath, entry.name);
        const name = entry.name.replace(/\.md$/, "");
        let description: string | undefined;

        try {
          const content = await readFile(filePath, "utf-8");
          // Try frontmatter description
          const descMatch = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
          if (descMatch) {
            description = descMatch[1];
          } else {
            // Try first heading or first non-empty line as description
            const firstHeading = content.match(/^#\s+(.+)$/m);
            if (firstHeading) description = firstHeading[1];
          }
        } catch { /* ignore */ }

        components.push({ name, description, path: filePath });
      }
    }
    return components;
  } catch {
    return [];
  }
}

async function scanSkills(cachePath: string): Promise<PluginComponent[]> {
  return scanDirectory(path.join(cachePath, "skills"));
}

async function scanAgents(cachePath: string): Promise<PluginComponent[]> {
  return scanDirectory(path.join(cachePath, "agents"));
}

async function scanHooks(cachePath: string): Promise<PluginComponent[]> {
  const hooksJsonPath = path.join(cachePath, "hooks", "hooks.json");
  if (!(await fileExists(hooksJsonPath))) return [];
  try {
    const content = await readFile(hooksJsonPath, "utf-8");
    const hooks = JSON.parse(content);
    return Object.keys(hooks).map((name) => ({
      name,
      description: `Hook: ${name}`,
      path: hooksJsonPath,
    }));
  } catch {
    return [];
  }
}

async function scanMcpServers(cachePath: string): Promise<PluginComponent[]> {
  const mcpJsonPath = path.join(cachePath, ".mcp.json");
  if (!(await fileExists(mcpJsonPath))) return [];
  try {
    const content = await readFile(mcpJsonPath, "utf-8");
    const mcp = JSON.parse(content);
    const servers = mcp.mcpServers ?? mcp;
    return Object.keys(servers).map((name) => {
      const config = servers[name];
      const type = config.type ?? (config.command ? "local" : config.url ? "http" : "unknown");
      const parts: string[] = [`Type: ${type}`];
      if (config.command) parts.push(`Command: ${config.command} ${(config.args ?? []).join(" ")}`);
      if (config.url) parts.push(`URL: ${config.url}`);
      if (config.tools) parts.push(`Tools: ${Array.isArray(config.tools) ? config.tools.join(", ") : config.tools}`);
      return {
        name,
        description: parts.join(" | "),
        path: mcpJsonPath,
        metadata: {
          type,
          command: config.command,
          args: config.args,
          url: config.url,
          tools: config.tools,
          env: config.env ? Object.keys(config.env) : undefined,
        },
      };
    });
  } catch {
    return [];
  }
}

export async function getPluginDetails(
  entry: InstalledPluginEntry
): Promise<PluginDetails> {
  const cachePath = entry.cache_path;
  const metadata = await readPluginJson(cachePath);
  const [skills, agents, hooks, mcpServers] = await Promise.all([
    scanSkills(cachePath),
    scanAgents(cachePath),
    scanHooks(cachePath),
    scanMcpServers(cachePath),
  ]);

  return {
    name: metadata?.name ?? entry.name,
    version: metadata?.version ?? entry.version,
    description: metadata?.description,
    author: metadata?.author,
    keywords: metadata?.keywords,
    category: metadata?.category,
    homepage: metadata?.homepage,
    repository: metadata?.repository,
    license: metadata?.license,
    marketplace: entry.marketplace,
    installed_at: entry.installed_at,
    enabled: entry.enabled,
    skills,
    agents,
    hooks,
    mcpServers,
  };
}
