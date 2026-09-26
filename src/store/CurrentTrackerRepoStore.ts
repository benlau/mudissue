import * as path from "path";
import ejs from "ejs";
import { create } from "zustand";
import { GitBranchFormatter } from "../foundation/formatter/GitBranchFormatter.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { ShellService } from "../services/ShellService.ts";
import {
  TrackerRepoStorage,
  type FindTrackerRepoResult,
} from "../async/storage/TrackerRepoStorage.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { IssueSelectorMatcher } from "../foundation/matchers/IssueSelectorMatcher.ts";
import type { PriorityTable } from "../types/priority.ts";
import type { StatusList } from "../types/status.ts";
import {
  TrackerRepoConfigAccessor,
  type TrackerRepo,
  type TrackerRepoConfig,
} from "../types/Tracker.ts";
import {
  ISSUE_BRANCH_NAME_MAX_LENGTH,
  ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH,
} from "../constants.ts";
import { useGlobalConfigStore } from "./GlobalConfigStore.ts";

export type { FindTrackerRepoResult };

const DEFAULT_EDITOR_CANDIDATES = [
  "cursor",
  "code",
  "emacs",
  "nvim",
  "vim",
  "vi",
  "nano",
] as const;

type AvailableEditorCandidate = {
  command: string;
  resolved: string;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return value != null && value !== "";
}

async function createTrackerRepoConfigAccessor(
  repoConfig: TrackerRepoConfig,
): Promise<TrackerRepoConfigAccessor> {
  const globalConfig = await useGlobalConfigStore
    .getState()
    .ensureGlobalConfig();
  return new TrackerRepoConfigAccessor(repoConfig, globalConfig);
}

async function resolveConfiguredEditor(
  repoConfig: TrackerRepoConfig,
): Promise<string | null> {
  const envEditor = process.env.MUDISSUE_EDITOR;
  if (isNonEmpty(envEditor)) {
    return envEditor;
  }
  const accessor = await createTrackerRepoConfigAccessor(repoConfig);
  return accessor.getEffectiveEditorPreference();
}

async function getAvailableEditorCandidates(): Promise<
  AvailableEditorCandidate[]
> {
  const shell = ShellService.getInstance();
  const editors: AvailableEditorCandidate[] = [];
  for (const candidate of DEFAULT_EDITOR_CANDIDATES) {
    const resolved = await shell.which(candidate);
    if (resolved) {
      editors.push({ command: candidate, resolved });
    }
  }
  return editors;
}

function uniqueEditors(editors: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const editor of editors) {
    if (!isNonEmpty(editor) || seen.has(editor)) {
      continue;
    }
    seen.add(editor);
    result.push(editor);
  }
  return result;
}

export function resetCurrentTrackerRepoStore(): void {
  useCurrentTrackerRepoStore.setState(
    useCurrentTrackerRepoStore.getInitialState(),
    true,
  );
}

type CurrentTrackerRepoStoreState = {
  currentTrackerRepo: TrackerRepo | null;
  subTrackerRepoList: TrackerRepo[];
  findCurrentTrackerRepoByCWD: () => Promise<FindTrackerRepoResult>;
  ensureCurrentTrackerRepoFound: () => Promise<void>;
  loadCurrentTrackerRepoByPath: (repoPath: string) => Promise<void>;
  getCurrentTrackerRepo: () => Promise<TrackerRepo>;
  listIssues: () => Promise<IssueFolder[]>;
  findIssue: (
    issueSelector: string,
    options?: { project?: string; repo?: TrackerRepo },
  ) => Promise<IssueFolder[]>;
  getTrackerRepoList: () => Promise<TrackerRepo[]>;
  getTrackerRepoByProjectName: (name: string) => Promise<TrackerRepo | null>;
  findTrackerRepoForIssueFolder: (
    issue: IssueFolder,
  ) => Promise<TrackerRepo | null>;
  findIssuePath: (issueId: string, repo?: TrackerRepo) => Promise<string>;
  getEditor: (repoConfig: TrackerRepoConfig) => Promise<string | null>;
  getIssueBranchName: (
    repo: TrackerRepo,
    issue: IssueFolder,
  ) => Promise<string>;
  getAvailableEditors: (repoConfig: TrackerRepoConfig) => Promise<string[]>;
  getGitWorktreePath: (issueFolderName: string) => Promise<string>;
  getArchivePath: {
    (): Promise<string>;
    (repo: TrackerRepo): Promise<string>;
    (repo: TrackerRepo, issueFolder: string): Promise<string>;
  };
  getPriorityTable: (repo: TrackerRepo) => Promise<PriorityTable>;
  getStatusList: (repo: TrackerRepo) => Promise<StatusList>;
  getResolvedStatusList: (repo: TrackerRepo) => Promise<string[]>;
  getWorktreeGitFfOnlyEnabled: (repo: TrackerRepo) => Promise<boolean>;
};

