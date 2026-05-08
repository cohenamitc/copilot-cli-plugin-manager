# Copilot Instructions

## Build & Test Commands

```bash
npm run dev          # Start Express server + Vite dev server with hot reload
npm run build        # Build client (Vite) + compile server TypeScript
npm test             # Run full test suite (vitest)
npm test -- -t "test name"  # Run a single test by name
npm run desktop      # Build and launch Electron app
```

## Architecture

This is a visual plugin manager for GitHub Copilot CLI, running as both a web app and an Electron desktop app.

### Three-layer server

1. **Routes** (`src/server/routes/`) — thin controllers that validate input and map responses to HTTP status codes. No business logic.
2. **Services** (`src/server/services/`) — all business logic lives here:
   - `cli-executor.ts` — wraps the `copilot` CLI binary for plugin install/uninstall/update and marketplace operations.
   - `plugin-reader.ts` / `marketplace-reader.ts` — read-only; parse `~/.copilot/` config files, caches, and plugin directories directly for speed.
   - `marketplace-ops.ts` — marketplace add/remove/refresh; tries CLI first, verifies state, falls back to direct file edits if CLI didn't update.
   - `plugin-ops.ts` — legacy direct file-ops for install (routes now use `cli-executor.ts` instead).
3. **Data sources** — all state lives under `~/.copilot/` (config.json, settings.json, marketplace-cache/, installed-plugins/).

### Client

- React SPA in `src/client/`, built with Vite.
- Communicates with the server via `fetch()` to `/api/*` endpoints.
- Uses TanStack React Query for server state (caching, invalidation).
- Vite dev server proxies `/api` → `http://localhost:3200`.
- CSS uses custom properties for theming (`src/client/styles/themes.css`), switched via `[data-theme]` attribute.

### Electron

- `src/electron/main.cjs` spawns the compiled server (`dist/server/index.js`) as a child process.
- Waits for the server to respond on `/api/settings` before opening the BrowserWindow.
- Auto-restarts the server on crash unless the app is quitting.

## Key Conventions

### TypeScript & Modules

- ESM throughout (`"type": "module"` in package.json). Server imports use `.js` extensions (e.g., `from "../services/plugin-reader.js"`).
- Use `import type` for type-only imports.
- Path aliases: `@server/*` and `@client/*` (configured in tsconfig.json).

### File system paths

- Always use `path.join()` with `os.homedir()` for `~/.copilot/` paths. Never hardcode home directory.
- Temp directories go under `path.join(COPILOT_DIR, "tmp", ...)`.

### Error handling

- Services return safe defaults on failure (`[]`, `null`, default objects) rather than throwing, so the UI degrades gracefully.
- Routes catch errors and return `{ error: "..." }` with appropriate HTTP status codes.

### Testing patterns

- Vitest with Node environment, globals enabled.
- **API route tests** (`api.test.ts`): mock service modules with `vi.mock()`, build a test Express app with `supertest`, assert on status codes and JSON bodies.
- **Service tests**: override `os.homedir()` to a temp directory, use `vi.resetModules()` to re-import with fresh mocks.
- All mocks are cleared in `beforeEach` with `vi.clearAllMocks()`.

### Marketplace catalog resolution (read path)

`getMarketplacePlugins()` uses a priority chain — understanding this avoids breaking browsing:
1. Local marketplace-cache directory
2. Local path (for `source: "local"` marketplaces)
3. GitHub API fetch (for remote catalogs — this is the primary source for most marketplaces)
4. Embedded `marketplace.json` inside installed plugins (last resort, may be partial)
5. Scan installed plugin directories

### Changelog

This project maintains a `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format. When making changes:
- Add entries under the `[Unreleased]` section, grouped by `Added`, `Changed`, `Fixed`, or `Removed`.
- When a version is released, the `[Unreleased]` section is moved under a versioned heading (e.g., `[0.2.0] - 2026-05-10`).
