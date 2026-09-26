import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { TrackerRepoStorage } from "../async/storage/TrackerRepoStorage.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  IssueTouchCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type IssueTouchCommandSuccessResponse =
  SuccessResponse<IssueTouchCommandSuccessResult>;

const msg = defineMessages({
  issueTouchDescribe: {
    id: "cli.issue.touch.describe",
    defaultMessage:
      "Set an issue markdown file's updated_at to the current time",
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

export class IssueTouchCommand extends Command {
  name = "issue touch";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueTouchCommand();
    return yargs.command(
      "touch <issue_selector>",
      intl.formatMessage(msg.issueTouchDescribe),
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
  ): Promise<IssueTouchCommandSuccessResponse | ErrorResponse> {
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
          message: `No issue file found in ${issue.path}.`,
          details: { path: issue.path },
        },
      };
    }

    const updatedAt = await folderStorage.touchUpdatedAt();

    const resolvedIssueFile = new TrackerRepoStorage(
      repo,
      globalConfig,
    ).resolveFilePath(issueFilePath);
    return {
      status: "ok",
      result: {
        issueFilePath: resolvedIssueFile.absPath,
        updatedAt: updatedAt.toISOString(),
      },
    };
  }
}
