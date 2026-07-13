import * as path from "node:path";
import { IssueSelectorArgumentHelper } from "./IssueSelectorArgumentHelper.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import { FileService } from "../services/FileService.ts";
import { GitService } from "../services/GitService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import { GitFolderValidator } from "../utils/validators/GitFolderValidator.ts";
import { IssueFolderValidator } from "../utils/validators/IssueFolderValidator.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";

/** CLI text: `base` or an issue selector string. */
export type WorktreeSelector = string;

/** Resolved `base` or issue worktree for merge/rebase/push (issue worktree must already exist). */
export type WorktreePathInfo = {
  cwd: string;
  gitBranch: string;
  label: string;
};

export type WorktreeHelperEnsureOptions = {
  issueSelector: string;
  project?: string;
  /** When false, do not log when the worktree path already exists (e.g. `worktree run`). Defaults to true. */
  logIfWorktreeExists?: boolean;
};

export type WorktreeHelperResult = {
  repo: TrackerRepo;
  issue: IssueFolder;
  branchName: string;
  worktreePath: string;
};

export type IssueWorktreeGitKind = "rebase" | "merge" | "push";

export type IssueWorktreeGitExecuteOptions = {
  project?: string;
  force?: boolean;
  /**
   * Tri-state for `git merge --ff-only` (only honored when kind === "merge"):
   * - `true`: force `--ff-only`
   * - `false`: force off (overrides repo/global config)
   * - `null`/`undefined`: fall back to repo/global config, then `false`
   */
  ffOnly?: boolean | null;
  askConfirmation: (message: string) => Promise<boolean>;
};

export type IssueWorktreeGitExecuteResult =
  | {
      status: "ok";
      cwd: string;
      command: string;
    }
  | { status: "cancelled" };

export class WorktreeHelper {
  static isBaseWorktreeSelector(selector: WorktreeSelector): boolean {
    return selector.trim().toLowerCase() === "base";
  }

  /** Linked git worktree roots that match mudissue issue worktree layout. */
  static async filterIssueWorktreeCheckoutPaths(
    repo: TrackerRepo,
    checkoutPaths: readonly string[],
  ): Promise<string[]> {
    const projectRoot = path.resolve(repo.projectPath);
    const mudissuePaths: string[] = [];

    for (const wt of checkoutPaths) {
      const resolved = path.resolve(wt);
      if (resolved === projectRoot) {
        continue;
      }
      const folderName = path.basename(wt);
      if (!IssueSelectorMatcher.isValidateFolderName(folderName)) {
        continue;
      }
      const expected = await useCurrentTrackerRepoStore
        .getState()
        .getGitWorktreePath(folderName);
      if (resolved === path.resolve(expected)) {
        mudissuePaths.push(resolved);
      }
    }

    mudissuePaths.sort((a, b) => a.localeCompare(b));
    return mudissuePaths;
  }

  static async resolveWorktreeSelector(
    repo: TrackerRepo,
    project: string | undefined,
    selector: WorktreeSelector,
  ): Promise<WorktreePathInfo> {
    const trimmed = selector.trim();
    if (WorktreeHelper.isBaseWorktreeSelector(trimmed)) {
      const cwd = repo.projectPath;
      const gitBranch =
        await GitService.getInstance().getGitFolderHeadObjectId(cwd);
      return { cwd, gitBranch, label: "base" };
    }

    const folders = await useCurrentTrackerRepoStore
      .getState()
      .findIssue(trimmed, {
        project,
      });
    const issue = new IssueFolderValidator()
      .set(folders)
      .validateIssueNotNone()
      .validateIssueNotMultiple()
      .first();

    const branchName = await useCurrentTrackerRepoStore
      .getState()
      .getIssueBranchName(repo, issue);
    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(issue.folderName);

    if (!(await FileService.getInstance().exists(worktreePath))) {
      throw new Error(`Issue worktree does not exist at ${worktreePath}`);
    }

    return {
      cwd: worktreePath,
      gitBranch: branchName,
      label: issue.folderName,
    };
  }

  static async ensureIssueWorktreeAvailable(
    options: WorktreeHelperEnsureOptions,
  ): Promise<WorktreeHelperResult> {
    const { issueSelector, project, logIfWorktreeExists = true } = options;
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();
    const { repo, issue } =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        issueSelector,
        project,
      );

    const gitValidator = new GitFolderValidator();
    gitValidator.set(repo.projectPath);
    await gitValidator.validateDotGit();
    await gitValidator.validateGitBinary();

