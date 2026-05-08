# Copilot CLI Plugin Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone web-based plugin manager UI for GitHub Copilot CLI that wraps all `copilot plugin` and `copilot plugin marketplace` CLI operations with a React SPA + Express backend.

**Architecture:** Monolith SPA — single Express server serves both the REST API and the built React frontend. Queries read `~/.copilot/` config/cache files directly for speed. Mutations shell out to `copilot plugin` CLI commands. Long-running operations stream progress via SSE.

**Tech Stack:** Node.js 20+, TypeScript, Express 4, React 19, Vite 6, React Router 7, TanStack Query 5, CSS Modules

---

## File Map

### Server files
| File | Responsibility |
|------|---------------|
| `src/server/index.ts` | Express entry — mount routes, serve SPA, start server |
| `src/server/types.ts` | Shared TypeScript types for plugins, marketplaces, settings |
| `src/server/services/cli-executor.ts` | Wrap `child_process.execFile` for CLI commands, stream stdout/stderr |
| `src/server/services/plugin-reader.ts` | Read `config.json`, `plugin.json`, scan skills/agents/hooks dirs |
| `src/server/services/marketplace-reader.ts` | Read `settings.json`, `marketplace.json` from cache, merge catalogs |
| `src/server/routes/plugins.ts` | Plugin CRUD endpoints (GET list, POST install, DELETE, POST update, GET details) |
| `src/server/routes/marketplaces.ts` | Marketplace endpoints (GET list, POST add, DELETE, GET browse, POST refresh) |
| `src/server/routes/settings.ts` | Settings endpoints (GET, PUT) |

### Client files
| File | Responsibility |
|------|---------------|
| `src/client/index.html` | HTML entry point for Vite |
| `src/client/main.tsx` | React root — mount App with QueryClient and Router |
| `src/client/App.tsx` | Top-level routes and Layout wrapper |
| `src/client/types.ts` | Frontend TypeScript types (mirrors server types) |
| `src/client/styles/themes.css` | CSS custom properties for light/dark/copilot themes |
| `src/client/styles/global.css` | Reset and base styles |
| `src/client/hooks/usePlugins.ts` | React Query hooks for plugin API |
| `src/client/hooks/useMarketplaces.ts` | React Query hooks for marketplace API |
| `src/client/hooks/useSettings.ts` | Theme hook — reads/writes localStorage + API |
| `src/client/components/Layout/Layout.tsx` | Shell with sidebar + main content area |
| `src/client/components/Layout/Layout.module.css` | Layout styles |
| `src/client/components/Sidebar/Sidebar.tsx` | Navigation sidebar with grouped sections |
| `src/client/components/Sidebar/Sidebar.module.css` | Sidebar styles |
| `src/client/components/common/PluginCard.tsx` | Reusable plugin card (name, version, badges, actions) |
| `src/client/components/common/Badge.tsx` | Small pill badge component |
| `src/client/components/common/SearchBar.tsx` | Search input with filter dropdown |
| `src/client/components/common/EmptyState.tsx` | Empty state message with icon |
| `src/client/components/common/Toast.tsx` | Toast notification for success/error messages |
| `src/client/components/common/common.module.css` | Common component styles |
| `src/client/components/PluginList/PluginList.tsx` | Installed plugins page |
| `src/client/components/PluginList/PluginList.module.css` | PluginList styles |
| `src/client/components/PluginDetail/PluginDetail.tsx` | Plugin detail page with tab navigation |
| `src/client/components/PluginDetail/SkillsTab.tsx` | Skills tab content |
| `src/client/components/PluginDetail/HooksTab.tsx` | Hooks tab content |
| `src/client/components/PluginDetail/AgentsTab.tsx` | Agents tab content |
| `src/client/components/PluginDetail/McpTab.tsx` | MCP servers tab content |
| `src/client/components/PluginDetail/PluginDetail.module.css` | Detail page styles |
| `src/client/components/MarketplaceBrowser/MarketplaceBrowser.tsx` | Browse plugins across marketplaces |
| `src/client/components/MarketplaceBrowser/MarketplaceBrowser.module.css` | Browser styles |
| `src/client/components/MarketplaceList/MarketplaceList.tsx` | Manage registered marketplaces |
| `src/client/components/MarketplaceList/MarketplaceList.module.css` | MarketplaceList styles |
| `src/client/components/AddSource/AddSource.tsx` | Add marketplace form |
| `src/client/components/AddSource/AddSource.module.css` | AddSource styles |
| `src/client/components/Updates/Updates.tsx` | Available plugin updates page |
| `src/client/components/Updates/Updates.module.css` | Updates styles |
| `src/client/components/Settings/Settings.tsx` | Settings page (theme toggle) |
| `src/client/components/Settings/Settings.module.css` | Settings styles |

