# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Plugin disable/enable support — disable uninstalls a plugin but remembers it; enable reinstalls from the saved marketplace source (#1)
- Disabled plugins shown in plugin list (dimmed, with "Disabled" badge) and marketplace browser
- `disabled-registry` service for persisting disabled plugin state
- App version on Settings page now dynamically sourced from package.json (#2)
- Issue tracking directive in copilot-instructions.md

### Fixed

- Theme selection button text invisible in dark/copilot themes (#3)
- Theme selection not persisting across app restarts — moved settings fetch to App root (#4)
- CLI operations (install/uninstall/disable/enable) fail when app launched from Finder due to missing PATH (#5)

## [0.1.1] - 2026-05-09

### Added

- Manual release candidate (RC) workflow — trigger builds from main without tagging
- macOS Intel (x64) build support alongside Apple Silicon (arm64)
- Screenshots and logo in README
- Changelog
- Watchdog script (`scripts/watchdog.sh`) to kill runaway Electron processes
- `justfile` for common dev tasks (`just desktop`, `just package`, `just test`, etc.)

### Changed

- Upgraded to Node.js 22
- Server binds to `127.0.0.1` only (no external network access) with dynamic port fallback
- Positioned Electron as the primary app target; web UI retained for development

### Fixed

- **Critical:** Electron app entered infinite process-spawn loop when launched from packaged DMG — `process.execPath` re-launched the app instead of Node.js; replaced with `utilityProcess.fork()`
- Single-instance lock prevents duplicate app windows
- Packaged app resolves server and client assets from asar archive, fixing "connection refused" after DMG install
- Use `copilot` CLI for plugin install/uninstall/update instead of custom file-ops, fixing installs from URL-based marketplace catalogs
- Show full remote marketplace catalog when browsing, instead of partial catalog bundled inside installed plugins
- Prevent electron-builder from auto-publishing during CI build job

## [0.1.0] - 2026-05-08

### Added

- Initial release of Copilot CLI Plugin Manager
- Electron desktop application with cross-platform builds (macOS, Windows)
- Plugin management UI with React and Vite
- Express backend server
- GitHub Actions CI/CD pipeline with automated releases
