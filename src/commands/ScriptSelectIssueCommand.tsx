import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
} from "../store/IssueSearchStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptSelectIssueCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { IssueFolder } from "../types/Issue.ts";

export const SCRIPT_SELECT_ISSUE_LATEST_LIMIT = 10;

export type ScriptSelectIssueCommandSuccessResponse =
  SuccessResponse<ScriptSelectIssueCommandSuccessResult>;

const msg = defineMessages({
  scriptSelectIssueDescribe: {
    id: "cli.script.selectIssue.describe",
    defaultMessage: "Select an issue for use in shell scripts",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionIssueIdOrFolder: {
    id: "cli.common.option.issueIdOrFolder",
    defaultMessage: "Issue ID or issue folder name",
  },
  optionOutput: {
    id: "cli.script.selectIssue.option.output",
    defaultMessage: "Write the selected issue folder name to this file",
  },
  pickDialogTitle: {
    id: "cli.script.selectIssue.pickDialogTitle",
    defaultMessage: "Select issue",
  },
  pickDialogTitleMultipleMatches: {
    id: "cli.script.selectIssue.pickDialogTitleMultipleMatches",
    defaultMessage: "Multiple issues matched — select one",
  },
  cancelled: {
    id: "cli.script.selectIssue.cancelled",
    defaultMessage: "Issue selection cancelled",
  },
});

export class ScriptSelectIssueCommand extends Command {
  name = "script select-issue";

  static register(yargs: Argv): Argv {
    const cmd = new ScriptSelectIssueCommand();
    return yargs.command(
      "select-issue [issue_selector]",
      intl.formatMessage(msg.scriptSelectIssueDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("output", {
            type: "string",
            describe: intl.formatMessage(msg.optionOutput),
          })
          .positional("issue_selector", {
            describe: intl.formatMessage(msg.optionIssueIdOrFolder),
            type: "string",
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: true,
        });
        const result = await cmd.runCommand(
          { outputJson },
          argv.issue_selector,
          argv.project,
          argv.output,
        );
        if (result && typeof result === "object" && result.status === "error") {
          process.exitCode = 1;
        }
      },
    );
  }

  async command(
    issueSelector: string | undefined,
    project?: string,
    outputPath?: string,
  ): Promise<ScriptSelectIssueCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
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

    await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();

    const candidates = await this.resolveCandidates(issueSelector, project);
    const selected = await this.resolveSelectedIssue(
      candidates,
      issueSelector,
    );
    if (selected.status === "error") {
      return selected;
    }

    const issueFolderName = selected.result.issueFolderName;
    if (outputPath !== undefined && outputPath.trim() !== "") {
      await fileService.writeFile(outputPath, `${issueFolderName}\n`, "utf-8");
    } else {
      loggerService.info(issueFolderName);
    }

    return {
      status: "ok",
      result: { issueFolderName },
    };
  }

  private async resolveCandidates(
    issueSelector: string | undefined,
    project?: string,
  ): Promise<IssueFolder[]> {
    if (issueSelector !== undefined && issueSelector.trim() !== "") {
      const folders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(issueSelector, { project });
      new IssueFolderValidator().set(folders).validateIssueNotNone();
      return Array.isArray(folders) ? folders : [folders];
    }

    const latestIssues = await IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    )
      .getState()
      .searchAllFolders("");
    const candidates = latestIssues.slice(0, SCRIPT_SELECT_ISSUE_LATEST_LIMIT);
    new IssueFolderValidator().set(candidates).validateIssueNotNone();
    return candidates;
  }

  private async resolveSelectedIssue(
    candidates: IssueFolder[],
    issueSelector: string | undefined,
  ): Promise<
    ScriptSelectIssueCommandSuccessResponse | ErrorResponse
  > {
    if (candidates.length === 1) {
      return {
        status: "ok",
        result: { issueFolderName: candidates[0]!.folderName },
      };
    }

    const hasSelector =
      issueSelector !== undefined && issueSelector.trim() !== "";
    const title = intl.formatMessage(
      hasSelector
        ? msg.pickDialogTitleMultipleMatches
        : msg.pickDialogTitle,
    );
    const picked = await this.askUserPickIssue(candidates, title);
    if (picked == null) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_SELECT_ISSUE_CANCELLED",
          message: intl.formatMessage(msg.cancelled),
        },
      };
    }

    return {
      status: "ok",
      result: { issueFolderName: picked.folderName },
    };
  }
}