### Config files
| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts (dev, build, start) |
| `tsconfig.json` | Base TypeScript config |
| `tsconfig.server.json` | Server-specific TS config |
| `vite.config.ts` | Vite config with proxy to Express dev server |
| `.gitignore` | Ignore node_modules, dist, .superpowers |

---

## Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize the project with package.json**

```json
{
  "name": "copilot-cli-plugin-manager",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"tsx watch src/server/index.ts\" \"vite\"",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "server:dev": "tsx watch src/server/index.ts",
    "client:dev": "vite"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.60.0",
    "express": "^4.21.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json (base)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@server/*": ["src/server/*"],
      "@client/*": ["src/client/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tsconfig.server.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist/server",
    "noEmit": false,
    "declaration": true
  },
  "include": ["src/server"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3200",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
});
```

- [ ] **Step 5: Update .gitignore**

Replace `.gitignore` content with:

```
node_modules/
dist/
.superpowers/
*.tsbuildinfo
```

- [ ] **Step 6: Install dependencies**

Run: `cd . && npm install`
Expected: All packages install successfully, `node_modules` and `package-lock.json` are created.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with Vite, Express, React, TypeScript"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/server/types.ts`
- Create: `src/client/types.ts`

- [ ] **Step 1: Create server types**

Create `src/server/types.ts`:

```typescript
export interface PluginAuthor {
  name: string;
  email?: string;
}

export interface InstalledPluginEntry {
  name: string;
  marketplace: string;
  version?: string;
  installed_at: string;
  enabled: boolean;
  cache_path: string;
}

export interface PluginMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  homepage?: string;
  repository?: string;
  license?: string;
}

export interface PluginComponent {
  name: string;
  description?: string;
  path: string;
}

export interface PluginDetails extends PluginMetadata {
  marketplace: string;
  installed_at?: string;
  enabled: boolean;
  skills: PluginComponent[];
  agents: PluginComponent[];
  hooks: PluginComponent[];
  mcpServers: PluginComponent[];
}

export interface MarketplaceSource {
  source: string;
  repo?: string;
  url?: string;
}

export interface MarketplaceInfo {
  name: string;
  source: MarketplaceSource;
  isDefault: boolean;
}

export interface MarketplacePlugin {
  name: string;
  description?: string;
  version?: string;
  source: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  installed: boolean;
}

export interface MarketplaceCatalog {
  name: string;
  metadata?: {
    description?: string;
    version?: string;
  };
  owner?: PluginAuthor;
  plugins: MarketplacePlugin[];
}

export interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AppSettings {
  theme: "light" | "dark" | "copilot";
}
```

- [ ] **Step 2: Create client types**

Create `src/client/types.ts`:

