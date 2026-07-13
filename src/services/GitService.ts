import * as path from "path";
import fs from "node:fs";
import git from "isomorphic-git";
import type { ReadCommitResult } from "isomorphic-git";
import YAML from "js-yaml";
import type { GitGraph, GitGraphNode } from "../types/GitGraph.ts";
import type { ErrorResponse } from "../types/Response.ts";
import { FileService } from "./FileService.ts";

/**
 * Read-only git metadata via isomorphic-git (no subprocess git).
 *
 *
 * Known issue for isomorphic-git
 * - It can't get the commit on a worktree branch
 *
 */
export class GitService {
  private static instance: GitService | null = null;

  static getInstance(): GitService {
    GitService.instance ??= new GitService();
    return GitService.instance;
  }

  static setInstance(instance: GitService | null): void {
    GitService.instance = instance;
  }

  /**
   * Reads the `.git` file in the given directory, parses it as YAML,
   * and returns the resolved absolute path for the `gitdir` key or null.
   */
  async parseDotGitFileAtFolder(
    dirContainingDotGit: string,
  ): Promise<string | null> {
    const fileService = FileService.getInstance();
    const gitFilePath = path.join(dirContainingDotGit, ".git");
    let content: string;
    try {
      const raw = await fileService.readFile(gitFilePath, "utf-8");
      content = typeof raw === "string" ? raw : raw.toString("utf-8");
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = YAML.load(content);
    } catch {
      return null;
    }
    if (parsed === null || parsed === undefined || typeof parsed !== "object") {
      return null;
    }
    const rawPath = (parsed as { gitdir?: unknown }).gitdir;
    if (typeof rawPath !== "string" || !rawPath.trim()) {
      return null;
    }
    return path.resolve(dirContainingDotGit, rawPath.trim());
  }

  /**
   * `gitdir` for isomorphic-git ref/object reads. Linked worktrees report an admin path
   * under `.git/worktrees/<id>`; refs and objects live in the shared repository `.git`.
   */
  private async repositoryGitdir(checkoutRoot: string): Promise<string> {
    const fileService = FileService.getInstance();
    const dir = path.resolve(checkoutRoot);
    const dotGit = path.join(dir, ".git");
    if (!(await fileService.exists(dotGit))) {
      return dotGit;
    }
    const stat = await fileService.stat(dotGit);
    let resolved: string;
    if (stat.isDirectory()) {
      resolved = dotGit;
    } else {
      const raw = await fileService.readFile(dotGit, "utf-8");
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const line =
        text
          .split(/\r?\n/)
          .find((l) => l.trim())
          ?.trim() ?? "";
      const m = /^gitdir:\s*(.+)$/.exec(line);
      if (!m) {
        return dotGit;
      }
      resolved = path.resolve(dir, m[1]!.trim());
    }
    const marker = `${path.sep}worktrees${path.sep}`;
    const n = path.normalize(resolved);
    if (n.includes(marker)) {
      return path.normalize(path.join(n, "..", ".."));
    }
    return n;
  }

  // Get the branch name from a directory. This function works for base and worktree directories.
  async getBranchName(dir: string): Promise<string> {
    const branch = await git.currentBranch({
      fs,
      dir,
      fullname: false,
    });
    return branch ?? "";
  }

  /**
   * Resolves the base git folder for a checkout path. Main checkouts return the
   * input folder; linked worktrees return the admin gitdir from `.git`.
   */
  async resolveBaseGitFolder(folder: string): Promise<string> {
    const dir = path.resolve(folder);
    const gitdir = await this.parseDotGitFileAtFolder(dir);
    return gitdir ?? dir;
  }

  /** Resolves HEAD to a short commit oid for main and worktree checkout paths. */
  async getGitFolderHeadObjectId(folder: string): Promise<string> {
    const dir = path.resolve(folder);
    const baseGitFolder = await this.resolveBaseGitFolder(dir);
    let oid: string;
    if (baseGitFolder === dir) {
      oid = await this.resolveRef(dir, "HEAD");
    } else {
      const commonGitDir = path.dirname(path.dirname(baseGitFolder));
      oid = await git.resolveRef({
        fs,
        dir,
        gitdir: commonGitDir,
        ref: "HEAD",
      });
    }
    return oid.slice(0, 7);
  }

