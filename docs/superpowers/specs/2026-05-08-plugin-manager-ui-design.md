# Copilot CLI Plugin Manager — Design Specification

**Date:** 2026-05-08
**Status:** Approved

## Problem Statement

The GitHub Copilot CLI has a rich plugin system accessed entirely through command-line subcommands (`copilot plugin install/uninstall/update/list`, `copilot plugin marketplace add/remove/browse/list/update`). There is no graphical interface for discovering, browsing, installing, or managing plugins. Users must memorize CLI syntax, know marketplace names, and manually inspect plugin contents.

This project creates a standalone web-based plugin manager UI that wraps the existing CLI operations, providing a visual interface for the full plugin lifecycle.

## Proposed Approach

A monolith SPA (single Express server + React frontend) that:
- Wraps `copilot plugin` CLI commands for mutations (install, uninstall, update, marketplace management)
- Reads config/cache files directly for fast queries (plugin lists, marketplace browsing, plugin details)
- Runs locally as a personal tool (`npm start` → opens browser)

## Architecture

```
Browser (React SPA)
  ↕ REST API (fetch)
Express Server (Node.js/TypeScript)
  ↕ child_process.exec (mutations) + fs.readFile (queries)
Copilot CLI + ~/.copilot/ config files
```

### Data Flow — Queries (Read)

For listing plugins, browsing marketplaces, and reading plugin details, the server reads files directly:
- `~/.copilot/config.json` — installed plugins list (name, marketplace, version, enabled, cache_path)
- `~/.copilot/settings.json` — registered marketplaces, enabled plugins map
- `~/.copilot/marketplace-cache/<marketplace>/` — the marketplace.json catalog is found by checking `.github/plugin/marketplace.json` first, then `.claude-plugin/marketplace.json` as fallback (both locations are used in practice)
- `~/.copilot/installed-plugins/<marketplace>/<plugin>/.claude-plugin/plugin.json` — plugin metadata (name, version, description, author, keywords, category)
- `~/.copilot/installed-plugins/<marketplace>/<plugin>/skills/` — skill directories
- `~/.copilot/installed-plugins/<marketplace>/<plugin>/agents/` — agent definitions
- `~/.copilot/installed-plugins/<marketplace>/<plugin>/hooks/` — hook configurations

### Data Flow — Mutations (Write)

For operations that change state, the server shells out to the CLI:
- `copilot plugin install <source>` — install from marketplace or repo
- `copilot plugin uninstall <name>` — remove a plugin
- `copilot plugin update <name>` — update to latest version
- `copilot plugin marketplace add <source>` — register a new marketplace
- `copilot plugin marketplace remove <name>` — unregister a marketplace
- `copilot plugin marketplace update [name]` — refresh marketplace catalogs

Long-running operations (install, update) stream progress via Server-Sent Events (SSE).

## UI Design

### Layout: Sidebar Navigation

Left sidebar with grouped navigation sections. Main content area shows the selected view. Plugin/marketplace items are clickable for detail views.

**Sidebar sections:**

**Plugins**
- **Installed** — list of installed plugins with version badge, marketplace source, enable/disable toggle, update/remove actions
- **Browse** — unified search across all registered marketplaces, filterable by marketplace, category, keywords. Shows install button for uninstalled plugins.
- **Updates** — plugins with available updates, individual update and "Update All" actions

**Sources**
- **Marketplaces** — list of registered marketplaces (name, source URL, plugin count), remove action
- **Add Source** — form to register a new marketplace (GitHub repo `owner/repo`, git URL, or local path)

**System**
- **Settings** — theme toggle (light/dark/copilot), version info

### Plugin Cards

Each plugin is displayed as a card showing:
- Plugin name (bold)
- Version badge (green pill)
- Marketplace source
- One-line description
- Component summary badges (e.g., "12 skills", "1 hook", "2 agents")
- Action buttons (Install/Update/Remove depending on context)

### Plugin Detail View — Tab Sections

Clicking a plugin opens a detail view with:

**Header:** Plugin icon placeholder, name, version, author, marketplace, license, keywords as tags, action buttons (Update, Remove)

**Tabs:**
- **Overview** — full description, author details, homepage/repository links, install date, keywords
- **Skills** — grid of skill cards showing name and description
- **Hooks** — list of hook configurations
- **Agents** — list of agent definitions with descriptions
- **MCP Servers** — MCP server configurations

Tabs with zero items show a count of (0) and display an empty state message.

### Marketplace Browser

The Browse page aggregates plugins from all registered marketplaces into a single searchable view:
- Search bar filters by name, description, and keywords
- Marketplace dropdown filter to narrow to a single source
- Category filter (if plugins have categories)
- Each plugin card shows its source marketplace
- Installed plugins are marked with a checkmark and show "Installed" instead of "Install" button

## API Design

### Plugin Endpoints

| Method | Endpoint | Source | Description |
|--------|----------|--------|-------------|
| `GET` | `/api/plugins` | File read | List installed plugins with metadata |
| `POST` | `/api/plugins/install` | CLI | Install a plugin (body: `{source}`) |
| `DELETE` | `/api/plugins/:name` | CLI | Uninstall a plugin |
| `POST` | `/api/plugins/:name/update` | CLI | Update a plugin |
| `GET` | `/api/plugins/:name/details` | File read | Full plugin details including components |

### Marketplace Endpoints