```typescript
export interface PluginAuthor {
  name: string;
  email?: string;
}

export interface InstalledPlugin {
  name: string;
  marketplace: string;
  version?: string;
  installed_at: string;
  enabled: boolean;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  skillCount: number;
  agentCount: number;
  hookCount: number;
  mcpCount: number;
}

export interface PluginComponent {
  name: string;
  description?: string;
  path: string;
}

export interface PluginDetails {
  name: string;
  version?: string;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  marketplace: string;
  installed_at?: string;
  enabled: boolean;
  skills: PluginComponent[];
  agents: PluginComponent[];
  hooks: PluginComponent[];
  mcpServers: PluginComponent[];
}

export interface Marketplace {
  name: string;
  source: { source: string; repo?: string; url?: string };
  isDefault: boolean;
  pluginCount?: number;
}

export interface MarketplacePlugin {
  name: string;
  description?: string;
  version?: string;
  source: string;
  marketplace: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  installed: boolean;
}

export type Theme = "light" | "dark" | "copilot";

export interface AppSettings {
  theme: Theme;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared TypeScript types for plugins, marketplaces, settings"
```

---

## Task 3: Backend Services — CLI Executor

**Files:**
- Create: `src/server/services/cli-executor.ts`

- [ ] **Step 1: Create the CLI executor service**

Create `src/server/services/cli-executor.ts`:

```typescript
import { execFile, spawn } from "child_process";
import type { CliResult } from "../types.js";

const COPILOT_BIN = "copilot";

export function runCliCommand(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(COPILOT_BIN, args, { timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout?.toString() ?? "",
        stderr: stderr?.toString() ?? "",
        exitCode: error?.code ? Number(error.code) : 0,
      });
    });
  });
}

export function streamCliCommand(
  args: string[],
  onData: (data: string) => void,
  onComplete: (result: CliResult) => void
): void {
  const child = spawn(COPILOT_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    onData(text);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    onData(text);
  });

  child.on("close", (code) => {
    onComplete({
      success: code === 0,
      stdout,
      stderr,
      exitCode: code ?? 1,
    });
  });

  child.on("error", (err) => {
    onComplete({
      success: false,
      stdout,
      stderr: stderr + err.message,
      exitCode: 1,
    });
  });
}

export async function installPlugin(source: string): Promise<CliResult> {
  return runCliCommand(["plugin", "install", source]);
}

export async function uninstallPlugin(name: string): Promise<CliResult> {
  return runCliCommand(["plugin", "uninstall", name]);
}

export async function updatePlugin(name: string): Promise<CliResult> {
  return runCliCommand(["plugin", "update", name]);
}

export async function addMarketplace(source: string): Promise<CliResult> {
  return runCliCommand(["plugin", "marketplace", "add", source]);
}

export async function removeMarketplace(name: string): Promise<CliResult> {
  return runCliCommand(["plugin", "marketplace", "remove", name]);
}

export async function refreshMarketplaces(name?: string): Promise<CliResult> {
  const args = ["plugin", "marketplace", "update"];
  if (name) args.push(name);
  return runCliCommand(args);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add CLI executor service for copilot plugin commands"
```

---

## Task 4: Backend Services — Plugin Reader

**Files:**
- Create: `src/server/services/plugin-reader.ts`

- [ ] **Step 1: Create the plugin reader service**

Create `src/server/services/plugin-reader.ts`:

```typescript
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

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function getInstalledPlugins(): Promise<InstalledPluginEntry[]> {
  const config = await readJsonFile<{ installedPlugins?: InstalledPluginEntry[] }>(CONFIG_PATH);
  return config?.installedPlugins ?? [];
}

async function readPluginJson(cachePath: string): Promise<PluginMetadata | null> {
  const pluginJsonPath = path.join(cachePath, ".claude-plugin", "plugin.json");
  return readJsonFile<PluginMetadata>(pluginJsonPath);
}

async function scanDirectory(dirPath: string): Promise<PluginComponent[]> {
  if (!(await fileExists(dirPath))) return [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const components: PluginComponent[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
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
    return Object.keys(servers).map((name) => ({
      name,
      description: `MCP Server: ${name}`,
      path: mcpJsonPath,
    }));
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add plugin reader service for config and metadata"
```

---

## Task 5: Backend Services — Marketplace Reader

**Files:**
- Create: `src/server/services/marketplace-reader.ts`

- [ ] **Step 1: Create the marketplace reader service**

Create `src/server/services/marketplace-reader.ts`:

