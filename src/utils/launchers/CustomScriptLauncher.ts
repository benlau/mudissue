import * as path from "path";
import { debug } from "../../services/LoggerService.ts";
import { FileService } from "../../services/FileService.ts";
import { ShellService } from "../../services/ShellService.ts";
import type { CustomScriptEntry } from "../../types/CustomScript.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { TrackerRepo } from "../../types/Tracker.ts";

export type CustomScriptRunResult = {
  status: number | null;
};

export type CustomScriptRunOptions = {
  debug?: boolean;
};

export type CustomScriptLauncherProps = {
  fileService?: FileService;
  shellService?: ShellService;
};

export class CustomScriptLauncher {
  private readonly fileService: FileService;
  private readonly shellService: ShellService;

  constructor(props: CustomScriptLauncherProps = {}) {
    this.fileService = props.fileService ?? FileService.getInstance();
    this.shellService = props.shellService ?? ShellService.getInstance();
  }

  formatRunLine(command: string, args?: string[]): string {
    const trimmedCommand = command.trim();
    const trimmedArgs = (args ?? [])
      .map((arg) => arg.trim())
      .filter((arg) => arg !== "");
    if (trimmedArgs.length === 0) {
      return trimmedCommand;
    }
    return [trimmedCommand, ...trimmedArgs].join(" ");
  }

  async validateExecutable(command: string): Promise<string | null> {
    const trimmed = command.trim();
    if (trimmed === "") {
      return "Script command is empty";
    }

    if (this.shellService.isAbsolute(trimmed)) {
      if (!(await this.fileService.isExecutable(trimmed))) {
        return `Script command is not executable: ${trimmed}`;
      }
      return null;
    }

    if ((await this.shellService.which(trimmed)) == null) {
      return `Script command not found: ${trimmed}`;
    }
    return null;
  }

  async run(
    script: CustomScriptEntry,
    issues: IssueFolder[],
    repo: TrackerRepo,
    options: CustomScriptRunOptions = {},
  ): Promise<CustomScriptRunResult> {
    const executableError = await this.validateExecutable(script.command);
    if (executableError != null) {
      throw new Error(executableError);
    }

    const argv = (script.args ?? [])
      .map((arg) => arg.trim())
      .filter((arg) => arg !== "");
    const env = this.buildEnv(issues, repo);
    const scriptContent = this.buildShellScriptContent(script.command, argv);
    const scriptPath = this.buildTempScriptPath();

    await this.fileService.writeFile(scriptPath, scriptContent, "utf-8");
    await this.fileService.chmod(scriptPath, 0o700);

    if (options.debug === true) {
      debug(`Custom script wrapper: ${scriptPath}`);
    }

    try {
      const { status } = this.shellService.runAndWait("/bin/sh", [scriptPath], {
        cwd: repo.projectPath,
        env,
      });
      return { status };
    } finally {
      if (options.debug !== true) {
        try {
          await this.fileService.rm(scriptPath);
        } catch {
          // Best-effort cleanup of the temp wrapper script.
        }
      }
    }
  }

  private buildEnv(
    issues: IssueFolder[],
    repo: TrackerRepo,
  ): typeof process.env {
    const issueIds = issues.map((issue) => issue.issueId);
    return {
      ...process.env,
      MUD_ISSUE_IDS: issueIds.join(" "),
      MUD_ISSUE_ID: issueIds[0] ?? "",
      MUD_PROJECT_PATH: repo.projectPath,
      MUD_TRACKER_PATH: repo.trackerPath,
    };
  }

  private buildTempScriptPath(): string {
    return path.join(
      this.shellService.tmpdir(),
      `mudissue-custom-script-${process.pid}-${Date.now()}.sh`,
    );
  }

  private buildShellScriptContent(command: string, args: string[]): string {
    const trimmedCommand = command.trim();
    const trimmedArgs = args
      .map((arg) => arg.trim())
      .filter((arg) => arg !== "");
    const commandToken = this.toShellScriptToken(trimmedCommand);
    const argTokens = trimmedArgs.map((arg) => this.toShellScriptToken(arg));
    const runLine =
      argTokens.length > 0
        ? `${commandToken} ${argTokens.join(" ")}`
        : commandToken;
    return `#!/bin/sh\n${runLine}\n`;
  }

  private toShellScriptToken(value: string): string {
    if (!/\s/.test(value)) {
      return value;
    }
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/`/g, "\\`");
    return `"${escaped}"`;
  }
}
