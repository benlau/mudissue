import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueWorktreeLocateCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { LoggerService } from "../services/LoggerService.ts";

export type IssueWorktreeLocateCommandSuccessResponse =
  SuccessResponse<IssueWorktreeLocateCommandSuccessResult>;

const msg = defineMessages({
  worktreeLocateDescribe: {
    id: "cli.worktree.locate.describe",
    defaultMessage: "Print the worktree path for the selected issue",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
});

export class IssueWorktreeLocateCommand extends Command {
  name = "issue-worktree locate";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeLocateCommand();
    return yargs.command(
      "locate <issue_selector>",
      intl.formatMessage(msg.worktreeLocateDescribe),
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
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand(
          { outputJson },
          argv.issue_selector ?? "",
          argv.project,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    project?: string,
  ): Promise<IssueWorktreeLocateCommandSuccessResponse | ErrorResponse> {
    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(issue.issueId);

    LoggerService.getInstance().info(worktreePath);
    return {
      status: "ok",
      result: { path: worktreePath },
    };
  }
}
