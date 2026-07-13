import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { ChangeIssueIdHelper } from "../helpers/ChangeIssueIdHelper.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueChangeIdCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueChangeIdCommandSuccessResponse =
  SuccessResponse<IssueChangeIdCommandSuccessResult>;

const msg = defineMessages({
  issueChangeIdDescribe: {
    id: "cli.issue.changeId.describe",
    defaultMessage:
      "Change an issue id (folder prefix and number; suffix unchanged)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  issueChangeIdNewId: {
    id: "cli.issue.changeId.positional.newId",
    defaultMessage: "New issue id (prefix and number only)",
  },
});

export class IssueChangeIdCommand extends Command {
  name = "issue change-id";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueChangeIdCommand();
    return yargs.command(
      "change-id <issue_selector> <new_id>",
      intl.formatMessage(msg.issueChangeIdDescribe),
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
          .positional("new_id", {
            describe: intl.formatMessage(msg.issueChangeIdNewId),
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
          argv.new_id ?? "",
          argv.project,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    newId: string,
    project?: string,
  ): Promise<IssueChangeIdCommandSuccessResponse | ErrorResponse> {
    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const result = await new ChangeIssueIdHelper().changeIssueId(
      repo,
      issue,
      newId,
    );

    return {
      status: "ok",
      result,
    };
  }
}
