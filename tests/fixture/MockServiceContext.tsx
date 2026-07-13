import * as path from "path";
import { jest } from "@jest/globals";
import { resetGlobalConfigStore } from "../../src/store/GlobalConfigStore.ts";
import { FileService } from "../../src/services/FileService.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { DEFAULT_SORTING_ORDER } from "../../src/types/SortingOrder.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { GitService } from "../../src/services/GitService.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import { useTerminalSizeStore } from "../../src/views/hooks/useTerminal.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";

type IssueFinderLike = {
  find: jest.Mock;
};

export function createMockFileService(): jest.Mocked<FileService> {
  return {
    exists: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    copyFile: jest.fn(),
    rename: jest.fn(),
    rm: jest.fn(),
    rmdir: jest.fn(),
    watch: jest.fn().mockReturnValue(jest.fn()),
    isBinaryFile: jest.fn(),
  } as unknown as jest.Mocked<FileService>;
}

export function createMockShellService(): jest.Mocked<ShellService> {
  return {
    cwd: jest.fn(() => process.cwd()),
    tmpdir: jest.fn(() => "/tmp"),
    relative: jest.fn((from: string, to: string) => path.relative(from, to)),
    isAbsolute: jest.fn((p: string) => path.isAbsolute(p)),
    which: jest.fn(),
    run: jest.fn(),
    open: jest.fn(),
    runAndWait: jest.fn(),
    runAndCapture: jest.fn(() => ({ status: 1, stdout: "" })),
    runShellAndWait: jest.fn(),
    openShell: jest.fn(),
  } as unknown as jest.Mocked<ShellService>;
}

export function createMockGitService(): jest.Mocked<
  Pick<
    GitService,
    | "getCurrentBranchLabel"
    | "getBaseProjectBranchName"
    | "getGitFolderHeadObjectId"
    | "listWorktree"
    | "logCommits"
    | "resolveLogRefForWorktree"
    | "findMergeBaseFromWorktree"
    | "pickOldestCommitOid"
    | "isAncestor"
    | "createGraph"
    | "resolveRef"
    | "parseDotGitFileAtFolder"
  >
> {
  const realGitService = new GitService();
  return {
    getCurrentBranchLabel: jest.fn(),
    getBaseProjectBranchName: jest.fn(),
    getGitFolderHeadObjectId: jest.fn(),
    listWorktree: jest.fn(),
    logCommits: jest.fn(),
    resolveLogRefForWorktree: jest.fn(),
    findMergeBaseFromWorktree: jest.fn(),
    pickOldestCommitOid: jest.fn(async (_base, oids: string[]) => oids[0]!),
    isAncestor: jest.fn(),
    createGraph: jest.fn(),
    resolveRef: jest.fn(),
    parseDotGitFileAtFolder: jest.fn((dirContainingDotGit) =>
      realGitService.parseDotGitFileAtFolder(dirContainingDotGit),
    ),
  } as unknown as jest.Mocked<
    Pick<
      GitService,
      | "getCurrentBranchLabel"
      | "getBaseProjectBranchName"
      | "getGitFolderHeadObjectId"
      | "listWorktree"
      | "logCommits"
      | "resolveLogRefForWorktree"
      | "findMergeBaseFromWorktree"
      | "createGraph"
      | "resolveRef"
      | "parseDotGitFileAtFolder"
    >
  >;
}

export function createMockLoggerService(): jest.Mocked<LoggerService> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

/** Mocks merged into `useCurrentTrackerRepoStore.getState()` for tests. */
export type MockTrackerRepoStore = {
  findCurrentTrackerRepoByCWD: jest.Mock;
  ensureCurrentTrackerRepoFound: jest.Mock;
  loadCurrentTrackerRepoByPath: jest.Mock;
  getCurrentTrackerRepo: jest.Mock;
  listIssues: jest.Mock;
  findIssue: jest.Mock;
  getTrackerRepoList: jest.Mock;
  getTrackerRepoByProjectName: jest.Mock;
  findIssuePath: jest.Mock;
};

/** Sets real store state so in-store `get()` sees the repo (not only getState spy). */
export function setMockCurrentTrackerRepo(repo: TrackerRepo): void {
  useCurrentTrackerRepoStore.setState({
    currentTrackerRepo: repo,
    subTrackerRepoList: [],
  });
}

function createSyncingGetCurrentTrackerRepoMock(): jest.Mock {
  const getCurrentTrackerRepo = jest.fn();
  const origMockResolvedValue =
    getCurrentTrackerRepo.mockResolvedValue.bind(getCurrentTrackerRepo);
  getCurrentTrackerRepo.mockResolvedValue = (value: unknown) => {
    if (
      value != null &&
      typeof value === "object" &&
      "projectPath" in value &&
      typeof (value as TrackerRepo).projectPath === "string"
    ) {
      setMockCurrentTrackerRepo(value as TrackerRepo);
    }
    return origMockResolvedValue(value);
  };
  return getCurrentTrackerRepo;
}