```typescript
import { readFile, access } from "fs/promises";
import path from "path";
import os from "os";
import type { MarketplaceInfo, MarketplaceCatalog, MarketplacePlugin, MarketplaceSource } from "../types.js";
import { getInstalledPlugins } from "./plugin-reader.js";

const COPILOT_DIR = path.join(os.homedir(), ".copilot");
const SETTINGS_PATH = path.join(COPILOT_DIR, "settings.json");
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

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
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

function getCacheDirName(marketplace: MarketplaceInfo): string {
  if (marketplace.source.repo) {
    return marketplace.source.repo.replace("/", "-");
  }
  const urlStr = marketplace.source.url ?? marketplace.name;
  const repoName = urlStr.split("/").pop()?.replace(".git", "") ?? marketplace.name;
  return repoName;
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

export async function getMarketplacePlugins(
  marketplaceName: string
): Promise<MarketplacePlugin[]> {
  const marketplaces = await getMarketplaces();
  const marketplace = marketplaces.find((m) => m.name === marketplaceName);
  if (!marketplace) return [];

  const cacheDirName = getCacheDirName(marketplace);
  const cacheDir = path.join(MARKETPLACE_CACHE_DIR, cacheDirName);

  if (!(await fileExists(cacheDir))) return [];

  const catalog = await findMarketplaceJson(cacheDir);
  if (!catalog) return [];

  const installed = await getInstalledPlugins();
  const installedNames = new Set(installed.map((p) => p.name));

  return catalog.plugins.map((plugin) => ({
    name: plugin.name,
    description: (plugin as Record<string, unknown>).description as string | undefined,
    version: (plugin as Record<string, unknown>).version as string | undefined,
    source: (plugin as Record<string, unknown>).source as string,
    author: (plugin as Record<string, unknown>).author as { name: string; email?: string } | undefined,
    keywords: (plugin as Record<string, unknown>).keywords as string[] | undefined,
    category: (plugin as Record<string, unknown>).category as string | undefined,
    installed: installedNames.has(plugin.name),
    marketplace: marketplaceName,
  }));
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add marketplace reader service for catalog browsing"
```

---

## Task 6: Backend Routes — Plugins

**Files:**
- Create: `src/server/routes/plugins.ts`

- [ ] **Step 1: Create plugin routes**

Create `src/server/routes/plugins.ts`:

```typescript
import { Router } from "express";
import { getInstalledPlugins, getPluginDetails } from "../services/plugin-reader.js";
import { uninstallPlugin, streamCliCommand } from "../services/cli-executor.js";

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

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  streamCliCommand(
    ["plugin", "install", source],
    (data) => {
      res.write(`data: ${JSON.stringify({ status: "running", message: data })}\n\n`);
    },
    (result) => {
      res.write(
        `data: ${JSON.stringify({
          status: result.success ? "complete" : "error",
          message: result.success ? "Plugin installed successfully" : result.stderr,
        })}\n\n`
      );
      res.end();
    }
  );
});

router.delete("/:name", async (req, res) => {
  const pluginName = req.params.name;
  const result = await uninstallPlugin(pluginName);
  if (result.success) {
    res.json({ success: true, message: "Plugin uninstalled" });
  } else {
    res.status(500).json({ success: false, error: result.stderr });
  }
});

router.post("/:name/update", async (req, res) => {
  const pluginName = req.params.name;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  streamCliCommand(
    ["plugin", "update", pluginName],
    (data) => {
      res.write(`data: ${JSON.stringify({ status: "running", message: data })}\n\n`);
    },
    (result) => {
      res.write(
        `data: ${JSON.stringify({
          status: result.success ? "complete" : "error",
          message: result.success ? "Plugin updated successfully" : result.stderr,
        })}\n\n`
      );
      res.end();
    }
  );
});

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add plugin API routes with SSE for install/update"
```

---

## Task 7: Backend Routes — Marketplaces

**Files:**
- Create: `src/server/routes/marketplaces.ts`

- [ ] **Step 1: Create marketplace routes**

Create `src/server/routes/marketplaces.ts`:

