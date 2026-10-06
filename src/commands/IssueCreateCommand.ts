import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueResource } from "../async/resources/IssueResource.ts";
import { TrackerRepoStorage } from "../async/storage/TrackerRepoStorage.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import {
  IssueBodyContentHelper,
  type ThrowCommandException,
} from "../helpers/IssueBodyContentHelper.ts";
import { NextIssueIdHelper } from "../helpers/NextIssueIdHelper.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../async/validators/IssueFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  IssueCreateCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { TrackerRepo } from "../types/Tracker.ts";

export type IssueCreateCommandArgs = {
  title?: string;
  id?: string;
  project?: string;
  parent?: string;
  importFromMd?: string;
  fromFile?: string;
  fromEnvVar?: string;
  content?: string;
};

export type IssueCreateCommandSuccessResponse =
  SuccessResponse<IssueCreateCommandSuccessResult>;

export type IssueCreateCommandProps = {
  issueResource?: IssueResource;
};

const msg = defineMessages({
  issueCreateDescribe: {
    id: "cli.issue.create.describe",
    defaultMessage: "Create a new issue",
  },
  issueCreateImportFromMd: {
    id: "cli.issue.create.option.importFromMd",
    defaultMessage: "Import full issue markdown from file",
  },
  issueCreateFromFile: {
    id: "cli.issue.create.option.fromFile",
    defaultMessage: "Issue body text from file",
  },
  issueCreateFromEnvVar: {
    id: "cli.issue.create.option.fromEnvVar",
    defaultMessage: "Issue body text from environment variable",
  },
  issueCreateId: {
    id: "cli.issue.create.option.id",
    defaultMessage: "Explicit issue ID",
  },
  issueCreateParent: {
    id: "cli.issue.create.option.parent",
    defaultMessage: "Parent issue ID or selector",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  issueCreateTitle: {
    id: "cli.issue.create.positional.title",
    defaultMessage: "Issue title (required when not using --import-from-md)",
  },
  errorIssueCreateTitle: {
    id: "cli.error.issue.create.title",
    defaultMessage: "Title is required when --import-from-md is not used.",
  },
  errorIssueCreateImportWithBody: {
    id: "cli.error.issue.create.importWithBody",
    defaultMessage:
      "--import-from-md cannot be combined with --content, --from-file, or --from-env-var.",
  },
  issueCreateContent: {
    id: "cli.issue.create.option.content",
    defaultMessage: "Issue body text",
  },
  issueContentPrompt: {
    id: "cli.issue.create.prompt.content",
    defaultMessage: "Type issue content (Ctrl+D to confirm):",
  },
  errorIssueCreateJsonContent: {
    id: "cli.error.issue.create.jsonContent",
    defaultMessage:
      "--json requires --import-from-md, --content, --from-file, or --from-env-var",
  },
});

const createFileErrorCodes = {
  fileNotFound: "CREATE_ISSUE_FILE_NOT_FOUND",
  pathNotFile: "CREATE_ISSUE_PATH_NOT_FILE",
  fileBinary: "CREATE_ISSUE_FILE_BINARY",
} as const;

export class IssueCreateCommand extends Command {
  name = "issue create";
  private issueResource: IssueResource;
  private bodyContentHelper = new IssueBodyContentHelper();

  constructor(props: IssueCreateCommandProps = {}) {
    super();
    this.issueResource = props.issueResource ?? new IssueResource();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueCreateCommand();
    return yargs.command(
      "create [title]",
      intl.formatMessage(msg.issueCreateDescribe),
      (builder) =>
        builder
          .option("import-from-md", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateImportFromMd),
          })
          .option("from-file", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateFromFile),
          })
          .option("from-env-var", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateFromEnvVar),
          })
          .option("id", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateId),
          })
          .option("parent", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateParent),
          })
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("content", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateContent),
          })
          .positional("title", {
            describe: intl.formatMessage(msg.issueCreateTitle),
            type: "string",
          })
          .check((argv) => {
            const hasImport = IssueBodyContentHelper.hasNonEmptyString(
              argv.importFromMd,
            );
            IssueBodyContentHelper.assertAtMostOneBodySource(argv);
            if (
              hasImport &&
              IssueBodyContentHelper.hasHeadlessBodySource(argv)
            ) {
              throw new Error(
                intl.formatMessage(msg.errorIssueCreateImportWithBody),
              );
            }
            const hasTitle =
              typeof argv.title === "string" && argv.title !== undefined;
            if (!hasImport && !hasTitle) {
              throw new Error(intl.formatMessage(msg.errorIssueCreateTitle));
            }
            const outputJson =
              argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
            if (
              outputJson &&
              !hasImport &&
              !IssueBodyContentHelper.hasHeadlessBodySource(argv)
            ) {
              throw new Error(
                intl.formatMessage(msg.errorIssueCreateJsonContent),
              );
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        const hasImport = IssueBodyContentHelper.hasNonEmptyString(
          argv.importFromMd,
        );
        const hasBody = IssueBodyContentHelper.hasHeadlessBodySource(argv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !hasImport && !hasBody,
        });
        await cmd.runCommand(
          { outputJson },
          {
            title: argv.title as string | undefined,
            id: argv.id as string | undefined,
            project: argv.project as string | undefined,
            parent: argv.parent as string | undefined,
            importFromMd: argv.importFromMd as string | undefined,
            fromFile: argv.fromFile as string | undefined,
            fromEnvVar: argv.fromEnvVar as string | undefined,
            content: argv.content as string | undefined,
          },
        );
      },
    );
  }

  private async importMarkdownPath(
    importPath: string,
    id: string | undefined,
    storage: TrackerRepoStorage,
    nextIssueIdHelper: NextIssueIdHelper,
  ): Promise<IssueFolder> {
    const loggerService = LoggerService.getInstance();
    const resolvedPath =
      await this.bodyContentHelper.resolveReadableTextFilePath(
        importPath,
        createFileErrorCodes,
        (code, message) => this.throwException(code, message),
      );

    const fileTitle = await IssueResource.deriveTitleFromFile(resolvedPath);
    let issueId: string;
    try {
      issueId = await nextIssueIdHelper.resolveIssueId(id, fileTitle);
    } catch (err) {
      if (err instanceof Error) {
        loggerService.error(err.message);
      }
      throw err;
    }
    const folderBasename = IssueResource.issueIdForTitle(issueId, fileTitle);
    const issueDirPath = path.join(storage.getIssuePath(), folderBasename);
    const issueFolder: IssueFolder = {
      issueId: folderBasename,
      label: issueId,
      path: issueDirPath,
    };
    const issueFilePath = await storage.resolveIssueFilePath(issueFolder);
    return this.issueResource.createFromFile(
      resolvedPath,
      issueFolder,
      issueFilePath,
      fileTitle,
    );
  }

  async command(
    args: IssueCreateCommandArgs,
  ): Promise<IssueCreateCommandSuccessResponse> {
    const {
      title,
      id,
      project,
      parent,
      importFromMd: importPath,
      fromFile,
      fromEnvVar,
      content,
    } = args;
    const loggerService = LoggerService.getInstance();

    let targetRepo: TrackerRepo;
    if (project) {
      targetRepo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    } else {
      targetRepo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
    }

    let parentFolder: IssueFolder | undefined;
    if (parent) {
      const folders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(parent);
      parentFolder = new IssueFolderValidator()
        .set(folders)
        .validateIssueNotNone()
        .validateIssueNotMultiple()
        .first();
    }
    const parentIssueFolderName = parentFolder?.issueId;

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const storage = new TrackerRepoStorage(targetRepo, globalConfig);
    const nextIssueIdHelper = new NextIssueIdHelper(storage);

    let result: IssueFolder;
    if (importPath !== undefined && importPath !== "") {
      result = await this.importMarkdownPath(
        importPath,
        id,
        storage,
        nextIssueIdHelper,
      );
    } else {
      const issueTitle = title ?? "";
      let issueContent: string | undefined;
      const throwBodyError: ThrowCommandException = (code, message) =>
        this.throwException(code, message);
      if (fromEnvVar !== undefined && fromEnvVar !== "") {
        issueContent = await this.bodyContentHelper.readBodyFromEnvVar(
          fromEnvVar,
          { envVarMissing: "CREATE_ISSUE_ENV_VAR_MISSING" },
          throwBodyError,
        );
      } else if (fromFile !== undefined && fromFile !== "") {
        issueContent = await this.bodyContentHelper.readBodyFromFile(
          fromFile,
          createFileErrorCodes,
          throwBodyError,
        );
      } else if (content !== undefined) {
        issueContent = content;
      } else {
        const entered = await this.askUserTextContent(
          intl.formatMessage(msg.issueContentPrompt),
        );
        if (entered == null) {
          this.throwException(
            "CREATE_ISSUE_CONTENT_EMPTY",
            "Issue content was not provided.",
          );
        }
        issueContent = entered;
      }
      let issueId: string;
      try {
        issueId = await nextIssueIdHelper.resolveIssueId(id, issueTitle);
      } catch (err) {
        if (err instanceof Error) {
          loggerService.error(err.message);
        }
        throw err;
      }
      const folderBasename = IssueResource.issueIdForTitle(issueId, issueTitle);
      const issueDirPath = path.join(storage.getIssuePath(), folderBasename);
      const issueFolder: IssueFolder = {
        issueId: folderBasename,
        label: issueId,
        path: issueDirPath,
      };
      const issueFilePath = await storage.resolveIssueFilePath(issueFolder);
      const issueFilePattern = storage.getIssueFilePattern();
      result = await this.issueResource.create(
        issueFolder,
        issueFilePath,
        issueTitle,
        parentIssueFolderName,
        storage.getDefaultStatus(),
        storage.getDefaultPriority(),
        issueFilePattern,
        issueContent,
      );
    }

    if (parentFolder) {
      const parentFolderStorage = new IssueFolderStorage(parentFolder);
      await parentFolderStorage.appendSubissue(
        result.issueId,
        storage.getIssueFilePattern(),
      );
    }

    const issueFilePath = await storage.resolveIssueFilePath(result);
    loggerService.info(`Created issue at ${issueFilePath}`);
    return {
      status: "ok",
      result: {
        createdIssue: {
          issueId: result.issueId,
          issueFolderName: result.issueId,
          issueFilePath,
        },
      },
    };
  }
}