    const branchName = await useCurrentTrackerRepoStore
      .getState()
      .getIssueBranchName(repo, issue);
    const worktreePath = await useCurrentTrackerRepoStore
      .getState()
      .getGitWorktreePath(issue.folderName);

    if (await fileService.exists(worktreePath)) {
      if (logIfWorktreeExists) {
        loggerService.info(`Worktree already exists at ${worktreePath}`);
      }
      return { repo, issue, branchName, worktreePath };
    }

    const branchExists =
      shellService.runAndWait(
        "git",
        ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
        { cwd: repo.projectPath },
      ).status === 0;
    const worktreeArgs = branchExists
      ? ["worktree", "add", worktreePath, branchName]
      : ["worktree", "add", "-b", branchName, worktreePath];
    const { status } = shellService.runAndWait("git", worktreeArgs, {
      cwd: repo.projectPath,
    });

    if (status !== 0) {
      throw new Error(
        `git worktree add failed${status != null ? ` (exit code ${status})` : ""}`,
      );
    }

    loggerService.info(`Worktree created at ${worktreePath}`);
    return { repo, issue, branchName, worktreePath };
  }

  /** POSIX `cd '…'` segment: escape embedded single quotes for safe shell display. */
  static posixShellSingleQuotedDir(pathForCd: string): string {
    return `'${pathForCd.split("'").join("'\\''")}'`;
  }

  /** Printable shell line: `cd '<cwd>' && git …` (matches manual execution semantics). */
  static formatWorktreeGitShellCommand(cwd: string, gitArgv: string[]): string {
    return `cd ${WorktreeHelper.posixShellSingleQuotedDir(cwd)} && git ${gitArgv.join(" ")}`;
  }

  static async executeIssueWorktreeGitOperation(
    kind: IssueWorktreeGitKind,
    srcSelector: WorktreeSelector,
    dstSelector: WorktreeSelector,
    options: IssueWorktreeGitExecuteOptions,
  ): Promise<IssueWorktreeGitExecuteResult> {
    const project = options.project;
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();
    const repo = await WorktreeHelper.resolveTrackerRepoForWorktreeGit(project);

    const gitValidator = new GitFolderValidator();
    gitValidator.set(repo.projectPath);
    await gitValidator.validateDotGit();
    await gitValidator.validateGitBinary();

    const src = await WorktreeHelper.resolveWorktreeSelector(
      repo,
      project,
      srcSelector,
    );
    const dst = await WorktreeHelper.resolveWorktreeSelector(
      repo,
      project,
      dstSelector,
    );

    if (
      path.resolve(src.cwd) === path.resolve(dst.cwd) &&
      src.gitBranch === dst.gitBranch
    ) {
      throw new Error(
        "Source and destination are the same checkout and branch; nothing to do.",
      );
    }

    let cwd: string;
    let argv: string[];
    if (kind === "rebase") {
      cwd = src.cwd;
      argv = ["rebase", dst.gitBranch];
    } else if (kind === "merge") {
      cwd = src.cwd;
      const ffOnly =
        options.ffOnly === true || options.ffOnly === false
          ? options.ffOnly
          : await useCurrentTrackerRepoStore
              .getState()
              .getWorktreeGitFfOnlyEnabled(repo);
      argv = ffOnly
        ? ["merge", "--ff-only", dst.gitBranch]
        : ["merge", dst.gitBranch];
    } else {
      cwd = dst.cwd;
      argv = ["merge", src.gitBranch];
    }

    const shellLine = WorktreeHelper.formatWorktreeGitShellCommand(cwd, argv);
    if (!options.force) {
      const confirmed = await options.askConfirmation(`${shellLine}?`);
      if (!confirmed) {
        loggerService.info("Git operation cancelled");
        return { status: "cancelled" };
      }
    }

    loggerService.info(shellLine);

    const { status } = shellService.runAndWait("git", argv, {
      cwd,
    });
    if (status !== 0) {
      throw new Error(
        `git ${argv[0]} failed${status != null ? ` (exit code ${status})` : ""}`,
      );
    }

    return {
      status: "ok",
      cwd,
      command: shellLine,
    };
  }

  private static async resolveTrackerRepoForWorktreeGit(
    project: string | undefined,
  ): Promise<TrackerRepo> {
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
    return await useCurrentTrackerRepoStore.getState().getCurrentTrackerRepo();
  }
}
