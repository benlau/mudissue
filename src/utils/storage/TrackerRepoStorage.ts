import * as path from "path";
import YAML from "js-yaml";
import {
  DEFAULT_SEARCH_DEPTH,
  GIT_MUD_CONFIG_FILENAME,
  MUD_CONFIG_FILENAME,
  WORKSPACE_MAX_DEPTH,
} from "../../constants.ts";
import { FileService } from "../../services/FileService.ts";
import { GitService } from "../../services/GitService.ts";
import { ShellService } from "../../services/ShellService.ts";
import type { GlobalConfig, IssueFileType } from "../../types/GlobalConfig.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { LinkagePair } from "../../types/linkage.ts";
import {
  TrackerRepoConfigAccessor,
  TrackerRepoConfigSchema,
  type TrackerRepo,
  type TrackerRepoConfig,
} from "../../types/Tracker.ts";
import type { FilePath } from "../../types/files.ts";
import { ZodErrorFormatter } from "../../foundation/formatter/ZodErrorFormatter.ts";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";
import { PriorityTableAccessor } from "../../types/priority.ts";
import { IssueFolderStorage } from "./IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "./IssueMarkdownFileStorage.ts";

const DEFAULT_TRACKER_REPO_CONFIG: TrackerRepoConfig = {
  issue_prefix: null,
  issue_path: "issues",
};

function resolveTrackerPath(
  projectPath: string,
  config: TrackerRepoConfig,
  shell: ShellService,
): string {
  const raw = config.tracker_path;
  if (raw == null || raw.trim() === "" || raw.trim() === ".") {
    return projectPath;
  }
  if (shell.isAbsolute(raw)) {
    return path.resolve(raw);
  }
  return path.resolve(projectPath, raw);
}