export function createMockTrackerRepoStore(): MockTrackerRepoStore {
  return {
    findCurrentTrackerRepoByCWD: jest.fn(),
    ensureCurrentTrackerRepoFound: jest.fn(),
    loadCurrentTrackerRepoByPath: jest.fn(),
    getCurrentTrackerRepo: createSyncingGetCurrentTrackerRepoMock(),
    listIssues: jest.fn(),
    findIssue: jest.fn(),
    getTrackerRepoList: jest.fn(),
    getTrackerRepoByProjectName: jest.fn(),
    findIssuePath: jest.fn(),
  };
}

export function createMockIssueFinderService(): IssueFinderLike {
  return {
    find: jest.fn(),
  };
}

export function createMockRegistryService(): jest.Mocked<RegistryService> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    upsertRecentProjects: jest.fn(),
    getRecentProjects: jest.fn(),
    getIssueListSortOrder: jest
      .fn()
      .mockResolvedValue({ ...DEFAULT_SORTING_ORDER }),
    setIssueListSortOrder: jest.fn().mockResolvedValue(undefined),
    getPinnedIssueFolderNames: jest.fn().mockResolvedValue([]),
    setPinnedIssueFolderNames: jest.fn().mockResolvedValue(undefined),
    togglePinnedIssueFolderName: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<RegistryService>;
}

export type MockServiceContextBundle = {
  loggerService: jest.Mocked<LoggerService>;
  fileService: jest.Mocked<FileService>;
  shellService: jest.Mocked<ShellService>;
  gitService: jest.Mocked<
    Pick<
      GitService,
      | "getCurrentBranchLabel"
      | "listWorktree"
      | "logCommits"
      | "resolveLogRefForWorktree"
      | "findMergeBaseFromWorktree"
      | "createGraph"
      | "resolveRef"
    >
  >;
  /** Mocks for CurrentTrackerRepoStore methods (via getState spy). */
  trackerRepoStore: MockTrackerRepoStore;
  issueFinderService: IssueFinderLike;
  registryService: jest.Mocked<RegistryService>;
};

export function createMockServiceContext(): MockServiceContextBundle {
  const loggerService = createMockLoggerService();
  const fileService = createMockFileService();
  const shellService = createMockShellService();
  const gitService = createMockGitService();
  const trackerRepoStore = createMockTrackerRepoStore();
  const issueFinderService = createMockIssueFinderService();
  issueFinderService.find = trackerRepoStore.findIssue as typeof issueFinderService.find;
  const registryService = createMockRegistryService();

  resetCurrentTrackerRepoStore();
  const realStore = useCurrentTrackerRepoStore.getState();
  const delegate = <T extends (...args: never[]) => unknown>(
    mock: jest.Mock<T>,
    implementation: T,
  ): void => {
    mock.mockImplementation(implementation);
  };
  delegate(
    trackerRepoStore.getCurrentTrackerRepo,
    realStore.getCurrentTrackerRepo.bind(realStore),
  );
  delegate(trackerRepoStore.listIssues, realStore.listIssues.bind(realStore));
  delegate(trackerRepoStore.findIssue, realStore.findIssue.bind(realStore));
  delegate(
    trackerRepoStore.getTrackerRepoList,
    realStore.getTrackerRepoList.bind(realStore),
  );
  delegate(
    trackerRepoStore.ensureCurrentTrackerRepoFound,
    realStore.ensureCurrentTrackerRepoFound.bind(realStore),
  );
  useCurrentTrackerRepoStore.setState({
    findCurrentTrackerRepoByCWD: trackerRepoStore.findCurrentTrackerRepoByCWD,
    ensureCurrentTrackerRepoFound: trackerRepoStore.ensureCurrentTrackerRepoFound,
    loadCurrentTrackerRepoByPath: trackerRepoStore.loadCurrentTrackerRepoByPath,
    getCurrentTrackerRepo: trackerRepoStore.getCurrentTrackerRepo,
    listIssues: trackerRepoStore.listIssues,
    findIssue: trackerRepoStore.findIssue,
    getTrackerRepoList: trackerRepoStore.getTrackerRepoList,
    getTrackerRepoByProjectName: trackerRepoStore.getTrackerRepoByProjectName,
    findIssuePath: trackerRepoStore.findIssuePath,
  });

  LoggerService.setInstance(loggerService as unknown as LoggerService);
  RegistryService.setInstance(registryService as unknown as RegistryService);
  ShellService.setInstance(shellService as unknown as ShellService);
  FileService.setInstance(fileService as unknown as FileService);
  GitService.setInstance(gitService as unknown as GitService);

  return {
    loggerService,
    fileService,
    shellService,
    gitService,
    trackerRepoStore,
    issueFinderService,
    registryService,
  };
}

export function setupMockService(): void {
  createMockServiceContext();
  resetGlobalConfigStore();
  useTerminalSizeStore.setState({ start: jest.fn() });
}

// Backward-compatible aliases while tests migrate.
export type MockSystemContextBundle = MockServiceContextBundle;
export const createMockSystemContext = createMockServiceContext;
export const setupMockSystemContext = setupMockService;