```typescript
import { Router } from "express";
import { getMarketplaces, getMarketplacePlugins, browseAllMarketplaces } from "../services/marketplace-reader.js";
import { addMarketplace, removeMarketplace, refreshMarketplaces } from "../services/cli-executor.js";

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

    res.json(plugins);
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

router.post("/", async (req, res) => {
  const { source } = req.body as { source: string };
  if (!source) {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const result = await addMarketplace(source);
  if (result.success) {
    res.json({ success: true, message: "Marketplace added" });
  } else {
    res.status(500).json({ success: false, error: result.stderr });
  }
});

router.delete("/:name", async (req, res) => {
  const result = await removeMarketplace(req.params.name);
  if (result.success) {
    res.json({ success: true, message: "Marketplace removed" });
  } else {
    res.status(500).json({ success: false, error: result.stderr });
  }
});

router.post("/refresh", async (req, res) => {
  const { name } = req.body as { name?: string };
  const result = await refreshMarketplaces(name);
  if (result.success) {
    res.json({ success: true, message: "Marketplaces refreshed" });
  } else {
    res.status(500).json({ success: false, error: result.stderr });
  }
});

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add marketplace API routes with search and browsing"
```

---

## Task 8: Backend Routes — Settings & Server Entry

**Files:**
- Create: `src/server/routes/settings.ts`
- Create: `src/server/index.ts`

- [ ] **Step 1: Create settings routes**

Create `src/server/routes/settings.ts`:

```typescript
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
```

- [ ] **Step 2: Create server entry point**

Create `src/server/index.ts`:

```typescript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pluginRoutes from "./routes/plugins.js";
import marketplaceRoutes from "./routes/marketplaces.js";
import settingsRoutes from "./routes/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3200;

app.use(express.json());

// API routes
app.use("/api/plugins", pluginRoutes);
app.use("/api/marketplaces", marketplaceRoutes);
app.use("/api/settings", settingsRoutes);

// Serve React SPA in production
const clientDistDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDistDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🔌 Plugin Manager running at http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Test that the server starts**

Run: `cd . && npx tsx src/server/index.ts`
Expected: Server starts and prints "🔌 Plugin Manager running at http://localhost:3200". Kill with Ctrl+C.

- [ ] **Step 4: Test an API endpoint**

In a separate terminal:
Run: `curl -s http://localhost:3200/api/plugins | head -c 500`
Expected: JSON array of installed plugins.

Run: `curl -s http://localhost:3200/api/marketplaces | head -c 500`
Expected: JSON array of marketplaces.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add settings routes and Express server entry point"
```

---

## Task 9: React SPA — Entry Point, Themes, Global Styles

**Files:**
- Create: `src/client/index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/styles/themes.css`
- Create: `src/client/styles/global.css`

- [ ] **Step 1: Create HTML entry point**

Create `src/client/index.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Copilot Plugin Manager</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create theme CSS**

Create `src/client/styles/themes.css` with all CSS custom properties for light, dark, and copilot themes. Contains `--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, `--color-accent`, `--color-success`, `--color-error`, `--color-warning`, sidebar colors, shadows, and border radius variables for all three themes. Each theme block is applied via `[data-theme="..."]` selector.

```css
:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-hover: #f1f5f9;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-secondary: #64748b;
  --color-text-tertiary: #94a3b8;
  --color-primary: #4f46e5;
  --color-primary-hover: #4338ca;
  --color-primary-light: #ede9fe;
  --color-accent: #06b6d4;
  --color-success: #16a34a;
  --color-success-light: #dcfce7;
  --color-error: #dc2626;
  --color-error-light: #fee2e2;
  --color-warning: #d97706;
  --color-warning-light: #fef3c7;
  --color-badge-bg: #f1f5f9;
  --color-badge-text: #475569;
  --color-sidebar-bg: #f8fafc;
  --color-sidebar-active: #4f46e5;
  --color-sidebar-active-text: #ffffff;
  --color-sidebar-text: #334155;
  --color-sidebar-heading: #94a3b8;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}

