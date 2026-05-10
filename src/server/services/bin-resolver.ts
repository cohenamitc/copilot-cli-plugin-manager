import { existsSync } from "fs";
import os from "os";
import path from "path";

/**
 * Resolve a binary by checking well-known install locations.
 * When the packaged Electron app is launched from Finder, macOS provides
 * a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) that excludes Homebrew
 * and user-local directories. This function probes known paths so CLI
 * tools can be found regardless of how the app was launched.
 */
function findBin(name: string, extraPaths: string[]): string {
  const searchPaths = [
    path.join("/opt/homebrew/bin", name),                // macOS ARM Homebrew
    path.join("/usr/local/bin", name),                   // macOS Intel Homebrew / Linux
    path.join(os.homedir(), ".local", "bin", name),      // User-local install
    ...extraPaths,
  ];
  for (const p of searchPaths) {
    if (existsSync(p)) return p;
  }
  return name; // fallback to PATH lookup
}

export const COPILOT_BIN = findBin("copilot", []);
export const GH_BIN = findBin("gh", []);
