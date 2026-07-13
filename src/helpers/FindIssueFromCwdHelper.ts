import * as path from "path";
import { GitService } from "../services/GitService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { WorktreeHelper } from "./WorktreeHelper.ts";

export type FindIssueFromCwdInput = {
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

export class FindIssueFromCwdHelper {
  static async findIssueFromCwd(
    input?: FindIssueFromCwdInput,
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
}