[data-theme="dark"] {
  --color-bg: #1e1e2e;
  --color-surface: #2a2a3e;
  --color-surface-hover: #33334a;
  --color-border: #3e3e56;
  --color-text: #e2e8f0;
  --color-text-secondary: #a0aec0;
  --color-text-tertiary: #718096;
  --color-primary: #818cf8;
  --color-primary-hover: #6d78e8;
  --color-primary-light: #2d2d5e;
  --color-accent: #22d3ee;
  --color-success: #34d399;
  --color-success-light: #1a3a2a;
  --color-error: #f87171;
  --color-error-light: #3a1a1a;
  --color-warning: #fbbf24;
  --color-warning-light: #3a2e1a;
  --color-badge-bg: #33334a;
  --color-badge-text: #a0aec0;
  --color-sidebar-bg: #252538;
  --color-sidebar-active: #818cf8;
  --color-sidebar-active-text: #ffffff;
  --color-sidebar-text: #a0aec0;
  --color-sidebar-heading: #718096;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
}

[data-theme="copilot"] {
  --color-bg: #0d1117;
  --color-surface: #161b22;
  --color-surface-hover: #1c2333;
  --color-border: #30363d;
  --color-text: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-text-tertiary: #6e7681;
  --color-primary: #1f6feb;
  --color-primary-hover: #1a5fcb;
  --color-primary-light: #0d2240;
  --color-accent: #238636;
  --color-success: #238636;
  --color-success-light: #0d2818;
  --color-error: #f85149;
  --color-error-light: #3d1418;
  --color-warning: #d29922;
  --color-warning-light: #3d2e00;
  --color-badge-bg: #21262d;
  --color-badge-text: #8b949e;
  --color-sidebar-bg: #010409;
  --color-sidebar-active: #1f6feb;
  --color-sidebar-active-text: #ffffff;
  --color-sidebar-text: #8b949e;
  --color-sidebar-heading: #6e7681;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 3: Create global CSS**

Create `src/client/styles/global.css`:

```css
@import "./themes.css";

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#root {
  min-height: 100vh;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

button {
  cursor: pointer;
  font-family: inherit;
}

input {
  font-family: inherit;
}
```

- [ ] **Step 4: Create React entry point**

Create `src/client/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 5: Create a placeholder App.tsx**

Create `src/client/App.tsx`:

```tsx
export default function App() {
  return <div>Plugin Manager — loading...</div>;
}
```

- [ ] **Step 6: Create a favicon**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text y=".9em" font-size="90">🔌</text>
</svg>
```

- [ ] **Step 7: Verify Vite starts and serves the React app**

Run: `cd . && npx vite --host`
Expected: Vite dev server starts, opens on port 5173, page shows "Plugin Manager — loading..."

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add React SPA entry point with theme system and global styles"
```

---

## Task 10: React Hooks — API Integration

**Files:**
- Create: `src/client/hooks/usePlugins.ts`
- Create: `src/client/hooks/useMarketplaces.ts`
- Create: `src/client/hooks/useSettings.ts`

- [ ] **Step 1: Create usePlugins hook**

Create `src/client/hooks/usePlugins.ts`:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InstalledPlugin, PluginDetails } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function useInstalledPlugins() {
  return useQuery<InstalledPlugin[]>({
    queryKey: ["plugins"],
    queryFn: () => fetchJson("/api/plugins"),
  });
}

export function usePluginDetails(name: string) {
  return useQuery<PluginDetails>({
    queryKey: ["plugin-details", name],
    queryFn: () => fetchJson(`/api/plugins/${encodeURIComponent(name)}/details`),
    enabled: !!name,
  });
}

export function useInstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: string) => {
      const res = await fetch("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let lastMessage = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = JSON.parse(line.slice(6));
            lastMessage = data.message;
            if (data.status === "error") throw new Error(data.message);
          }
        }
      }
      return lastMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useUninstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/plugins/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useUpdatePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/update`, {
        method: "POST",
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let lastMessage = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = JSON.parse(line.slice(6));
            lastMessage = data.message;
            if (data.status === "error") throw new Error(data.message);
          }
        }
      }
      return lastMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["plugin-details"] });
    },
  });
}
```

- [ ] **Step 2: Create useMarketplaces hook**

Create `src/client/hooks/useMarketplaces.ts`:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Marketplace, MarketplacePlugin } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function useMarketplaces() {
  return useQuery<Marketplace[]>({
    queryKey: ["marketplaces"],
    queryFn: () => fetchJson("/api/marketplaces"),
  });
}

export function useBrowsePlugins(search?: string, marketplace?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (marketplace) params.set("marketplace", marketplace);
  const query = params.toString();

  return useQuery<MarketplacePlugin[]>({
    queryKey: ["marketplace-browse", search, marketplace],
    queryFn: () => fetchJson(`/api/marketplaces/browse${query ? `?${query}` : ""}`),
  });
}

export function useAddMarketplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: string) => {
      return fetchJson("/api/marketplaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useRemoveMarketplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/marketplaces/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useRefreshMarketplaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      return fetchJson("/api/marketplaces/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}
```

