import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { CurrentIssueResolverHelper } from "../helpers/CurrentIssueResolverHelper.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueLocateCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { LocateIssueNoIssueFile } from "../types/errors.ts";
export type IssueLocateCommandSuccessResponse =
  SuccessResponse<IssueLocateCommandSuccessResult>;

const msg = defineMessages({
  issueLocateDescribe: {
    id: "cli.issue.locate.describe",
    defaultMessage: "Print the path of an issue's markdown file",
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

export class IssueLocateCommand extends Command {
  name = "issue locate";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueLocateCommand();
    return yargs.command(
      "locate <issue_selector>",
      intl.formatMessage(msg.issueLocateDescribe),
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
  ): Promise<IssueLocateCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    if (project) {
      new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    }

    let folderList: IssueFolder[];
    if (CurrentIssueResolverHelper.isCurrentIssueSelector(issueSelector)) {
      folderList = [await CurrentIssueResolverHelper.resolveCurrentIssue()];
    } else {
      const folders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(issueSelector, {
          project,
        });
      new IssueFolderValidator().set(folders).validateIssueNotNone();
      folderList = Array.isArray(folders) ? folders : [folders];
    }

    const paths: string[] = [];
    for (const issue of folderList) {
      const storage = new IssueFolderStorage(issue);
      const issueFilePath = await storage.findIssueFile();
      if (issueFilePath !== undefined) {
        paths.push(issueFilePath);
      }
    }
    if (paths.length === 0) {
      const firstFolder = folderList[0];
      const details: LocateIssueNoIssueFile = {
        path: firstFolder.path,
      };
      return {
        status: "error",
        error: {
          code: "LOCATE_ISSUE_NO_ISSUE_FILE",
          message: `No issue file found in ${firstFolder.path}.`,
          details,
        },
      };
    }

    for (const path of paths) {
      loggerService.info(path);
    }
    return {
      status: "ok",
      result: {
        paths,
      },
    };
  }
}
