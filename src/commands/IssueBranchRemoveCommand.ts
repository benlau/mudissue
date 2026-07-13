import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";

import type {
  ErrorResponse,
  IssueBranchNameSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";

export type IssueBranchRemoveCommandSuccessResponse =
  SuccessResponse<IssueBranchNameSuccessResult>;

const msg = defineMessages({
  branchRemoveDescribe: {
    id: "cli.branch.remove.describe",
    defaultMessage: "Remove the git branch for the selected issue",
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

export class IssueBranchRemoveCommand extends Command {
  name = "issue branch remove";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueBranchRemoveCommand();
    return yargs.command(
      "remove <issue_selector>",
      intl.formatMessage(msg.branchRemoveDescribe),
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
  ): Promise<IssueBranchRemoveCommandSuccessResponse | ErrorResponse> {
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );
    const branch = await useCurrentTrackerRepoStore
      .getState()
      .getIssueBranchName(repo, issue);

    const { status } = shellService.runAndWait(
      "git",
      ["branch", "-D", branch],
      { cwd: repo.projectPath },
    );
    if (status !== 0) {
      throw new Error(
        `git branch -D failed${status != null ? ` (exit code ${status})` : ""}`,
      );
    }

    loggerService.info(branch);
    return {
      status: "ok",
      result: { branch },
    };
  }
}
