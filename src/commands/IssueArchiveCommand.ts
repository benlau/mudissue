import * as path from "path";
import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import {
  type ErrorResponse,
  type IssueArchiveCommandSuccessResult,
  type SuccessResponse,
} from "../types/Response.ts";
export type IssueArchiveCommandSuccessResponse =
  SuccessResponse<IssueArchiveCommandSuccessResult>;

const msg = defineMessages({
  issueArchiveDescribe: {
    id: "cli.issue.archive.describe",
    defaultMessage: "Move an issue folder into issues/.archive",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueIdOrFolder: {
    id: "cli.common.option.issueIdOrFolder",
    defaultMessage: "Issue ID or issue folder name",
  },
});

export class IssueArchiveCommand extends Command {
  name = "issue archive";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueArchiveCommand();
    return yargs.command(
      "archive <issue_selector>",
      intl.formatMessage(msg.issueArchiveDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
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
        );
      },
    );
  }

  async command(
    issueSelector: string,
    project?: string,
  ): Promise<IssueArchiveCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const getArchivePath = useCurrentTrackerRepoStore.getState().getArchivePath;
    const archiveDir = await getArchivePath(repo);
    await fileService.mkdir(archiveDir, { recursive: true });

    const dest = await getArchivePath(repo, issue.folderName);
    if (await fileService.exists(dest)) {
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
    await fileService.rename(oldIssueFolderPath, dest);

    const issueFileName = path.basename(issueFilePath);
    const newIssueFilePath = path.join(dest, issueFileName);

    loggerService.info(`Archived issue folder to ${dest}`);

    return {
      status: "ok",
      result: {
        archivedIssue: {
          issueId: issue.issueId,
          issueFolderName: issue.folderName,
          issueFilePath: newIssueFilePath,
        },
        oldIssueFolderPath,
        newIssueFolderPath: dest,
      },
    };
  }
}
