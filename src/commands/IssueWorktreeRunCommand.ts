import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { TmuxLauncher } from "../async/launchers/TmuxLauncher.ts";
import type { ErrorResponse, SuccessResponse } from "../types/Response.ts";
import { ShellService } from "../services/ShellService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { WorktreeHelper } from "../helpers/WorktreeHelper.ts";

export type IssueWorktreeRunCommandSuccessResponse = SuccessResponse<object>;

export type IssueWorktreeRunCommandOptions = {
  project?: string;
  command?: string;
};

const msg = defineMessages({
  worktreeRunDescribe: {
    id: "cli.worktree.run.describe",
    defaultMessage: "Run a command or shell in the selected issue worktree",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  worktreeRunCommand: {
    id: "cli.worktree.run.positional.command",
    defaultMessage: "Command to run in the worktree",
  },
});

export class IssueWorktreeRunCommand extends Command {
  name = "issue worktree run";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeRunCommand();
    return yargs.command(
      "run <issue_selector> [command..]",
      intl.formatMessage(msg.worktreeRunDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            demandOption: true,
          })
          .positional("command", {
            describe: intl.formatMessage(msg.worktreeRunCommand),
            type: "string",
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: true,
        });
        const command = Array.isArray(argv.command)
          ? argv.command.join(" ")
          : argv.command;
        await cmd.runCommand({ outputJson }, argv.issue_selector ?? "", {
          project: argv.project as string | undefined,
          command,
        });
      },
    );
  }

  async command(
    issueSelector: string,
    options: IssueWorktreeRunCommandOptions = {},
  ): Promise<IssueWorktreeRunCommandSuccessResponse | ErrorResponse> {
    const shellService = ShellService.getInstance();
    const { repo, issue, worktreePath } =
      await WorktreeHelper.ensureIssueWorktreeAvailable({
        issueSelector,
        project: options.project,
        logIfWorktreeExists: false,
      });
    const command = options.command?.trim() || undefined;

    if ((await shellService.which("tmux")) != null) {
      await new TmuxLauncher().launch({
        issue,
        repo,
        worktreeAbs: worktreePath,
        command,
      });
      return {
        status: "ok",
        result: {},
      };
    }

    const shellCommand = command ?? process.env.SHELL ?? "sh";
    const { status } = shellService.runShellAndWait(shellCommand, {
      cwd: worktreePath,
    });
    if (status !== 0) {
      throw new Error(
        `worktree run failed${status != null ? ` (exit code ${status})` : ""}`,
      );
    }

    return {
      status: "ok",
      result: {},
    };
  }
}