  // getBaseProjectBranchName works on base project only
  // It can't work on worktree branches due to the restriction of isomorphic-git
  async getBaseProjectBranchName(baseDir: string): Promise<string> {
    const dir = path.resolve(baseDir);
    const branch = await git.currentBranch({
      fs,
      dir,
      fullname: false,
    });
    return branch ?? "";
  }

  async resolveLogRefForWorktree(worktreeDir: string): Promise<string> {
    const dir = path.resolve(worktreeDir);
    const branch = await git.currentBranch({
      fs,
      dir,
      fullname: false,
    });
    if (branch !== undefined) {
      return branch;
    }
    return git.resolveRef({ fs, dir, ref: "HEAD" });
  }

  /**
   * Lists the main checkout path and linked worktree roots by reading each
   * worktrees entry's gitdir file (single-line absolute path to that checkout's .git).
   * Expects `gitFolder` to be a repository root with `.git` (validated by callers).
   */
  async listWorktree(gitFolder: string): Promise<string[]> {
    const fileService = FileService.getInstance();
    const dir = path.resolve(gitFolder);
    const dotGitPath = path.join(dir, ".git");
    if (!(await fileService.exists(dotGitPath))) {
      throw new Error("No .git directory found at git folder.");
    }

    const stat = await fileService.stat(dotGitPath);
    let commonGitDir: string;
    let mainCheckout: string;

    if (stat.isDirectory()) {
      commonGitDir = dotGitPath;
      mainCheckout = dir;
    } else {
      const adminDir = await this.parseDotGitFileAtFolder(dir);
      if (adminDir === null) {
        throw new Error("Could not resolve git directory from .git file.");
      }
      commonGitDir = path.dirname(path.dirname(adminDir));
      mainCheckout = path.dirname(commonGitDir);
    }

    const ordered: string[] = [];
    const seen = new Set<string>();

    const pushUnique = (absPath: string): void => {
      const normalized = path.normalize(absPath);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
      }
    };

    pushUnique(mainCheckout);

    const worktreesRoot = path.join(commonGitDir, "worktrees");
    if (await fileService.exists(worktreesRoot)) {
      const entries = await fileService.readdir(worktreesRoot);
      for (const ent of entries) {
        if (!ent.isDirectory()) {
          continue;
        }
        const gitdirFile = path.join(worktreesRoot, ent.name, "gitdir");
        if (!(await fileService.exists(gitdirFile))) {
          continue;
        }
        const raw = await fileService.readFile(gitdirFile, "utf-8");
        const text = typeof raw === "string" ? raw : raw.toString("utf-8");
        const line = text
          .split(/\r?\n/)
          .find((l) => l.trim())
          ?.trim();
        if (!line) {
          continue;
        }
        pushUnique(path.dirname(line));
      }
    }

