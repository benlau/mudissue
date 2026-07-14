import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { NextIssueIdHelper } from "../helpers/NextIssueIdHelper.ts";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
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
  file?: string;
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
  issueCreateFile: {
    id: "cli.issue.create.option.file",
    defaultMessage: "Import issue content from file",
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
    defaultMessage: "Issue title (required when not using --file)",
  },
  errorIssueCreateTitle: {
    id: "cli.error.issue.create.title",
    defaultMessage: "Title is required when --file is not used.",
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
    defaultMessage: "--json requires --content",
  },
});

function hasContentOption(content: unknown): boolean {
  return typeof content === "string";
}

export class IssueCreateCommand extends Command {
  name = "issue create";
  private issueResource: IssueResource;

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
          .option("file", {
            type: "string",
            describe: intl.formatMessage(msg.issueCreateFile),
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
            const hasFile = typeof argv.file === "string" && argv.file !== "";
            const hasTitle =
              typeof argv.title === "string" && argv.title !== undefined;
            if (!hasFile && !hasTitle) {
              throw new Error(intl.formatMessage(msg.errorIssueCreateTitle));
            }
            const outputJson =
              argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
            if (outputJson && !hasFile && !hasContentOption(argv.content)) {
              throw new Error(
                intl.formatMessage(msg.errorIssueCreateJsonContent),
              );
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        const hasFile = typeof argv.file === "string" && argv.file !== "";
        const hasContent = hasContentOption(argv.content);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: !hasFile && !hasContent,
        });
        await cmd.runCommand(
          { outputJson },
          {
            title: argv.title as string | undefined,
            id: argv.id as string | undefined,
            project: argv.project as string | undefined,
            parent: argv.parent as string | undefined,
            file: argv.file as string | undefined,
            content: argv.content as string | undefined,
          },
        );
      },
    );
  }

  async command(
    args: IssueCreateCommandArgs,
  ): Promise<IssueCreateCommandSuccessResponse> {
    const { title, id, project, parent, file: filePath, content } = args;
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
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
    if (filePath !== undefined && filePath !== "") {
      const resolvedPath = shellService.isAbsolute(filePath)
        ? filePath
        : path.resolve(shellService.cwd(), filePath);
      if (!(await fileService.exists(resolvedPath))) {
        loggerService.error(`File not found: ${resolvedPath}`);
        this.throwException(
          "CREATE_ISSUE_FILE_NOT_FOUND",
          `File not found: ${resolvedPath}`,
        );
      }
      const stat = await fileService.stat(resolvedPath);
      if (!stat.isFile()) {
        loggerService.error("A directory is not accepted.");
        this.throwException(
          "CREATE_ISSUE_PATH_NOT_FILE",
          "A directory is not accepted.",
        );
      }
      if (await fileService.isBinaryFile(resolvedPath)) {
        loggerService.error("Binary files are not accepted.");
        this.throwException(
          "CREATE_ISSUE_FILE_BINARY",
          "Binary files are not accepted.",
        );
      }

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
      result = await this.issueResource.createFromFile(
        resolvedPath,
        issueFolder,
        issueFilePath,
        fileTitle,
      );
    } else {
      const issueTitle = title ?? "";
      let issueContent = content;
      if (issueContent == null) {
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