| Method | Endpoint | Source | Description |
|--------|----------|--------|-------------|
| `GET` | `/api/marketplaces` | File read | List registered marketplaces |
| `POST` | `/api/marketplaces` | CLI | Add a marketplace (body: `{source}`) |
| `DELETE` | `/api/marketplaces/:name` | CLI | Remove a marketplace |
| `GET` | `/api/marketplaces/:name/plugins` | File read | Browse plugins in a marketplace |
| `POST` | `/api/marketplaces/refresh` | CLI | Refresh marketplace catalogs |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Read user preferences |
| `PUT` | `/api/settings` | Update preferences (theme) |

### SSE for Long-Running Operations

Install and update operations return an SSE stream:
```
POST /api/plugins/install → Content-Type: text/event-stream
data: {"status": "running", "message": "Cloning repository..."}
data: {"status": "running", "message": "Installing dependencies..."}
data: {"status": "complete", "plugin": {...}}
```

## Project Structure

```
copilot-cli-plugin-manager/
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── src/
│   ├── server/
│   │   ├── index.ts                 # Express entry — serves SPA + API
│   │   ├── routes/
│   │   │   ├── plugins.ts           # Plugin CRUD endpoints
│   │   │   ├── marketplaces.ts      # Marketplace endpoints
│   │   │   └── settings.ts          # Settings endpoints
│   │   ├── services/
│   │   │   ├── cli-executor.ts      # Wraps child_process for CLI commands
│   │   │   ├── plugin-reader.ts     # Direct file reads for plugin metadata
│   │   │   └── marketplace-reader.ts # Reads marketplace cache
│   │   └── types.ts                 # Shared TypeScript types
│   └── client/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── Layout.tsx        # Sidebar + main content shell
│       │   │   └── Layout.module.css
│       │   ├── Sidebar/
│       │   │   ├── Sidebar.tsx       # Navigation sidebar
│       │   │   └── Sidebar.module.css
│       │   ├── PluginList/
│       │   │   ├── PluginList.tsx     # Installed plugins list
│       │   │   └── PluginList.module.css
│       │   ├── PluginDetail/
│       │   │   ├── PluginDetail.tsx   # Detail view with tabs
│       │   │   ├── SkillsTab.tsx
│       │   │   ├── HooksTab.tsx
│       │   │   ├── AgentsTab.tsx
│       │   │   ├── McpTab.tsx
│       │   │   └── PluginDetail.module.css
│       │   ├── MarketplaceBrowser/
│       │   │   ├── MarketplaceBrowser.tsx
│       │   │   └── MarketplaceBrowser.module.css
│       │   ├── MarketplaceList/
│       │   │   ├── MarketplaceList.tsx
│       │   │   └── MarketplaceList.module.css
│       │   ├── AddSource/
│       │   │   ├── AddSource.tsx      # Add marketplace form
│       │   │   └── AddSource.module.css
│       │   ├── Updates/
│       │   │   ├── Updates.tsx        # Available updates view
│       │   │   └── Updates.module.css
│       │   ├── Settings/
│       │   │   ├── Settings.tsx
│       │   │   └── Settings.module.css
│       │   └── common/
│       │       ├── PluginCard.tsx
│       │       ├── Badge.tsx
│       │       ├── SearchBar.tsx
│       │       ├── EmptyState.tsx
│       │       ├── Toast.tsx
│       │       └── common.module.css
│       ├── hooks/
│       │   ├── usePlugins.ts         # React Query hooks for plugin API
│       │   ├── useMarketplaces.ts    # React Query hooks for marketplace API
│       │   └── useSettings.ts        # Theme and settings hooks
│       ├── styles/
│       │   ├── themes.css            # CSS custom properties for all themes
│       │   ├── global.css            # Reset and base styles
│       │   └── variables.css         # Shared spacing, typography tokens
│       └── types.ts                  # Frontend types
├── public/
│   └── favicon.svg
└── .gitignore
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20+ | Server runtime |
| Language | TypeScript 5.x | Type safety across stack |
| Backend | Express 4.x | HTTP server, API routes, SPA serving |
| Frontend | React 19 | UI framework |
| Build | Vite 6 | Frontend bundler with HMR |
| Routing | React Router 7 | Client-side routing |
| State | TanStack Query 5 | Server state management, caching, refetching |
| Styling | CSS Modules | Scoped styles, no runtime cost |
| Dev Runner | tsx | Run TypeScript server directly |

## Theme System

Three themes using CSS custom properties:

### Light Theme (Default)
- Background: `#ffffff`
- Surface: `#f8fafc`
- Text: `#0f172a`
- Primary: `#4f46e5` (indigo)
- Accent: `#06b6d4` (cyan)

### Dark Theme
- Background: `#1e1e2e`
- Surface: `#2a2a3e`
- Text: `#e2e8f0`
- Primary: `#818cf8`
- Accent: `#22d3ee`

### Copilot Theme
- Background: `#0d1117` (GitHub dark)
- Surface: `#161b22`
- Text: `#c9d1d9`
- Primary: `#1f6feb`
- Accent: `#238636` (GitHub green)

Theme is stored in `localStorage` and toggled via Settings page. Applied via `data-theme` attribute on `<html>`.

## Error Handling

- CLI command failures surface as toast notifications with the stderr message
- Network errors show inline error states with retry buttons
- File read failures (e.g., missing config) show graceful fallback states
- Operations in progress disable conflicting actions (can't uninstall while installing)

## Constraints and Assumptions

- Requires `copilot` CLI to be installed and in PATH
- Assumes `~/.copilot/` directory structure as observed in the current CLI version
- Single-user, single-session — no authentication needed
- No persistent database — all state lives in Copilot CLI's config files
- The server runs on localhost only (not exposed to network)
