import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { TmuxLauncher } from "../utils/launchers/TmuxLauncher.ts";
import type {
  ErrorResponse,
  TmuxRunCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";

export type TmuxRunCommandSuccessResponse =
  SuccessResponse<TmuxRunCommandSuccessResult>;

const msg = defineMessages({
  tmuxRunDescribe: {
    id: "cli.tmux.run.describe",
    defaultMessage: "Open or attach a tmux session for the selected issue",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  tmuxCommand: {
    id: "cli.tmux.run.positional.command",
    defaultMessage: "Command to include in the tmux session name",
  },
});

export class TmuxRunCommand extends Command {
  name = "tmux run";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new TmuxRunCommand();
    return yargs.command(
      "run <issue_selector> [command..]",
      intl.formatMessage(msg.tmuxRunDescribe),
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
            describe: intl.formatMessage(msg.tmuxCommand),
            type: "string",
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        const command = Array.isArray(argv.command)
          ? argv.command.join(" ")
          : argv.command;
        await cmd.runCommand(
          { outputJson },
          argv.issue_selector ?? "",
          argv.project,
          command,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    project?: string,
    command?: string,
  ): Promise<TmuxRunCommandSuccessResponse | ErrorResponse> {
    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(issue.folderName);
    const result = await new TmuxLauncher().launch({
      issue,
      repo,
      worktreeAbs: worktreePath,
      command,
    });

    return {
      status: "ok",
      result,
    };
  }
}
