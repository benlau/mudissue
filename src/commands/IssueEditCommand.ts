import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { EditorLauncher } from "../async/launchers/EditorLauncher.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { IssueSelectorArgumentHelper } from "../helpers/IssueSelectorArgumentHelper.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { IssueFolderStorage } from "../async/storage/IssueFolderStorage.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  IssueEditCommandSuccessResult,
  ErrorResponse,
  SuccessResponse,
} from "../types/Response.ts";
export type IssueEditCommandSuccessResponse =
  SuccessResponse<IssueEditCommandSuccessResult>;

const msg = defineMessages({
  issueEditDescribe: {
    id: "cli.issue.edit.describe",
    defaultMessage: "Edit an issue's markdown file",
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

export class IssueEditCommand extends Command {
  name = "issue edit";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueEditCommand();
    return yargs.command(
      "edit <issue_selector>",
      intl.formatMessage(msg.issueEditDescribe),
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
  ): Promise<IssueEditCommandSuccessResponse | ErrorResponse> {
    const loggerService = LoggerService.getInstance();

    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );
    const storage = new IssueFolderStorage(issue);
    const issueFilePath = await storage.findIssueFile();
    if (issueFilePath === undefined) {
      return {
        status: "error",
        error: {
          code: "EDIT_ISSUE_NO_ISSUE_FILE",
          message: `No issue file found in ${issue.path}.`,
          details: { path: issue.path },
        },
      };
    }

    const editor = await useCurrentTrackerRepoStore
      .getState()
      .getEditor(repo.config);
    if (editor === null) {
      return {
        status: "error",
        error: {
          code: "EDITOR_NOT_FOUND",
          message: "No editor found.",
        },
      };
    }
    const command = await new EditorLauncher().launch(editor, {
      filePath: issueFilePath,
      isBlocked: false,
    });
    loggerService.info(command);
    return {
      status: "ok",
      result: { openedFile: issueFilePath, command },
    };
  }
}
