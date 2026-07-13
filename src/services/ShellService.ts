import { spawn, spawnSync } from "child_process";
import * as os from "os";
import * as path from "path";
import openPath from "open";
import which from "which";

export type ShellServiceProps = Record<string, never>;

/**
 * Thin wrappers around Node child_process, path, and the `open` / `which` packages.
 * Do not add unit tests for this class; behavior here is mostly pass-through
 * to the OS and stdlib.
 */
export class ShellService {
  private static instance: ShellService | null = null;

  constructor(_props?: ShellServiceProps) {}

  static getInstance(): ShellService {
    if (!ShellService.instance) {
      ShellService.instance = new ShellService();
    }
    return ShellService.instance;
  }

  static setInstance(instance: ShellService | null): void {
    ShellService.instance = instance;
  }

  cwd(): string {
    return process.cwd();
  }

  tmpdir(): string {
    return os.tmpdir();
  }

  relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  isAbsolute(p: string): boolean {
    return path.isAbsolute(p);
  }

  which(name: string): Promise<string | null> {
    return which(name, { nothrow: true }).then((r: string | null) => r ?? null);
  }

  run(command: string, args: string[]): void {
    spawn(command, args, {
      detached: true,
      stdio: "inherit",
    });
  }

  async open(targetPath: string): Promise<void> {
    await openPath(targetPath);
  }

  runAndWait(
    command: string,
    args: string[],
    options?: { cwd?: string; env?: typeof process.env },
  ): { status: number | null } {
    const result = spawnSync(command, args, {
      stdio: "inherit",
      ...(options?.cwd != null && { cwd: options.cwd }),
      ...(options?.env != null && { env: options.env }),
    });
    return { status: result.status };
  }

  runAndCapture(
    command: string,
    args: string[],
    options?: { cwd?: string },
  ): { status: number | null; stdout: string } {
    const result = spawnSync(command, args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "inherit"],
      ...(options?.cwd != null && { cwd: options.cwd }),
    });
    const stdout =
      typeof result.stdout === "string"
        ? result.stdout
        : String(result.stdout ?? "");
    return { status: result.status, stdout };
  }

  runShellAndWait(
    command: string,
    options?: { cwd?: string; env?: typeof process.env },
  ): { status: number | null } {
    const result = spawnSync(command, {
      shell: true,
      stdio: "inherit",
      ...(options?.cwd != null && { cwd: options.cwd }),
      ...(options?.env != null && { env: options.env }),
    });
    return { status: result.status };
  }

  openShell(cwd: string): { status: number | null } {
    const shellPath = process.env.SHELL ?? "sh";
    if (path.basename(shellPath) === "zsh") {
      return this.runAndWait(shellPath, ["-i", "-l"], { cwd });
    }
    return this.runShellAndWait(shellPath, { cwd });
  }
}
