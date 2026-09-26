import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../async/storage/IssueMarkdownFileStorage.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { FrontmatterValidator } from "../async/validators/FrontmatterValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueGetPropertyCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueGetPropertyCommandSuccessResponse =
  SuccessResponse<IssueGetPropertyCommandSuccessResult>;

function formatFrontmatterValueForStdout(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

const msg = defineMessages({
  issueGetPropertyDescribe: {
    id: "cli.issue.getProperty.describe",
    defaultMessage: "Get a frontmatter property from an issue's issue.md",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionPropertyName: {
    id: "cli.common.option.propertyName",
    defaultMessage: "Property name to get",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
});

export class IssueGetPropertyCommand extends Command {
  name = "issue get-property";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueGetPropertyCommand();
    return yargs.command(
      "get-property <issue_selector> <property>",
      intl.formatMessage(msg.issueGetPropertyDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
          })
          .positional("property", {
            describe: intl.formatMessage(msg.optionPropertyName),
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
          argv.property ?? "",
          argv.project,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    property: string,
    project?: string,
  ): Promise<IssueGetPropertyCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    if (!FrontmatterValidator.isValidPropertyKey(property)) {
      return {
        status: "error",
        error: {
          code: "SET_ISSUE_INVALID_PROPERTY",
          message:
            "Invalid property key. Use only letters, numbers, underscores, and hyphens.",
          details: { property },
        },
      };
    }

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

    const storage = new IssueMarkdownFileStorage(issueFilePath);
    await storage.load();

    if (storage.getStatus() === "PARSE_ERROR") {
      return {
        status: "error",
        error: {
          code: "FRONT_MATTER_PARSING_ERROR",
          message: `Failed to parse frontmatter in ${issueFilePath}.`,
          details: { path: issueFilePath },
        },
      };
    }

    const value = storage.getProperty(property);
    if (value === undefined) {
      return {
        status: "error",
        error: {
          code: "GET_ISSUE_PROPERTY_NOT_FOUND",
          message: `Property "${property}" not found in issue frontmatter.`,
          details: { property, issueFilePath },
        },
      };
    }

    loggerService.info(formatFrontmatterValueForStdout(value));
    return {
      status: "ok",
      result: {
        issueFilePath,
        property,
        value,
      },
    };
  }
}
