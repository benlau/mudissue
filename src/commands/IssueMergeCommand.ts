import * as path from "path";
import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { NextIssueIdHelper } from "../helpers/NextIssueIdHelper.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { IssueMergeSectionGenerator } from "../utils/generators/IssueMergeSectionGenerator.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import {
  type ErrorResponse,
  type IssueArchiveCommandSuccessResult,
  type IssueMergeCommandSuccessResult,
  type SuccessResponse,
} from "../types/Response.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { TrackerRepo } from "../types/Tracker.ts";

export type IssueMergeCommandArgs = {
  issueSelectors: string[];
  title?: string;
  project?: string;
};

export type IssueMergeCommandSuccessResponse =
  SuccessResponse<IssueMergeCommandSuccessResult>;

const msg = defineMessages({
  issueMergeDescribe: {
    id: "cli.issue.merge.describe",
    defaultMessage:
      "Merge multiple issues into a new issue and archive sources",
  },
  issueMergeTitle: {
    id: "cli.issue.merge.option.title",
    defaultMessage: "Title for the merged issue",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  errorIssueMergeTooFew: {
    id: "cli.error.issue.merge.tooFew",
    defaultMessage: "At least two issue selectors are required.",
  },
});

export class IssueMergeCommand extends Command {
  name = "issue merge";
  private readonly issueResource = new IssueResource();
  private readonly mergeSectionGenerator = new IssueMergeSectionGenerator();

  private get fileService(): FileService {
    return FileService.getInstance();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueMergeCommand();
    return yargs.command(
      "merge <issue_selector..>",
      intl.formatMessage(msg.issueMergeDescribe),
      (builder) =>
        builder
          .option("title", {
            type: "string",
            describe: intl.formatMessage(msg.issueMergeTitle),
          })
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueSelector),
            type: "string",
            array: true,
            demandOption: true,
          })
          .check((argv) => {
            const selectors = argv.issue_selector;
            if (!Array.isArray(selectors) || selectors.length < 2) {
              throw new Error(intl.formatMessage(msg.errorIssueMergeTooFew));
            }
            return true;
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        const selectors = Array.isArray(argv.issue_selector)
          ? argv.issue_selector
          : [argv.issue_selector ?? ""];
        await cmd.runCommand(
          { outputJson },
          {
            issueSelectors: selectors,
            title: argv.title as string | undefined,
            project: argv.project as string | undefined,
          },
        );
      },
    );
  }

  async command(
    args: IssueMergeCommandArgs,
  ): Promise<IssueMergeCommandSuccessResponse | ErrorResponse> {
    const { issueSelectors, title, project } = args;
    const loggerService = LoggerService.getInstance();

    const repo = await this.resolveRepo(project);
    const sourceIssues = await this.resolveSourceIssues(
      issueSelectors,
      project,
    );

    const mergedTitle =
      title?.trim() !== "" && title !== undefined
        ? title.trim()
        : `${await this.mergeSectionGenerator.deriveTitle(sourceIssues[0])}-merged`;

    const mergedContent =
      await this.mergeSectionGenerator.renderMergedContent(sourceIssues);

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const storage = new TrackerRepoStorage(repo, globalConfig);

    const issueId = await new NextIssueIdHelper(storage).allocateNextIssueId();
    const folderName = IssueResource.folderNameForTitle(issueId, mergedTitle);
    const issueDirPath = path.join(storage.getIssuePath(), folderName);
    const issueFolder: IssueFolder = {
      issueId,
      folderName,
      path: issueDirPath,
    };
    const issueFilePath = await storage.resolveIssueFilePath(issueFolder);
    const issueFilePattern = storage.getIssueFilePattern();

    const createdFolder = await this.issueResource.create(
      issueFolder,
      issueFilePath,
      mergedTitle,
      undefined,
      storage.getDefaultStatus(),
      storage.getDefaultPriority(),
      issueFilePattern,
      mergedContent,
    );

    const createdIssue = {
      createdIssue: {
        issueId: createdFolder.issueId,
        issueFolderName: createdFolder.folderName,
        issueFilePath,
      },
    };

    const archivedIssues: IssueArchiveCommandSuccessResult[] = [];
    for (const issue of sourceIssues) {
      archivedIssues.push(await this.archiveIssue(repo, issue));
    }

    loggerService.info(`Created new issue at: ${issueFilePath}`);
    for (const archived of archivedIssues) {
      loggerService.info(`Archived issue to: ${archived.newIssueFolderPath}`);
    }

    return {
      status: "ok",
      result: {
        createdIssue,
        archivedIssues,
      },
    };
  }

  private async resolveRepo(project?: string): Promise<TrackerRepo> {
    if (project) {
      return new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    }
    return useCurrentTrackerRepoStore.getState().getCurrentTrackerRepo();
  }

  private async resolveSourceIssues(
    issueSelectors: string[],
    project?: string,
  ): Promise<IssueFolder[]> {
    const resolved: IssueFolder[] = [];
    const seenFolderNames = new Set<string>();

    for (const selector of issueSelectors) {
      const { issue } =
        await IssueSelectorArgumentHelper.processIssueSelectorArgument(
          selector,
          project,
        );
      if (seenFolderNames.has(issue.folderName)) {
        this.throwException(
          "ISSUE_MERGE_DUPLICATE",
          `Duplicate issue in merge list: ${issue.folderName}`,
          { folderName: issue.folderName },
        );
      }
      seenFolderNames.add(issue.folderName);
      resolved.push(issue);
    }

    return resolved;
  }

  private async archiveIssue(
    repo: TrackerRepo,
    issue: IssueFolder,
  ): Promise<IssueArchiveCommandSuccessResult> {
    const getArchivePath = useCurrentTrackerRepoStore.getState().getArchivePath;
    const archiveDir = await getArchivePath(repo);
    await this.fileService.mkdir(archiveDir, { recursive: true });

    const dest = await getArchivePath(repo, issue.folderName);
    if (await this.fileService.exists(dest)) {
      this.throwException(
        "ARCHIVE_TARGET_EXISTS",
        `Archive target already exists: ${dest}`,
        { path: dest },
      );
    }

    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();
    if (issueFilePath === undefined) {
      this.throwException(
        "ISSUE_MD_MISSING",
        `No issue file found in ${issue.path}.`,
        { path: issue.path },
      );
    }

    const oldIssueFolderPath = issue.path;
    await this.fileService.rename(oldIssueFolderPath, dest);

    const issueFileName = path.basename(issueFilePath);
    const newIssueFilePath = path.join(dest, issueFileName);

    return {
      archivedIssue: {
        issueId: issue.issueId,
        issueFolderName: issue.folderName,
        issueFilePath: newIssueFilePath,
      },
      oldIssueFolderPath,
      newIssueFolderPath: dest,
    };
  }
}
