# Default recipe: list all available recipes
default:
    @just --list

# Start Electron desktop app (build + launch)
desktop: build
    npx electron src/electron/main.cjs

# Start dev servers (Express + Vite with hot reload)
dev:
    npm run dev

# Build client (Vite) and server (TypeScript)
build:
    npm run build

# Run full test suite
test:
    npm test

# Run tests in watch mode
test-watch:
    npx vitest

# Package desktop app for distribution (DMG, zip)
package: build
    npx electron-builder --mac --publish never

# Package for current arch only (faster)
package-fast: build
    npx electron-builder --mac --$(uname -m | sed 's/x86_64/x64/' | sed 's/aarch64/arm64/') --publish never

# Install dependencies
install:
    npm install

# Clean build artifacts
clean:
    rm -rf dist release

# Run watchdog script (kills app if > N instances detected)
watchdog max="5" interval="5":
    ./scripts/watchdog.sh {{max}} {{interval}}
