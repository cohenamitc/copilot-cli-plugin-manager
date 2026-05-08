# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-05-09

### Added

- Manual release candidate (RC) workflow — trigger builds from main without tagging
- macOS Intel (x64) build support alongside Apple Silicon (arm64)
- Screenshots and logo in README
- Changelog
- Watchdog script (`scripts/watchdog.sh`) to kill runaway Electron processes

### Fixed

- **Critical:** Electron app entered infinite process-spawn loop when launched from packaged DMG — `process.execPath` re-launched the app instead of Node.js; replaced with `utilityProcess.fork()`
- Single-instance lock prevents duplicate app windows
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
