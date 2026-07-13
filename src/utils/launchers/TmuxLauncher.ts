import type { IssueFolder } from "../../types/Issue.ts";
import type { TrackerRepo } from "../../types/Tracker.ts";
import type {
  ErrorResponse,
  TmuxRunCommandSuccessResult,
} from "../../types/Response.ts";
import { FileService } from "../../services/FileService.ts";
import { ShellService } from "../../services/ShellService.ts";

export type TmuxLaunchInput = {
  issue: IssueFolder;
  repo: TrackerRepo;
  worktreeAbs: string;
  command?: string;
};

export type TmuxLauncherProps = {
  fileService?: FileService;
  shellService?: ShellService;
};

export class TmuxLauncher {
  private readonly fileService: FileService;
  private readonly shellService: ShellService;

  constructor(props: TmuxLauncherProps = {}) {
    this.fileService = props.fileService ?? FileService.getInstance();
    this.shellService = props.shellService ?? ShellService.getInstance();
  }

  getTmuxSessionName(folderName: string, command?: string): string {
    let base = (folderName.trim() !== "" ? folderName.trim() : "mudissue")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\p{M}_./-]/gu, "_");
    base = base.replace(/_+/g, "_").replace(/^[-_.]+|[-_.]+$/g, "");
    if (base.length === 0) {
      base = "mudissue";
    }
    base = base.slice(0, 20);

    let commandSuffix = command
      ?.replace(/\s+/g, "")
      .replace(/-+/g, "-")
      .replace(/[^\p{L}\p{N}\p{M}_./-]/gu, "_");
    commandSuffix = commandSuffix
      ?.replace(/_+/g, "_")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 20);

    return commandSuffix ? `${base}-${commandSuffix}` : base;
  }

  async launch(input: TmuxLaunchInput): Promise<TmuxRunCommandSuccessResult> {
    const { issue, worktreeAbs, command } = input;

    const tmuxPath = await this.shellService.which("tmux");
    if (tmuxPath == null) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "TMUX_NOT_FOUND",
          message: "tmux not found in PATH",
        },
      };
      throw response;
    }

    const cwd = (await this.fileService.exists(worktreeAbs))
      ? worktreeAbs
      : issue.path;

    const sessionName = this.getTmuxSessionName(issue.folderName, command);

    const args = ["new-session", "-A", "-s", sessionName];
    if (command) {
      args.push(command);
    }

    const { status } = this.shellService.runAndWait(tmuxPath, args, { cwd });

    if (status !== 0) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "TMUX_EXIT_NONZERO",
          message: `tmux exited with status ${status ?? "unknown"}`,
          details: { exitCode: status },
        },
      };
      throw response;
    }

    return { cwd, session_name: sessionName };
  }
}
