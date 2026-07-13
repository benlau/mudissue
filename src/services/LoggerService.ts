import * as path from "path";
import { DateFormatter } from "../foundation/formatter/DateFormatter.ts";
import { FileService } from "./FileService.ts";
import { ShellService } from "./ShellService.ts";

export class LoggerService {
  private static instance: LoggerService;

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public static setInstance(instance: LoggerService): void {
    LoggerService.instance = instance;
  }

  public constructor() {}

  public info(...args: unknown[]): void {
    console.log(...args);
  }

  public warn(...args: unknown[]): void {
    console.warn(...args);
  }

  public error(...args: unknown[]): void {
    console.error(...args);
  }

  public debug(..._args: unknown[]): void {}
}

/** No-op logger; used when --json or MUDISSUE_OUTPUT_JSON is set so only JSON is written to stdout. */
export class SilentLogger extends LoggerService {
  public override info(): void {}
  public override warn(): void {}
  public override error(): void {}
  public override debug(): void {}
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
}

export class DebugLoggerService extends LoggerService {
  private outputFilePath: string | null = null;
  private outputFileEnabled = true;
  private outputConsoleEnabled = true;
  private readonly fileService: FileService;
  private readonly shellService: ShellService;

  constructor() {
    super();
    this.fileService = FileService.getInstance();
    this.shellService = ShellService.getInstance();
  }

  setOutputFile(filePath: string): void {
    this.outputFilePath = filePath;
  }

  setOutputFileEnabled(enabled: boolean): void {
    this.outputFileEnabled = enabled;
  }

  setOutputConsoleEnabled(enabled: boolean): void {
    this.outputConsoleEnabled = enabled;
  }

  private resolvePath(filePath: string): string {
    if (this.shellService.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.shellService.cwd(), filePath);
  }

  private write(
    level: "debug" | "info" | "warn" | "error",
    args: unknown[],
  ): void {
    const content = formatArgs(args);
    const line = `[${DateFormatter.format(new Date(), "log_timestamp")}] ${content}`;

    if (this.outputConsoleEnabled) {
      if (level === "error") {
        console.error(content);
      } else if (level === "warn") {
        console.warn(content);
      } else {
        console.log(content);
      }
    }

    if (this.outputFileEnabled && this.outputFilePath !== null) {
      const resolvedPath = this.resolvePath(this.outputFilePath);
      void this.fileService.appendFile(resolvedPath, line + "\n");
    }
  }

  public override debug(...args: unknown[]): void {
    this.write("debug", args);
  }

  public override info(...args: unknown[]): void {
    this.write("info", args);
  }

  public override warn(...args: unknown[]): void {
    this.write("warn", args);
  }

  public override error(...args: unknown[]): void {
    this.write("error", args);
  }
}

export function debug(...args: unknown[]): void {
  LoggerService.getInstance().debug(...args);
}
