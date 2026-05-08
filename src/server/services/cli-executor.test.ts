import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

import { execFile, spawn } from "child_process";
import {
  runCliCommand,
  streamCliCommand,
  installPlugin,
  uninstallPlugin,
  updatePlugin,
  addMarketplace,
  removeMarketplace,
  refreshMarketplaces,
} from "./cli-executor.js";

describe("cli-executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runCliCommand", () => {
    it("resolves with success when command succeeds (exit code 0)", async () => {
      vi.mocked(execFile).mockImplementation((bin, args, options, callback: any) => {
        callback(null, "success output", "");
        return {} as any;
      });

      const result = await runCliCommand(["plugin", "list"]);

      expect(result).toEqual({
        success: true,
        stdout: "success output",
        stderr: "",
        exitCode: 0,
      });
      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "list"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("resolves with failure when command fails (non-zero exit)", async () => {
      const error = new Error("Command failed") as any;
      error.code = 1;

      vi.mocked(execFile).mockImplementation((bin, args, options, callback: any) => {
        callback(error, "", "error output");
        return {} as any;
      });

      const result = await runCliCommand(["plugin", "install", "bad-plugin"]);

      expect(result).toEqual({
        success: false,
        stdout: "",
        stderr: "error output",
        exitCode: 1,
      });
    });

    it("captures stdout and stderr", async () => {
      const error = new Error("Command failed") as any;
      error.code = 2;

      vi.mocked(execFile).mockImplementation((bin, args, options, callback: any) => {
        callback(error, "some output", "some error");
        return {} as any;
      });

      const result = await runCliCommand(["test"]);

      expect(result.stdout).toBe("some output");
      expect(result.stderr).toBe("some error");
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it("handles command not found error", async () => {
      const error = new Error("ENOENT") as any;
      error.code = "ENOENT";

      vi.mocked(execFile).mockImplementation((bin, args, options, callback: any) => {
        callback(error, null, null);
        return {} as any;
      });

      const result = await runCliCommand(["test"]);

      expect(result.success).toBe(false);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(NaN); // Number("ENOENT") returns NaN
    });
  });

  describe("streamCliCommand", () => {
    it("calls onData for each stdout chunk", () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockChild);

      const onData = vi.fn();
      const onComplete = vi.fn();

      streamCliCommand(["plugin", "list"], onData, onComplete);

      mockChild.stdout.emit("data", Buffer.from("chunk 1\n"));
      mockChild.stdout.emit("data", Buffer.from("chunk 2\n"));

      expect(onData).toHaveBeenCalledTimes(2);
      expect(onData).toHaveBeenNthCalledWith(1, "chunk 1\n");
      expect(onData).toHaveBeenNthCalledWith(2, "chunk 2\n");
    });

    it("calls onData for each stderr chunk", () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockChild);

      const onData = vi.fn();
      const onComplete = vi.fn();

      streamCliCommand(["plugin", "list"], onData, onComplete);

      mockChild.stderr.emit("data", Buffer.from("error 1\n"));
      mockChild.stderr.emit("data", Buffer.from("error 2\n"));

      expect(onData).toHaveBeenCalledTimes(2);
      expect(onData).toHaveBeenNthCalledWith(1, "error 1\n");
      expect(onData).toHaveBeenNthCalledWith(2, "error 2\n");
    });

    it("calls onComplete with success on exit code 0", () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockChild);

      const onData = vi.fn();
      const onComplete = vi.fn();

      streamCliCommand(["plugin", "list"], onData, onComplete);

      mockChild.stdout.emit("data", Buffer.from("success output"));
      mockChild.emit("close", 0);

      expect(onComplete).toHaveBeenCalledWith({
        success: true,
        stdout: "success output",
        stderr: "",
        exitCode: 0,
      });
    });

    it("calls onComplete with failure on non-zero exit", () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockChild);

      const onData = vi.fn();
      const onComplete = vi.fn();

      streamCliCommand(["plugin", "install", "bad"], onData, onComplete);

      mockChild.stdout.emit("data", Buffer.from("output"));
      mockChild.stderr.emit("data", Buffer.from("error"));
      mockChild.emit("close", 1);

      expect(onComplete).toHaveBeenCalledWith({
        success: false,
        stdout: "output",
        stderr: "error",
        exitCode: 1,
      });
    });

    it("handles spawn error (e.g., ENOENT)", () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockChild);

      const onData = vi.fn();
      const onComplete = vi.fn();

      streamCliCommand(["plugin", "list"], onData, onComplete);

      mockChild.emit("error", new Error("spawn ENOENT"));

      expect(onComplete).toHaveBeenCalledWith({
        success: false,
        stdout: "",
        stderr: "spawn ENOENT",
        exitCode: 1,
      });
    });
  });

  describe("wrapper functions", () => {
    beforeEach(() => {
      vi.mocked(execFile).mockImplementation((bin, args, options, callback: any) => {
        callback(null, "success", "");
        return {} as any;
      });
    });

    it("installPlugin passes correct args", async () => {
      await installPlugin("github:user/plugin");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "install", "github:user/plugin"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("uninstallPlugin passes correct args", async () => {
      await uninstallPlugin("my-plugin");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "uninstall", "my-plugin"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("updatePlugin passes correct args", async () => {
      await updatePlugin("my-plugin");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "update", "my-plugin"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("addMarketplace passes correct args", async () => {
      await addMarketplace("github:org/marketplace");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "marketplace", "add", "github:org/marketplace"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("removeMarketplace passes correct args", async () => {
      await removeMarketplace("my-marketplace");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "marketplace", "remove", "my-marketplace"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("refreshMarketplaces with name passes correct args", async () => {
      await refreshMarketplaces("my-marketplace");

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "marketplace", "update", "my-marketplace"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });

    it("refreshMarketplaces without name passes correct args", async () => {
      await refreshMarketplaces();

      expect(execFile).toHaveBeenCalledWith(
        "copilot",
        ["plugin", "marketplace", "update"],
        { timeout: 120_000 },
        expect.any(Function)
      );
    });
  });
});
