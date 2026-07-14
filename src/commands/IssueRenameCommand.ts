import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { FileService } from "../services/FileService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueRenameCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
export type IssueRenameCommandSuccessResponse =
  SuccessResponse<IssueRenameCommandSuccessResult>;

const msg = defineMessages({
  issueRenameDescribe: {
    id: "cli.issue.rename.describe",
    defaultMessage:
      "Rename an issue folder from a new title (label unchanged; folder suffix from title, same as create)",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  issueRenameNewName: {
    id: "cli.issue.rename.positional.newName",
    defaultMessage:
      "New issue title (human-readable; used for folder suffix and frontmatter title)",
  },
});

export class IssueRenameCommand extends Command {
  name = "issue rename";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueRenameCommand();
    return yargs.command(
      "rename <issue_selector> <new_name>",
      intl.formatMessage(msg.issueRenameDescribe),
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
          .positional("new_name", {
            describe: intl.formatMessage(msg.issueRenameNewName),
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
          argv.new_name ?? "",
          argv.project,
        );
      },
    );
  }

  async command(
    issueSelector: string,
    newName: string,
    project?: string,
  ): Promise<IssueRenameCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();

    const trimmedTitle = newName.trim();
    if (trimmedTitle === "") {
      this.throwException(
        "RENAME_ISSUE_INVALID_TITLE",
        `Issue title is required.`,
        { new_name: newName },
      );
    }

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const newFolderName = IssueResource.issueIdForTitle(
      issue.label,
      trimmedTitle,
    );

    if (!IssueSelectorMatcher.isValidateFolderName(newFolderName)) {
      this.throwException(
        "RENAME_ISSUE_INVALID_NEW_FOLDER",
        `Invalid computed issue folder name: "${newFolderName}".`,
        { new_issue_folder: newFolderName },
      );
    }

    const existingMatches = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(issue.label, { project });
    const conflicting = existingMatches.find((m) => m.path !== issue.path);
    if (conflicting) {
      this.throwException(
        "RENAME_ISSUE_TARGET_EXISTS",
        `Another issue folder matches label "${issue.label}".`,
        { path: issue.label },
      );
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const trackerRepoStorage = new TrackerRepoStorage(repo, globalConfig);
    const issueRoot = trackerRepoStorage.getIssuePath();
    const currentPath = issue.path;
    const targetPath = path.join(issueRoot, newFolderName);

    if (targetPath !== currentPath) {
      if (await fileService.exists(targetPath)) {
        this.throwException(
          "RENAME_ISSUE_TARGET_EXISTS",
          `Target folder already exists: ${targetPath}.`,
          { path: targetPath },
        );
      }
    }

    const renameResult = await trackerRepoStorage.renameIssue(
      issue,
      newFolderName,
      trimmedTitle,
    );

    return {
      status: "ok",
      result: {
        oldIssueFolderName: renameResult.oldFolderName,
        newIssueFolderName: renameResult.newFolderName,
      },
    };
  }
}
