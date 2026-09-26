import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueCatCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
export type IssueCatCommandSuccessResponse =
  SuccessResponse<IssueCatCommandSuccessResult>;

const msg = defineMessages({
  issueCatDescribe: {
    id: "cli.issue.cat.describe",
    defaultMessage: "Print an issue's markdown file to stdout",
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

export class IssueCatCommand extends Command {
  name = "issue cat";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueCatCommand();
    return yargs.command(
      "cat <issue_selector>",
      intl.formatMessage(msg.issueCatDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
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
  ): Promise<IssueCatCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    const { issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );
    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();

    if (issueFilePath === undefined) {
      return {
        status: "error",
        error: {
          code: "ISSUE_MD_MISSING",
          message: `No issue file found in ${issue.path}.`,
          details: { path: issue.path },
        },
      };
    }

    if (!(await fileService.exists(issueFilePath))) {
      return {
        status: "error",
        error: {
          code: "ISSUE_MD_MISSING",
          message: `No issue file found in ${issue.path}.`,
          details: { path: issue.path },
        },
      };
    }

    if (await fileService.isBinaryFile(issueFilePath)) {
      return {
        status: "error",
        error: {
          code: "SET_FILE_BINARY",
          message: `File "${issueFilePath}" appears to be a binary file.`,
          details: { path: issueFilePath },
        },
      };
    }

    const content = (await fileService.readFile(
      issueFilePath,
      "utf-8",
    )) as string;

    loggerService.info(content);
    return {
      status: "ok",
      result: { content },
    };
  }
}
