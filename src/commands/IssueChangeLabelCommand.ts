import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { ChangeIssueLabelHelper } from "../helpers/ChangeIssueLabelHelper.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { intl } from "../intl.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueChangeLabelCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueChangeLabelCommandSuccessResponse =
  SuccessResponse<IssueChangeLabelCommandSuccessResult>;

const msg = defineMessages({
  issueChangeLabelDescribe: {
    id: "cli.issue.changeLabel.describe",
    defaultMessage:
      "Change an issue label (folder prefix and number; suffix unchanged)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  issueChangeLabelNewLabel: {
    id: "cli.issue.changeLabel.positional.newLabel",
    defaultMessage: "New issue label (prefix and number only)",
  },
});

export class IssueChangeLabelCommand extends Command {
  name = "issue change-label";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueChangeLabelCommand();
    return yargs.command(
      "change-label <issue_selector> <new_label>",
      intl.formatMessage(msg.issueChangeLabelDescribe),
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
          .positional("new_label", {
            describe: intl.formatMessage(msg.issueChangeLabelNewLabel),
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
          argv.new_label ?? "",
          argv.project,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    newLabel: string,
    project?: string,
  ): Promise<IssueChangeLabelCommandSuccessResponse | ErrorResponse> {
    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const result = await new ChangeIssueLabelHelper().changeIssueLabel(
      repo,
      issue,
      newLabel,
    );

    return {
      status: "ok",
      result,
    };
  }
}