- [ ] **Step 3: Create useSettings hook**

Create `src/client/hooks/useSettings.ts`:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AppSettings, Theme } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => fetchJson("/api/settings"),
    initialData: { theme: (localStorage.getItem("theme") as Theme) ?? "light" },
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      return fetchJson<AppSettings>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      localStorage.setItem("theme", data.theme);
      document.documentElement.setAttribute("data-theme", data.theme);
    },
  });

  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.setAttribute("data-theme", settings.theme);
      localStorage.setItem("theme", settings.theme);
    }
  }, [settings?.theme]);

  return {
    settings: settings ?? { theme: "light" as Theme },
    setTheme: (theme: Theme) => mutation.mutate({ theme }),
    isUpdating: mutation.isPending,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add React Query hooks for plugins, marketplaces, settings"
```

---

## Task 11: Common UI Components

**Files:**
- Create: `src/client/components/common/Badge.tsx`
- Create: `src/client/components/common/SearchBar.tsx`
- Create: `src/client/components/common/EmptyState.tsx`
- Create: `src/client/components/common/Toast.tsx`
- Create: `src/client/components/common/PluginCard.tsx`
- Create: `src/client/components/common/common.module.css`

- [ ] **Step 1: Create all common component files**

Create the CSS module (`common.module.css`) and all five component files (Badge, SearchBar, EmptyState, Toast with ToastProvider/useToast context, PluginCard with navigation on click). Full code for each is provided in the design spec and should be copied exactly as specified in the detailed task breakdown above.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add common UI components — Badge, SearchBar, EmptyState, Toast, PluginCard"
```

---

## Task 12: Layout — Sidebar + Shell

**Files:**
- Create: `src/client/components/Layout/Layout.tsx`
- Create: `src/client/components/Layout/Layout.module.css`
- Create: `src/client/components/Sidebar/Sidebar.tsx`
- Create: `src/client/components/Sidebar/Sidebar.module.css`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Create sidebar and layout component files with their CSS modules**

Sidebar has three sections (Plugins, Sources, System) with navigation items. Layout uses flexbox — sidebar on left, `<Outlet />` on right.

- [ ] **Step 2: Wire up App.tsx with React Router routes**

Replace `src/client/App.tsx` to use `<Routes>` with Layout as wrapper and all page routes (/, /plugins/:name, /browse, /updates, /marketplaces, /add-source, /settings). Note: page components will be created in subsequent tasks so this will have import errors temporarily.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add sidebar navigation and layout shell with routing"
```

---

## Task 13: Page — Installed Plugins List

**Files:**
- Create: `src/client/components/PluginList/PluginList.tsx`
- Create: `src/client/components/PluginList/PluginList.module.css`

- [ ] **Step 1: Create the PluginList page**

Uses `useInstalledPlugins()` hook, renders a responsive CSS grid of `PluginCard` components. Includes uninstall and update handlers with toast notifications. Shows `EmptyState` when no plugins installed.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add installed plugins list page"
```

---

## Task 14: Page — Plugin Detail View

**Files:**
- Create: `src/client/components/PluginDetail/PluginDetail.tsx`
- Create: `src/client/components/PluginDetail/SkillsTab.tsx`
- Create: `src/client/components/PluginDetail/HooksTab.tsx`
- Create: `src/client/components/PluginDetail/AgentsTab.tsx`
- Create: `src/client/components/PluginDetail/McpTab.tsx`
- Create: `src/client/components/PluginDetail/PluginDetail.module.css`

- [ ] **Step 1: Create all tab components and main detail view**

PluginDetail uses `useParams` to get plugin name, `usePluginDetails` hook for data. Has tabbed navigation (Overview, Skills, Hooks, Agents, MCP) with counts. Tab components each render a grid of component cards or EmptyState. Header shows plugin info, keywords, and action buttons.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add plugin detail page with tabbed component view"
```

---

## Task 15: Page — Marketplace Browser

**Files:**
- Create: `src/client/components/MarketplaceBrowser/MarketplaceBrowser.tsx`
- Create: `src/client/components/MarketplaceBrowser/MarketplaceBrowser.module.css`

- [ ] **Step 1: Create the MarketplaceBrowser page**

Uses `useBrowsePlugins` with debounced search and marketplace filter. Uses `SearchBar` with filter dropdown of available marketplaces. Renders grid of `PluginCard` with install button for uninstalled plugins.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add marketplace browser page with search and filtering"
```

---

## Task 16: Pages — Marketplace List, Add Source, Updates, Settings

**Files:**
- Create: `src/client/components/MarketplaceList/MarketplaceList.tsx` and CSS module
- Create: `src/client/components/AddSource/AddSource.tsx` and CSS module
- Create: `src/client/components/Updates/Updates.tsx` and CSS module
- Create: `src/client/components/Settings/Settings.tsx` and CSS module

- [ ] **Step 1: Create MarketplaceList page**

Lists registered marketplaces with name, source URL, default badge. Remove button for non-default marketplaces. Refresh All button.

- [ ] **Step 2: Create AddSource page**

Form with single text input for marketplace source. Submit calls `useAddMarketplace`, navigates to /marketplaces on success.

- [ ] **Step 3: Create Updates page**

Lists all installed plugins with Update button on each. Update All button in header. Uses `useUpdatePlugin` mutation.

- [ ] **Step 4: Create Settings page**

Three theme cards (Light ☀️, Dark 🌙, Copilot 🐙) with color preview. Active state on current theme. About section with version info.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add marketplace list, add source, updates, and settings pages"
```

---

## Task 17: End-to-End Verification

- [ ] **Step 1: Start the full dev environment**

Run: `cd . && npm run dev`
Expected: Both server (port 3200) and Vite (port 5173) start without errors.

- [ ] **Step 2: Verify the API endpoints**

```bash
curl -s http://localhost:3200/api/plugins | python3 -m json.tool | head -20
curl -s http://localhost:3200/api/marketplaces | python3 -m json.tool | head -20
curl -s http://localhost:3200/api/marketplaces/browse | python3 -m json.tool | head -20
curl -s http://localhost:3200/api/settings | python3 -m json.tool
```

Expected: Valid JSON responses for each endpoint.

- [ ] **Step 3: Test the UI in browser**

Open http://localhost:5173 and verify:
- Sidebar navigation renders with all sections
- Installed plugins page shows your installed plugins
- Clicking a plugin opens the detail view with tabs
- Browse page shows marketplace plugins with search
- Marketplaces page lists registered sources
- Settings page allows theme switching
- Theme changes apply immediately across the app

- [ ] **Step 4: Test plugin operations**

From the Browse page, try installing a plugin (or verify the Install button appears for uninstalled plugins). Verify that:
- Install shows progress feedback
- After install, the plugin appears in the Installed list
- The Browse page now shows the plugin as installed

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify full application functionality"
```
