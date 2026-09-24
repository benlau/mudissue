import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../constants.ts";
import { intl } from "../intl.ts";
import { CurrentIssueResolverHelper } from "../helpers/CurrentIssueResolverHelper.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
} from "../store/IssueSearchStore.ts";
import { FrontmatterValidator } from "../utils/validators/FrontmatterValidator.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptSelectIssueCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import type { IssueFolder } from "../types/Issue.ts";

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
  optionIssueSelector: {
    id: "cli.common.option.issueSelector",
    defaultMessage: "Issue ID, folder name, or suffix",
  },
  optionSetVar: {
    id: "cli.script.option.setVar",
    defaultMessage: "Write the selected value to this script variable",
  },
  optionColumns: {
    id: "cli.script.selectIssue.option.columns",
    defaultMessage:
      "Comma-separated issue property keys for table columns (replaces status,priority)",
  },
  invalidVarName: {
    id: "cli.script.error.invalidVarName",
    defaultMessage:
      "Invalid variable name. Use only letters, numbers, underscores, and hyphens.",
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
          .option("set-var", {
            type: "string",
            describe: intl.formatMessage(msg.optionSetVar),
          })
          .option("columns", {
            type: "string",
            describe: intl.formatMessage(msg.optionColumns),
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
          interactive: true,
        });
        const result = await cmd.runCommand(
          { outputJson },
          argv.issue_selector,
          argv.project,
          argv["set-var"],
          argv.columns,
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
    setVar?: string,
    columns?: string,
  ): Promise<ScriptSelectIssueCommandSuccessResponse | ErrorResponse> {
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
      columns,
    );
    if (selected.status === "error") {
      if (
        selected.error.code === "SCRIPT_SELECT_ISSUE_CANCELLED" &&
        setVar !== undefined &&
        setVar.trim() !== "" &&
        FrontmatterValidator.isValidPropertyKey(setVar)
      ) {
        await RegistryService.getInstance().delete(
          MUDISSUE_SCRIPT_VARIABLES_URL,
          "system",
          setVar,
        );
      }
      return selected;
    }

    const issueFolderName = selected.result.issueFolderName;
    if (setVar !== undefined && setVar.trim() !== "") {
      if (!FrontmatterValidator.isValidPropertyKey(setVar)) {
        return {
          status: "error",
          error: {
            code: "SCRIPT_VAR_INVALID_NAME",
            message: intl.formatMessage(msg.invalidVarName),
            details: { name: setVar },
          },
        };
      }
      await RegistryService.getInstance().set(
        setVar,
        issueFolderName,
        MUDISSUE_SCRIPT_VARIABLES_URL,
        "system",
      );
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
      if (CurrentIssueResolverHelper.isCurrentIssueSelector(issueSelector)) {
        return [await CurrentIssueResolverHelper.resolveCurrentIssue()];
      }
      const folders = await useCurrentTrackerRepoStore
        .getState()
        .findIssue(issueSelector, { project });
      new IssueFolderValidator().set(folders).validateIssueNotNone();
      return Array.isArray(folders) ? folders : [folders];
    }

    const candidates = await IssueSearchStoreFactory.createOrGet(
      IssueSearchStoreKey.Headless,
    )
      .getState()
      .searchAllFolders("");
    new IssueFolderValidator().set(candidates).validateIssueNotNone();
    return candidates;
  }

  private async resolveSelectedIssue(
    candidates: IssueFolder[],
    issueSelector: string | undefined,
    columns?: string,
  ): Promise<ScriptSelectIssueCommandSuccessResponse | ErrorResponse> {
    if (candidates.length === 1) {
      return {
        status: "ok",
        result: { issueFolderName: candidates[0]!.issueId },
      };
    }

    const enrichedById = new Map(
      (
        await IssueSearchStoreFactory.createOrGet(IssueSearchStoreKey.Headless)
          .getState()
          .searchFolders(candidates, [])
      ).map((issue) => [issue.issueId, issue]),
    );
    const enriched = candidates.map(
      (candidate) => enrichedById.get(candidate.issueId) ?? candidate,
    );

    const hasSelector =
      issueSelector !== undefined && issueSelector.trim() !== "";
    const title = intl.formatMessage(
      hasSelector ? msg.pickDialogTitleMultipleMatches : msg.pickDialogTitle,
    );
    const picked = await this.askUserPickIssue(
      enriched,
      title,
      columns !== undefined ? { columns } : undefined,
    );
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
      result: { issueFolderName: picked.issueId },
    };
  }
}
