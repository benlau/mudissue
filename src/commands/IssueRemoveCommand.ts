import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueRemoveCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
export type IssueRemoveCommandSuccessResponse =
  SuccessResponse<IssueRemoveCommandSuccessResult>;

const msg = defineMessages({
  issueRemoveDescribe: {
    id: "cli.issue.remove.describe",
    defaultMessage:
      "Remove an issue folder (empty, issue markdown only, or markdown plus files/ attachments)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueIdOrFolder: {
    id: "cli.common.option.issueIdOrFolder",
    defaultMessage: "Issue ID or issue folder name",
  },
  optionDryRun: {
    id: "cli.issue.remove.option.dryRun",
    defaultMessage: "Show what would be removed without deleting anything",
  },
});

export class IssueRemoveCommand extends Command {
  name = "issue remove";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueRemoveCommand();
    return yargs.command(
      "remove <issue_selector>",
      intl.formatMessage(msg.issueRemoveDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("dry-run", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionDryRun),
            default: false,
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueIdOrFolder),
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
          { dryRun: argv["dry-run"] === true },
        );
      },
    );
  }

  async command(
    issueSelector: string,
    project?: string,
    options?: { dryRun?: boolean },
  ): Promise<IssueRemoveCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );
    const storage = new IssueFolderStorage(issue);
    const removed = await storage.remove({ dryRun: options?.dryRun === true });

    if (removed === null) {
      return {
        status: "error",
        error: {
          code: "REMOVE_ISSUE_FOLDER_NOT_EMPTY",
          message:
            "Cannot remove issue folder: it must be empty or contain only the issue markdown file (and optional files/ attachments).",
          details: { path: issue.path },
        },
      };
    }

    for (const p of removed) {
      loggerService.info(`${p} removed`);
    }

    return {
      status: "ok",
      result: { removed },
    };
  }
}
