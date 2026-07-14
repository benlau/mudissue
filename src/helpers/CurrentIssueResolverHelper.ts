import * as path from "path";
import { defineMessages } from "react-intl";
import { GitService } from "../services/GitService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { ErrorResponse } from "../types/Response.ts";
import { intl } from "../intl.ts";
import { WorktreeHelper } from "./WorktreeHelper.ts";

const messages = defineMessages({
  requiresWorktree: {
    id: "helpers.currentIssueResolver.requiresWorktree",
    defaultMessage:
      "The `current` keyword can only be used inside a mudissue issue worktree",
  },
});

export type FindCurrentIssueInput = {
  cwd?: string;
};

function isCwdUnderWorktree(cwd: string, worktreeRoot: string): boolean {
  const cwdResolved = path.resolve(cwd);
  const rootResolved = path.resolve(worktreeRoot);
  return (
    cwdResolved === rootResolved ||
    cwdResolved.startsWith(rootResolved + path.sep)
  );
}

export class CurrentIssueResolverHelper {
  static isCurrentIssueSelector(selector: string): boolean {
    return selector.trim().toLowerCase() === "current";
  }

  static async findCurrentIssue(
    input?: FindCurrentIssueInput,
  ): Promise<IssueFolder | null> {
    const shellService = ShellService.getInstance();
    const gitService = GitService.getInstance();
    const cwd = path.resolve(input?.cwd ?? shellService.cwd());

    try {
      await useCurrentTrackerRepoStore
        .getState()
        .ensureCurrentTrackerRepoFound();
      const repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
      const checkoutPaths = await gitService.listWorktree(repo.projectPath);
      const issueWorktreePaths =
        await WorktreeHelper.filterIssueWorktreeCheckoutPaths(
          repo,
          checkoutPaths,
        );

      for (const wt of issueWorktreePaths) {
        if (!isCwdUnderWorktree(cwd, wt)) {
          continue;
        }
        const folderName = path.basename(wt);
        const folders = await useCurrentTrackerRepoStore
          .getState()
          .findIssue(folderName);
        if (folders.length === 1) {
          return folders[0]!;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  static async resolveCurrentIssue(
    input?: FindCurrentIssueInput,
  ): Promise<IssueFolder> {
    const issue = await CurrentIssueResolverHelper.findCurrentIssue(input);
    if (issue) {
      return issue;
    }
    const response: ErrorResponse = {
      status: "error",
      error: {
        code: "CURRENT_ISSUE_REQUIRES_WORKTREE",
        message: intl.formatMessage(messages.requiresWorktree),
      },
    };
    throw response;
  }
}
