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

# Package desktop app for distribution
[macos]
package: build
    npx electron-builder --mac --publish never

[windows]
package: build
    npx electron-builder --win --publish never

[linux]
package: build
    npx electron-builder --linux --publish never

# Install dependencies
install:
    npm install

# Clean build artifacts
[unix]
clean:
    rm -rf dist release

[windows]
clean:
    if exist dist rmdir /s /q dist
    if exist release rmdir /s /q release

# Run watchdog script (kills app if > N instances detected)
[unix]
watchdog max="5" interval="5":
    ./scripts/watchdog.sh {{max}} {{interval}}