function loadTrackerRepoConfig(
  content: string,
  configFilePath: string,
  defaults: TrackerRepoConfig,
): TrackerRepoConfig {
  let raw: unknown;
  try {
    raw = YAML.load(content);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid YAML in ${configFilePath}: ${reason}`);
  }

  // Empty or comment-only YAML documents parse as null.
  if (raw == null) {
    raw = {};
  }

  const parsed = TrackerRepoConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid config in ${configFilePath}: ${ZodErrorFormatter.format(parsed.error)}`,
    );
  }

  const config = { ...defaults, ...parsed.data };

  if (config.priority_list !== undefined) {
    try {
      PriorityTableAccessor.parse(config.priority_list).get();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid priority_list in ${configFilePath}: ${reason}`);
    }
  }

  return config;
}

export type FindTrackerRepoResult = { root: string; configPath: string } | null;

export class TrackerRepoStorage {
  private readonly trackerRepo: TrackerRepo;
  private readonly fileService: FileService;
  private readonly shellService: ShellService;
  private readonly configAccessor: TrackerRepoConfigAccessor;

  constructor(trackerRepo: TrackerRepo, globalConfig: GlobalConfig) {
    this.trackerRepo = trackerRepo;
    this.fileService = FileService.getInstance();
    this.shellService = ShellService.getInstance();
    this.configAccessor = new TrackerRepoConfigAccessor(
      trackerRepo.config,
      globalConfig,
    );
  }

  getTrackerRepo(): TrackerRepo {
    return this.trackerRepo;
  }

  /**
   * Loads repo from disk for the given project root (absolute path) and returns a TrackerRepoStorage.
   * Looks for mud.conf then .git/mudissue/mud.conf under projectPath. Merges config with defaults.
   */
  static async createByProjectPath(
    projectPathInput: string,
    globalConfig: GlobalConfig,
  ): Promise<TrackerRepoStorage> {
    const fs = FileService.getInstance();
    const shell = ShellService.getInstance();
    const projectPath = path.resolve(projectPathInput);
    const defaults = { ...DEFAULT_TRACKER_REPO_CONFIG };

    const candidates = [
      path.join(projectPath, MUD_CONFIG_FILENAME),
      path.join(projectPath, GIT_MUD_CONFIG_FILENAME),
    ];
    let configFilePath: string | undefined;
    let config = defaults;
    for (const candidate of candidates) {
      if (await fs.exists(candidate)) {
        configFilePath = candidate;
        const content = (await fs.readFile(candidate, "utf-8")) as string;
        config = loadTrackerRepoConfig(content, candidate, defaults);
        break;
      }
    }

    const trackerPath = resolveTrackerPath(projectPath, config, shell);
    const trackerRepo: TrackerRepo = {
      name: path.basename(projectPath),
      projectPath,
      trackerPath,
      config,
      configFilePath,
    };
    return new TrackerRepoStorage(trackerRepo, globalConfig);
  }

  static async find(
    startDir?: string,
    options?: { searchDepthLimit?: number },
  ): Promise<FindTrackerRepoResult> {
    const shellService = ShellService.getInstance();
    const rootDir = startDir ?? shellService.cwd();
    const searchDepthLimit = options?.searchDepthLimit ?? DEFAULT_SEARCH_DEPTH;
    return TrackerRepoStorage.findRepoFromDir(
      rootDir,
      0,
      new Set<string>(),
      searchDepthLimit,
    );
  }

  static async findSubTrackerRepos(
    rootAbsPath: string,
    globalConfig: GlobalConfig,
    depth = 0,
    seen = new Set<string>(),
  ): Promise<TrackerRepo[]> {
    if (depth > WORKSPACE_MAX_DEPTH) {
      throw new Error(
        `Overcomplicated tracker repo configuration (max depth ${WORKSPACE_MAX_DEPTH}). Check for recursive folders or symlinks?`,
      );
    }

    const storage = await TrackerRepoStorage.createByProjectPath(
      rootAbsPath,
      globalConfig,
    );
    const repo = storage.getTrackerRepo();
    const list: TrackerRepo[] = [];
    const fileService = FileService.getInstance();

    const projects = repo.config.projects ?? [];
    for (const projectPath of projects) {
      const resolved = path.resolve(repo.projectPath, projectPath);
      const normalized = path.normalize(resolved);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const exists = await fileService.exists(resolved).catch(() => false);
      if (!exists) {
        continue;
      }

      try {
        const childStorage = await TrackerRepoStorage.createByProjectPath(
          resolved,
          globalConfig,
        );
        list.push(childStorage.getTrackerRepo());
        const nested = await TrackerRepoStorage.findSubTrackerRepos(
          resolved,
          globalConfig,
          depth + 1,
          seen,
        );
        list.push(...nested);
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes("Overcomplicated tracker repo")
        ) {
          throw err;
        }
      }
    }

    return list;
  }

  private static async findRepoFromDir(
    currentDir: string,
    depth: number,
    visited: Set<string>,
    searchDepthLimit: number,
  ): Promise<FindTrackerRepoResult> {
    if (depth > searchDepthLimit) {
      throw new Error(
        `Search depth exceeded (max ${searchDepthLimit}). mud.conf not found.`,
      );
    }

    const normalized = path.resolve(currentDir);
    if (visited.has(normalized)) {
      return null;
    }

    const fileService = FileService.getInstance();
    const candidates = [
      path.join(currentDir, MUD_CONFIG_FILENAME),
      path.join(currentDir, GIT_MUD_CONFIG_FILENAME),
    ];
    for (const candidate of candidates) {
      if (await fileService.exists(candidate)) {
        return { root: currentDir, configPath: candidate };
      }
    }

    visited.add(normalized);

    const gitService = GitService.getInstance();
    const redirectedGitPath =
      await gitService.parseDotGitFileAtFolder(currentDir);
    if (redirectedGitPath !== null) {
      const fromChild = await TrackerRepoStorage.findRepoFromDir(
        redirectedGitPath,
        depth + 1,
        visited,
        searchDepthLimit,
      );
      if (fromChild !== null) return fromChild;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    return TrackerRepoStorage.findRepoFromDir(
      parentDir,
      depth + 1,
      visited,
      searchDepthLimit,
    );
  }

  public async folderExists(): Promise<boolean> {
    try {
      const stats = await this.fileService.stat(this.trackerRepo.trackerPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /** Returns FilePath with relativePath relative to tracker root. */
  public resolveFilePath(absolutePath: string): FilePath {
    return {
      absPath: absolutePath,
      relativePath: this.shellService.relative(
        this.trackerRepo.trackerPath,
        absolutePath,
      ),
    };
  }

  /** Returns the issue root resolved relative to trackerPath. */
  public getIssuePath(): string {
    const issuePath = this.configAccessor.getEffectiveIssuePath();
    return path.resolve(this.trackerRepo.trackerPath, issuePath);
  }

  getDefaultStatus(): string {
    return this.configAccessor.getDefaultStatus();
  }

  getDefaultPriority(): string {
    return this.configAccessor.getDefaultPriority();
  }

  getIssueFilePattern(): IssueFileType {
    return this.configAccessor.getEffectiveIssueFilePattern();
  }

  getLinkTypes(): LinkagePair[] {
    return this.configAccessor.getEffectiveLinkTypes();
  }

  public async renameIssue(
    folder: IssueFolder,
    newFolderName: string,
    title?: string,
  ): Promise<{
    oldFolderName: string;
    newFolderName: string;
    oldPath: string;
    newPath: string;
  }> {
    const issueRoot = this.getIssuePath();
    const currentPath = folder.path;
    const targetPath = path.join(issueRoot, newFolderName);

    const storageBefore = new IssueFolderStorage(folder);
    const actualIssueFilePathBefore = await storageBefore.findIssueFile();

    if (targetPath !== currentPath) {
      await this.fileService.rename(currentPath, targetPath);
    }

    const newFolder: IssueFolder = {
      issueId: newFolderName,
      label:
        IssueSelectorMatcher.extractIssueLabel(newFolderName) ?? newFolderName,
      path: targetPath,
    };
    const expectedIssueFilePath = await this.resolveIssueFilePath(newFolder);
    if (actualIssueFilePathBefore !== undefined) {
      const actualIssueFilePathAfter = path.join(
        targetPath,
        path.basename(actualIssueFilePathBefore),
      );
      if (actualIssueFilePathAfter !== expectedIssueFilePath) {
        await this.fileService.rename(
          actualIssueFilePathAfter,
          expectedIssueFilePath,
        );
      }
    }

    if (title !== undefined) {
      const issueFilePath = await this.resolveIssueFilePath(newFolder);
      const mdStorage = new IssueMarkdownFileStorage(issueFilePath);
      await mdStorage.load();
      mdStorage.setProperty("title", title);
      await mdStorage.save();
    }

    return {
      oldFolderName: folder.issueId,
      newFolderName,
      oldPath: currentPath,
      newPath: targetPath,
    };
  }
  /**
   * Resolves the issue file path for a given folder based on config.
   * Precedence: repo config > global config > default ("long" / "issue.md")
   */
  public async resolveIssueFilePath(folder: IssueFolder): Promise<string> {
    const effectiveType = this.configAccessor.getEffectiveIssueFilePattern();
    const effectiveFile = this.configAccessor.getEffectiveIssueFile();
    const folderPath = folder.path;

    if (effectiveType === "short") {
      return path.join(folderPath, `${folder.label}.md`);
    }
    if (effectiveType === "long") {
      return path.join(folderPath, `${folder.issueId}.md`);
    }
    // fixed
    return path.join(folderPath, effectiveFile);
  }

  public async listIssues(): Promise<IssueFolder[]> {
    const issuePath = this.getIssuePath();
    try {
      if (!(await this.fileService.exists(issuePath))) {
        return [];
      }
      const entries = await this.fileService.readdir(issuePath);
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) =>
          IssueSelectorMatcher.isValidateFolderName(entry.name),
        )
        .map((entry) => {
          const folderAbsPath = path.join(issuePath, entry.name);
          return {
            issueId: entry.name,
            label:
              IssueSelectorMatcher.extractIssueLabel(entry.name) ?? entry.name,
            path: folderAbsPath,
          };
        });
    } catch {
      return [];
    }
  }
}
