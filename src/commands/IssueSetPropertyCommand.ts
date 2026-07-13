import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../utils/storage/IssueMarkdownFileStorage.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { IssueMetadataChangedPostHookContext } from "../store/IssueMetadataChangedPostHookStore.ts";
import { FrontmatterValidator } from "../utils/validators/FrontmatterValidator.ts";
import {
  FrontmatterValueValidator,
  type FrontmatterValueType,
} from "../utils/validators/FrontmatterValueValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueSetPropertyCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueSetPropertyCommandSuccessResponse =
  SuccessResponse<IssueSetPropertyCommandSuccessResult>;

export type IssueSetPropertyCommandOptions = {
  skipUpdatedAt?: boolean;
  type?: string;
  skipIfPresent?: boolean;
};

const msg = defineMessages({
  issueSetPropertyDescribe: {
    id: "cli.issue.setProperty.describe",
    defaultMessage: "Set a frontmatter property in an issue's issue.md",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionPropertyName: {
    id: "cli.common.option.propertyName",
    defaultMessage: "Property name to set",
  },
  optionValue: {
    id: "cli.common.option.value",
    defaultMessage: "Value to set",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  optionSkipUpdatedAt: {
    id: "cli.issue.setProperty.option.skipUpdatedAt",
    defaultMessage: "Do not update frontmatter updated_at",
  },
  optionType: {
    id: "cli.issue.setProperty.option.type",
    defaultMessage: "Value type: string, boolean, or number",
  },
  optionSkipIfPresent: {
    id: "cli.issue.setProperty.option.skipIfPresent",
    defaultMessage: "Do not modify the property if it is already present",
  },
  typeInvalid: {
    id: "cli.issue.setProperty.error.typeInvalid",
    defaultMessage: 'Invalid type "{value}". Use string, boolean, or number.',
  },
  booleanInvalid: {
    id: "cli.issue.setProperty.error.booleanInvalid",
    defaultMessage:
      'Invalid boolean value "{value}". Use yes/no/true/false/1/0.',
  },
  numberInvalid: {
    id: "cli.issue.setProperty.error.numberInvalid",
    defaultMessage: 'Invalid number value "{value}".',
  },
  invalidProperty: {
    id: "cli.issue.setProperty.error.invalidProperty",
    defaultMessage:
      "Invalid property key. Use only letters, numbers, underscores, and hyphens.",
  },
  issueMdMissing: {
    id: "cli.issue.setProperty.error.issueMdMissing",
    defaultMessage: "No issue file found in {path}.",
  },
  fileBinary: {
    id: "cli.issue.setProperty.error.fileBinary",
    defaultMessage: 'File "{path}" appears to be a binary file.',
  },
});

export class IssueSetPropertyCommand extends Command {
  name = "issue set-property";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueSetPropertyCommand();
    return yargs.command(
      "set-property <issue_selector> <property> <value>",
      intl.formatMessage(msg.issueSetPropertyDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("skip-updated-at", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionSkipUpdatedAt),
            default: false,
          })
          .option("type", {
            type: "string",
            choices: ["string", "boolean", "number"] as const,
            describe: intl.formatMessage(msg.optionType),
            default: "string",
          })
          .option("skip-if-present", {
            type: "boolean",
            describe: intl.formatMessage(msg.optionSkipIfPresent),
            default: false,
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
          })
          .positional("property", {
            describe: intl.formatMessage(msg.optionPropertyName),
            type: "string",
          })
          .positional("value", {
            describe: intl.formatMessage(msg.optionValue),
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
          argv.value ?? "",
          argv.project,
          {
            skipUpdatedAt: argv["skip-updated-at"] === true,
            type: argv.type as FrontmatterValueType,
            skipIfPresent: argv["skip-if-present"] === true,
          },
        );
      },
    );
  }

  async command(
    issueSelector: string,
    property: string,
    value: string,
    project?: string,
    options: IssueSetPropertyCommandOptions = {},
  ): Promise<IssueSetPropertyCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    if (!FrontmatterValidator.isValidPropertyKey(property)) {
      return {
        status: "error",
        error: {
          code: "SET_ISSUE_INVALID_PROPERTY",
          message: intl.formatMessage(msg.invalidProperty),
          details: { property },
        },
      };
    }

    const valueType = options.type ?? "string";
    if (!FrontmatterValueValidator.isValidType(valueType)) {
      this.throwException(
        "COMMAND_INVALID_ARG",
        intl.formatMessage(msg.typeInvalid, { value: valueType }),
        { argument: "type", value: valueType },
      );
    }

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );
    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();

    if (issueFilePath === undefined) {
      return {
        status: "error",
        error: {
          code: "ISSUE_MD_MISSING",
          message: intl.formatMessage(msg.issueMdMissing, {
            path: issue.path,
          }),
          details: { path: issue.path },
        },
      };
    }

    if (await fileService.isBinaryFile(issueFilePath)) {
      return {
        status: "error",
        error: {
          code: "SET_FILE_BINARY",
          message: intl.formatMessage(msg.fileBinary, {
            path: issueFilePath,
          }),
          details: { path: issueFilePath },
        },
      };
    }

    const resolvedIssueFile = new TrackerRepoStorage(
      repo,
      globalConfig,
    ).resolveFilePath(issueFilePath);

    const storage = new IssueMarkdownFileStorage(issueFilePath);
    await storage.load();

    if (options.skipIfPresent === true) {
      const existing = storage.getProperty(property);
      if (existing !== undefined) {
        return {
          status: "ok",
          result: {
            issueFilePath: resolvedIssueFile.absPath,
            property,
            value: existing,
            skipped: true,
          },
        };
      }
    }

    const coerced = FrontmatterValueValidator.coerce(valueType, value);
    if (!coerced.ok) {
      let message: string;
      switch (coerced.code) {
        case "invalid_type":
          message = intl.formatMessage(msg.typeInvalid, { value: valueType });
          break;
        case "invalid_boolean":
          message = intl.formatMessage(msg.booleanInvalid, { value });
          break;
        case "invalid_number":
          message = intl.formatMessage(msg.numberInvalid, { value });
          break;
      }
      this.throwException("COMMAND_INVALID_ARG", message, {
        argument: coerced.argument,
        value: coerced.argument === "type" ? valueType : value,
      });
    }

    const postHookContext = new IssueMetadataChangedPostHookContext();
    await postHookContext.readOldMetadata(issue, project);

    storage.setProperty(property, coerced.value);
    await storage.save();
    loggerService.info(
      `Set property "${property}" to "${coerced.value}" in ${issueFilePath}`,
    );

    let updatedAt: Date | undefined;
    if (options.skipUpdatedAt !== true) {
      updatedAt = await folderStorage.touchUpdatedAt();
    }

    await postHookContext.notifyMetadataChanged();

    return {
      status: "ok",
      result: {
        issueFilePath: resolvedIssueFile.absPath,
        property,
        value: coerced.value,
        ...(updatedAt !== undefined && {
          updatedAt: updatedAt.toISOString(),
        }),
      },
    };
  }
}
