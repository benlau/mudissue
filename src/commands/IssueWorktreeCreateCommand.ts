import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { WorktreeHelper } from "../helpers/WorktreeHelper.ts";
import type {
  ErrorResponse,
  IssueWorktreePathSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueWorktreeCreateCommandSuccessResponse =
  SuccessResponse<IssueWorktreePathSuccessResult>;

const msg = defineMessages({
  worktreeCreateDescribe: {
    id: "cli.worktree.create.describe",
    defaultMessage: "Create a git worktree for the selected issue",
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

export class IssueWorktreeCreateCommand extends Command {
  name = "issue-worktree create";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeCreateCommand();
    return yargs.command(
      "create <issue_selector>",
      intl.formatMessage(msg.worktreeCreateDescribe),
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
  ): Promise<IssueWorktreeCreateCommandSuccessResponse | ErrorResponse> {
    const { worktreePath } = await WorktreeHelper.ensureIssueWorktreeAvailable({
      issueSelector,
      project,
    });

    return {
      status: "ok",
      result: { worktree_path: worktreePath },
    };
  }
}
