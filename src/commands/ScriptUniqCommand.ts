import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptUniqCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type ScriptUniqCommandSuccessResponse =
  SuccessResponse<ScriptUniqCommandSuccessResult>;

const msg = defineMessages({
  scriptUniqDescribe: {
    id: "cli.script.uniq.describe",
    defaultMessage:
      "Resolve an issue selector to a unique issue folder name for shell scripts",
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

export class ScriptUniqCommand extends Command {
  name = "script uniq";

  static register(yargs: Argv): Argv {
    const cmd = new ScriptUniqCommand();
    return yargs.command(
      "uniq <issue_selector>",
      intl.formatMessage(msg.scriptUniqDescribe),
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
  ): Promise<ScriptUniqCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();
    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const issueFolderName = issue.issueId;
    loggerService.info(issueFolderName);

    return {
      status: "ok",
      result: { issueFolderName },
    };
  }
}