export const useCurrentTrackerRepoStore =
  create<CurrentTrackerRepoStoreState>()((set, get) => ({
    currentTrackerRepo: null,
    subTrackerRepoList: [],

    findCurrentTrackerRepoByCWD: async () => {
      return TrackerRepoStorage.find(ShellService.getInstance().cwd());
    },

    ensureCurrentTrackerRepoFound: async () => {
      if (get().currentTrackerRepo !== null) {
        return;
      }

      const shellService = ShellService.getInstance();
      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      const result = await TrackerRepoStorage.find(shellService.cwd());
      const root = result?.root ?? shellService.cwd();
      const storage = await TrackerRepoStorage.createByProjectPath(
        root,
        globalConfig,
      );
      const currentTrackerRepo = storage.getTrackerRepo();
      const subTrackerRepoList = await TrackerRepoStorage.findSubTrackerRepos(
        currentTrackerRepo.projectPath,
        globalConfig,
      );
      set({ currentTrackerRepo, subTrackerRepoList });

      if (result !== null) {
        try {
          await RegistryService.getInstance().upsertRecentProjects({
            name: currentTrackerRepo.name,
            projectPath: currentTrackerRepo.projectPath,
          });
        } catch {
          // fail silently
        }
      }
    },

    loadCurrentTrackerRepoByPath: async (absPath: string) => {
      const resolved = path.resolve(absPath);
      const globalConfig = await useGlobalConfigStore
        .getState()
        .reloadGlobalConfig();
      set({ currentTrackerRepo: null, subTrackerRepoList: [] });
      const storage = await TrackerRepoStorage.createByProjectPath(
        resolved,
        globalConfig,
      );
      const currentTrackerRepo = storage.getTrackerRepo();
      const subTrackerRepoList = await TrackerRepoStorage.findSubTrackerRepos(
        currentTrackerRepo.projectPath,
        globalConfig,
      );
      set({ currentTrackerRepo, subTrackerRepoList });
    },

    getCurrentTrackerRepo: async () => {
      await get().ensureCurrentTrackerRepoFound();
      return get().currentTrackerRepo!;
    },

    listIssues: async () => {
      await get().ensureCurrentTrackerRepoFound();
      const { currentTrackerRepo } = get();
      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      return new TrackerRepoStorage(
        currentTrackerRepo!,
        globalConfig,
      ).listIssues();
    },

    findIssue: async (issueSelector, options) => {
      if (!IssueSelectorMatcher.isValidateFolderName(issueSelector)) {
        return [];
      }

      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      let all: IssueFolder[];
      if (options?.repo) {
        all = await new TrackerRepoStorage(
          options.repo,
          globalConfig,
        ).listIssues();
      } else if (options?.project) {
        const repo = await get().getTrackerRepoByProjectName(options.project);
        if (!repo) return [];
        all = await new TrackerRepoStorage(repo, globalConfig).listIssues();
      } else {
        const repos = await get().getTrackerRepoList();
        all = [];
        for (const repo of repos) {
          const issues = await new TrackerRepoStorage(
            repo,
            globalConfig,
          ).listIssues();
          all.push(...issues);
        }
      }

      return all.filter((folder) =>
        IssueSelectorMatcher.match(folder.issueId, issueSelector),
      );
    },

    getTrackerRepoList: async () => {
      await get().ensureCurrentTrackerRepoFound();
      const { currentTrackerRepo, subTrackerRepoList } = get();
      return [currentTrackerRepo!, ...subTrackerRepoList];
    },

    getTrackerRepoByProjectName: async (name: string) => {
      const list = await get().getTrackerRepoList();
      return list.find((r) => r.name === name) ?? null;
    },

    findTrackerRepoForIssueFolder: async (issue) => {
      const repos = await get().getTrackerRepoList();
      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      const issueAbs = path.resolve(issue.path);
      for (const repo of repos) {
        const issueRoot = path.resolve(
          new TrackerRepoStorage(repo, globalConfig).getIssuePath(),
        );
        const rel = path.relative(issueRoot, issueAbs);
        if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
          return repo;
        }
      }
      return null;
    },

    findIssuePath: async (issueId, repo) => {
      const target = repo ?? get().currentTrackerRepo!;
      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      const issueRoot = new TrackerRepoStorage(
        target,
        globalConfig,
      ).getIssuePath();
      return path.join(issueRoot, issueId);
    },

    getEditor: async (repoConfig) => {
      const configuredEditor = await resolveConfiguredEditor(repoConfig);
      if (configuredEditor !== null) {
        return configuredEditor;
      }

      return (await getAvailableEditorCandidates())[0]?.resolved ?? null;
    },

    getAvailableEditors: async (repoConfig) => {
      const configuredEditor = await resolveConfiguredEditor(repoConfig);
      const availableCandidates = await getAvailableEditorCandidates();
      const defaultEditor =
        configuredEditor ?? availableCandidates[0]?.resolved ?? null;
      const nonDefaultCandidates = availableCandidates
        .filter(
          (candidate) =>
            candidate.command !== defaultEditor &&
            candidate.resolved !== defaultEditor,
        )
        .map((candidate) => candidate.resolved);
      return uniqueEditors([defaultEditor, ...nonDefaultCandidates]);
    },

    getIssueBranchName: async (repo, issue) => {
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      const template = accessor.getEffectiveIssueBranchNameTemplate();
      const issueName =
        IssueSelectorMatcher.extractIssueSuffix(issue.issueId) ?? "";
      const rendered = ejs.render(template, {
        issue_id: issue.issueId,
        issue_label: issue.label,
        issue_folder_name: issue.issueId,
        issue_name: issueName,
      });
      const normalized = GitBranchFormatter.normalize(rendered, issue.issueId);
      return normalized.slice(0, ISSUE_BRANCH_NAME_MAX_LENGTH);
    },

    getGitWorktreePath: async (issueFolderName) => {
      const repo = await get().getCurrentTrackerRepo();
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      const basePath = accessor.getEffectiveWorktreePath();
      const shell = ShellService.getInstance();
      const folderName = issueFolderName.slice(
        0,
        ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH,
      );
      return shell.isAbsolute(basePath)
        ? path.join(basePath, folderName)
        : path.join(repo.projectPath, basePath, folderName);
    },

    getArchivePath: async (
      repo?: TrackerRepo,
      issueFolder?: string,
    ): Promise<string> => {
      const resolvedRepo = repo ?? (await get().getCurrentTrackerRepo());
      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      const trackerRepoStorage = new TrackerRepoStorage(
        resolvedRepo,
        globalConfig,
      );
      const archiveDir = path.join(
        trackerRepoStorage.getIssuePath(),
        ".archive",
      );
      if (issueFolder === undefined) {
        return archiveDir;
      }
      return path.join(archiveDir, issueFolder);
    },

    getPriorityTable: async (repo) => {
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      return accessor.getEffectivePriorityTable();
    },

    getStatusList: async (repo) => {
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      return accessor.getEffectiveStatusList();
    },

    getResolvedStatusList: async (repo) => {
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      return accessor.getEffectiveResolvedStatusList();
    },

    getWorktreeGitFfOnlyEnabled: async (repo) => {
      const accessor = await createTrackerRepoConfigAccessor(repo.config);
      return accessor.getWorktreeGitFfOnlyEnabled();
    },
  }));