    return ordered;
  }

  /**
   * Walk commit history from ref (branch name, tag, or oid) using isomorphic-git.
   * Newest commit first; depth limits how many commits are returned.
   */
  async logCommits(
    gitFolder: string,
    ref: string,
    depth: number,
  ): Promise<ReadCommitResult[]> {
    const dir = path.resolve(gitFolder);
    const gitdir = await this.repositoryGitdir(dir);
    return git.log({
      fs,
      dir,
      gitdir,
      ref,
      depth,
    });
  }

  /**
   * Resolves a ref (branch, tag, or oid) to a full commit oid.
   */
  async resolveRef(gitFolder: string, ref: string): Promise<string> {
    const dir = path.resolve(gitFolder);
    const gitdir = await this.repositoryGitdir(dir);
    return git.resolveRef({ fs, dir, gitdir, ref });
  }

  async findMergeBaseFromWorktree(
    baseFolder: string,
    workTreeFolder: string,
  ): Promise<string> {
    const branchA = await git.currentBranch({
      fs,
      dir: baseFolder,
      fullname: false,
    });
    const branchB = await git.currentBranch({
      fs,
      dir: workTreeFolder,
      fullname: false,
    });
    if (!branchA || !branchB) {
      throw new Error("No branch found for the selected refs.");
    }
    const baseCommit = await git.resolveRef({
      fs,
      dir: baseFolder,
      ref: branchA,
      depth: 1,
    });

    const worktreeCommit = await git.resolveRef({
      fs,
      dir: baseFolder,
      ref: branchB,
      depth: 1,
    });

    const mergeBase = await git.findMergeBase({
      fs,
      dir: baseFolder,
      oids: [baseCommit, worktreeCommit],
    });
    if (mergeBase.length === 0) {
      throw new Error("No merge base found for the selected refs.");
    }
    return mergeBase[0];
  }

  /** True when `ancestorOid` is an ancestor of (or equal to) `descendantOid`. */
  async isAncestor(
    gitFolder: string,
    ancestorOid: string,
    descendantOid: string,
  ): Promise<boolean> {
    if (ancestorOid === descendantOid) {
      return true;
    }
    const dir = path.resolve(gitFolder);
    return git.isDescendent({
      fs,
      dir,
      oid: descendantOid,
      ancestor: ancestorOid,
    });
  }

  /** Picks the oid that is an ancestor of every other oid in the set. */
  async pickOldestCommitOid(
    gitFolder: string,
    oids: readonly string[],
  ): Promise<string> {
    if (oids.length === 0) {
      throw new Error("No commit oids provided.");
    }
    const unique = [...new Set(oids)];
    if (unique.length === 1) {
      return unique[0]!;
    }
    for (const candidate of unique) {
      let isOldest = true;
      for (const other of unique) {
        if (candidate === other) {
          continue;
        }
        if (!(await this.isAncestor(gitFolder, candidate, other))) {
          isOldest = false;
          break;
        }
      }
      if (isOldest) {
        return candidate;
      }
    }
    return unique[0]!;
  }

  async createGraph(
    baseFolder: string,
    checkoutFolder: string,
    inclusiveRootOid: string,
  ): Promise<GitGraph> {
    const baseDir = path.resolve(baseFolder);
    const checkoutDir = path.resolve(checkoutFolder);
    const branch = await this.getBranchName(checkoutDir);
    if (!branch) {
      throw new Error("No branch found for the selected refs.");
    }
    const tipOid = await this.resolveRef(checkoutDir, branch);
    const nodes: Record<string, GitGraphNode> = {};
    const pending: string[] = [tipOid];

    while (pending.length > 0) {
      const oid = pending.pop()!;

      if (nodes[oid] !== undefined) {
        continue;
      }
      const readOut = await git.readCommit({ fs, dir: baseDir, oid });
      const { commit } = readOut;
      const summary = GitService.firstLineMessage(commit.message);
      const parentCommitIds = [...commit.parent];
      nodes[oid] = {
        objectIds: [oid],
        summary,
        parentCommitIds,
      };
      if (oid === inclusiveRootOid) {
        continue;
      }
      for (const p of parentCommitIds) {
        pending.push(p);
      }
    }

    if (nodes[inclusiveRootOid] === undefined) {
      throw {
        status: "error",
        error: {
          code: "WORKTREE_GRAPH_SUBGRAPH_NOT_CONNECTED",
          message:
            "Tip does not reach the inclusive root in the object database.",
        },
      } satisfies ErrorResponse;
    }

    return {
      nodes,
      branches: { [branch]: tipOid },
      rootCommitId: inclusiveRootOid,
    };
  }

  private static firstLineMessage(message: string): string {
    const line = message.split(/\r?\n/).find((l) => l.trim()) ?? "";
    return line.trim().slice(0, 72);
  }
}
