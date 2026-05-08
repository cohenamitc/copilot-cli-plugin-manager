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
