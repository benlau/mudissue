import { jest } from "@jest/globals";
import {
  ISSUE_BRANCH_NAME_MAX_LENGTH,
  ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH,
} from "../../src/constants.ts";
import { TrackerRepoStorage } from "../../src/async/storage/TrackerRepoStorage.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import {
  useCurrentTrackerRepoStore,
  resetCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type {
  TrackerRepo,
  TrackerRepoConfig,
} from "../../src/types/Tracker.ts";
import {
  DEFAULT_RESOLVED_STATUS_LIST,
  SystemStatus,
} from "../../src/types/status.ts";

function asTrackerRepoStorage(repo: TrackerRepo): TrackerRepoStorage {
  return {
    getTrackerRepo: () => repo,
  } as unknown as TrackerRepoStorage;
}

describe("CurrentTrackerRepoStore", () => {
  let mockShellService: jest.Mocked<
    Pick<ShellService, "which" | "isAbsolute" | "cwd">
  >;
  const originalEnv = process.env.MUDISSUE_EDITOR;

  beforeEach(() => {
    resetGlobalConfigStore();
    resetCurrentTrackerRepoStore();
    mockShellService = {
      which: jest.fn(),
      isAbsolute: jest.fn(),
      cwd: jest.fn().mockReturnValue("/tmp/cwd"),
    } as unknown as jest.Mocked<
      Pick<ShellService, "which" | "isAbsolute" | "cwd">
    >;
    ShellService.setInstance(mockShellService as unknown as ShellService);
    delete process.env.MUDISSUE_EDITOR;
  });

  afterEach(() => {
    process.env.MUDISSUE_EDITOR = originalEnv;
    ShellService.setInstance(null);
    resetCurrentTrackerRepoStore();
    resetGlobalConfigStore();
  });

  describe("getEditor", () => {
    const emptyRepoConfig: TrackerRepoConfig = {};

    it("uses MUDISSUE_EDITOR first", async () => {
      process.env.MUDISSUE_EDITOR = "/usr/bin/code";
      mockShellService.which.mockResolvedValue(null);

      const editor = await useCurrentTrackerRepoStore
        .getState()
        .getEditor(emptyRepoConfig);

      expect(editor).toBe("/usr/bin/code");
      expect(mockShellService.which).not.toHaveBeenCalled();
    });

    it("uses repo editor before global default editor", async () => {
      useGlobalConfigStore.setState({
        globalConfig: { default_editor: "/global/nano" },
      });

      const editor = await useCurrentTrackerRepoStore
        .getState()
        .getEditor({ editor: "/project/code" });

      expect(editor).toBe("/project/code");
      expect(mockShellService.which).not.toHaveBeenCalled();
    });

    it("falls back to editor candidates when no configured editor", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "vi") return "/usr/bin/vi";
        return null;
      });

      const editor = await useCurrentTrackerRepoStore
        .getState()
        .getEditor(emptyRepoConfig);

      expect(editor).toBe("/usr/bin/vi");
      expect(mockShellService.which).toHaveBeenCalledWith("vim");
      expect(mockShellService.which).toHaveBeenCalledWith("vi");
    });
  });

  describe("getAvailableEditors", () => {
    const emptyRepoConfig: TrackerRepoConfig = {};

    it("returns available built-in editor candidates", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "vim") return "/usr/bin/vim";
        if (editor === "nano") return "/usr/bin/nano";
        return null;
      });

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors(emptyRepoConfig);

      expect(editors).toEqual(["/usr/bin/vim", "/usr/bin/nano"]);
      expect(mockShellService.which).toHaveBeenCalledWith("vim");
      expect(mockShellService.which).toHaveBeenCalledWith("vi");
      expect(mockShellService.which).toHaveBeenCalledWith("nano");
    });

    it("includes cursor, code, and emacs when installed", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "cursor") return "/usr/local/bin/cursor";
        if (editor === "code") return "/usr/local/bin/code";
        if (editor === "emacs") return "/opt/homebrew/bin/emacs";
        return null;
      });

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors(emptyRepoConfig);

      expect(editors).toEqual([
        "/usr/local/bin/cursor",
        "/usr/local/bin/code",
        "/opt/homebrew/bin/emacs",
      ]);
    });

    it("puts the configured default editor first", async () => {
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "vim") return "/usr/bin/vim";
        return null;
      });

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors({ editor: "/opt/bin/code" });

      expect(editors).toEqual(["/opt/bin/code", "/usr/bin/vim"]);
    });

    it("deduplicates the default editor when it is also a candidate", async () => {
      process.env.MUDISSUE_EDITOR = "/usr/bin/vi";
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "vi") return "/usr/bin/vi";
        if (editor === "nano") return "/usr/bin/nano";
        return null;
      });

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors(emptyRepoConfig);

      expect(editors).toEqual(["/usr/bin/vi", "/usr/bin/nano"]);
    });

    it("deduplicates a default editor command name from its resolved candidate", async () => {
      process.env.MUDISSUE_EDITOR = "vim";
      mockShellService.which.mockImplementation(async (editor) => {
        if (editor === "vim") return "/usr/bin/vim";
        if (editor === "nano") return "/usr/bin/nano";
        return null;
      });

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors(emptyRepoConfig);

      expect(editors).toEqual(["vim", "/usr/bin/nano"]);
    });

    it("returns an empty list when no editor is available", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      mockShellService.which.mockResolvedValue(null);

      const editors = await useCurrentTrackerRepoStore
        .getState()
        .getAvailableEditors(emptyRepoConfig);

      expect(editors).toEqual([]);
    });
  });

  describe("findIssue", () => {
    const repoA: TrackerRepo = {
      name: "proj-a",
      projectPath: "/workspace",
      trackerPath: "/workspace",
      config: { issue_path: "issues-a" },
    };
    const repoB: TrackerRepo = {
      name: "proj-b",
      projectPath: "/workspace/sub",
      trackerPath: "/workspace/sub",
      config: { issue_path: "issues-b" },
    };

    const issueInA: IssueFolder = {
      issueId: "MI0257-in-proj-a",
      label: "MI0257",
      path: "/workspace/issues-a/MI0257-in-proj-a",
    };
    const issueInB: IssueFolder = {
      issueId: "MI0257-in-proj-b",
      label: "MI0257",
      path: "/workspace/sub/issues-b/MI0257-in-proj-b",
    };

    beforeEach(() => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoA,
        subTrackerRepoList: [repoB],
      });
    });

    it("searches all workspace tracker repos when project is omitted", async () => {
      const listIssuesSpy = jest
        .spyOn(TrackerRepoStorage.prototype, "listIssues")
        .mockResolvedValueOnce([issueInA])
        .mockResolvedValueOnce([issueInB]);

      const matches = await useCurrentTrackerRepoStore
        .getState()
        .findIssue("257");

      expect(listIssuesSpy).toHaveBeenCalledTimes(2);
      expect(matches.map((i) => i.issueId).sort()).toEqual([
        "MI0257-in-proj-a",
        "MI0257-in-proj-b",
      ]);
      listIssuesSpy.mockRestore();
    });

    it("searches only the named project when project is set", async () => {
      const listIssuesSpy = jest
        .spyOn(TrackerRepoStorage.prototype, "listIssues")
        .mockResolvedValue([issueInB]);

      const matches = await useCurrentTrackerRepoStore
        .getState()
        .findIssue("257", { project: "proj-b" });

      expect(listIssuesSpy).toHaveBeenCalledTimes(1);
      expect(matches).toEqual([issueInB]);
      listIssuesSpy.mockRestore();
    });
  });

  describe("findTrackerRepoForIssueFolder", () => {
    const repoA: TrackerRepo = {
      name: "proj-a",
      projectPath: "/workspace",
      trackerPath: "/workspace",
      config: { issue_path: "issues-a" },
    };
    const repoB: TrackerRepo = {
      name: "proj-b",
      projectPath: "/workspace/sub",
      trackerPath: "/workspace/sub",
      config: { issue_path: "issues-b" },
    };

    const buildIssue = (absPath: string): IssueFolder => ({
      issueId: "0001-test",
      label: "0001",
      path: absPath,
    });

    it("returns the repo whose issue root contains the issue folder path", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoA,
        subTrackerRepoList: [repoB],
      });

      const issueInB = buildIssue("/workspace/sub/issues-b/0001-test");
      const found = await useCurrentTrackerRepoStore
        .getState()
        .findTrackerRepoForIssueFolder(issueInB);

      expect(found).toBe(repoB);
    });

    it("returns null when the issue path is not under any workspace repo", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoA,
        subTrackerRepoList: [repoB],
      });

      const orphan = buildIssue("/other/issues/0001-test");
      const found = await useCurrentTrackerRepoStore
        .getState()
        .findTrackerRepoForIssueFolder(orphan);

      expect(found).toBeNull();
    });

    it("uses each repo issue path from TrackerRepoStorage", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoA,
        subTrackerRepoList: [],
      });
      const issueRoot = new TrackerRepoStorage(repoA, {}).getIssuePath();
      const issue = buildIssue(`${issueRoot}/0001-test`);

      const found = await useCurrentTrackerRepoStore
        .getState()
        .findTrackerRepoForIssueFolder(issue);

      expect(found).toBe(repoA);
    });
  });

  describe("getGitWorktreePath", () => {
    const repo: TrackerRepo = {
      name: "proj",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    };

    it("uses repo config worktree path first", async () => {
      mockShellService.isAbsolute.mockReturnValue(false);
      const repoWithWorktree: TrackerRepo = {
        ...repo,
        config: { ...repo.config, worktree_path: "repo/worktrees" },
      };
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoWithWorktree,
        subTrackerRepoList: [],
      });

      const worktreePath = await useCurrentTrackerRepoStore
        .getState()
        .getGitWorktreePath("MI001");

      expect(worktreePath).toBe("/repo/repo/worktrees/MI001");
    });

    it("uses absolute global default_worktree_path when repo has none", async () => {
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repo,
        subTrackerRepoList: [],
      });
      useGlobalConfigStore.setState({
        globalConfig: { default_worktree_path: "/global/worktrees" },
      });
      mockShellService.isAbsolute.mockReturnValue(true);

      const worktreePath = await useCurrentTrackerRepoStore
        .getState()
        .getGitWorktreePath("MI001");

      expect(worktreePath).toBe("/global/worktrees/MI001");
    });

    it("truncates the worktree folder name to ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH characters", async () => {
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repo,
        subTrackerRepoList: [],
      });
      mockShellService.isAbsolute.mockReturnValue(false);

      const longFolderName =
        "MI0001-very-long-issue-folder-name-that-exceeds-the-limit";
      const worktreePath = await useCurrentTrackerRepoStore
        .getState()
        .getGitWorktreePath(longFolderName);

      expect(worktreePath).toBe(
        `/repo/.claude/worktrees/${longFolderName.slice(0, ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH)}`,
      );
    });
  });

  describe("getIssueBranchName", () => {
    const repo: TrackerRepo = {
      name: "proj",
      projectPath: "/repo",
      trackerPath: "/repo",
      config: { issue_path: "issues" },
    };
    const issue: IssueFolder = {
      issueId: "MI0089-mi-issue-branch-create",
      label: "MI0089",
      path: "/repo/issues/MI0089-mi-issue-branch-create",
    };

    it("uses the issue folder name by default", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });

      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(repo, issue);

      expect(branch).toBe("MI0089-mi-issue-branch-create");
    });

    it("uses repo config before global config", async () => {
      useGlobalConfigStore.setState({
        globalConfig: {
          default_issue_branch_name_template: "global/<%= issue_folder_name %>",
        },
      });

      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(
          {
            ...repo,
            config: {
              ...repo.config,
              issue_branch_name_template: "repo/<%= issue_folder_name %>-dev",
            },
          },
          issue,
        );

      expect(branch).toBe("repo/MI0089-mi-issue-branch-crea");
    });

    it("uses global config when repo config is absent", async () => {
      useGlobalConfigStore.setState({
        globalConfig: {
          default_issue_branch_name_template:
            "pr/<%= issue_id %>-<%= issue_name %>",
        },
      });

      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(repo, issue);

      expect(branch).toBe("pr/MI0089-mi-issue-branch-create");
    });

    it("exposes issue_label as PREFIX+NUM in branch templates", async () => {
      useGlobalConfigStore.setState({
        globalConfig: {
          default_issue_branch_name_template:
            "feature/<%= issue_label %>-<%= issue_name %>",
        },
      });

      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(repo, issue);

      expect(branch).toBe("feature/MI0089-mi-issue-branch-c");
    });

    it("returns a trimmed branch name", async () => {
      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(
          {
            ...repo,
            config: {
              ...repo.config,
              issue_branch_name_template: "  pr/<%= issue_folder_name %>  ",
            },
          },
          issue,
        );

      expect(branch).toBe("pr/MI0089-mi-issue-branch-create");
    });

    it("normalizes rendered branch names", async () => {
      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(
          {
            ...repo,
            config: {
              ...repo.config,
              issue_branch_name_template:
                " /feature//<%= issue_folder_name %>:fix bug?/@{draft}. ",
            },
          },
          issue,
        );

      expect(branch).toBe("feature/MI0089-mi-issue-branch-c");
    });

    it("truncates the branch name to ISSUE_BRANCH_NAME_MAX_LENGTH characters", async () => {
      const longIssue: IssueFolder = {
        issueId: "MI0001-very-long-issue-folder-name-that-exceeds-the-limit",
        label: "MI0001",
        path: "/repo/issues/MI0001-very-long-issue-folder-name-that-exceeds-the-limit",
      };

      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(repo, longIssue);

      expect(branch).toBe(
        longIssue.issueId.slice(0, ISSUE_BRANCH_NAME_MAX_LENGTH),
      );
    });

    it("falls back to the issue id when rendered branch name is empty after normalization", async () => {
      const branch = await useCurrentTrackerRepoStore
        .getState()
        .getIssueBranchName(
          {
            ...repo,
            config: {
              ...repo.config,
              issue_branch_name_template: " @ ",
            },
          },
          issue,
        );

      expect(branch).toBe("MI0089-mi-issue-branch-create");
    });
  });

  describe("getResolvedStatusList", () => {
    const repo: TrackerRepo = {
      name: "repo",
      projectPath: "/tmp/repo",
      trackerPath: "/tmp/repo",
      config: { resolved_status_list: ["done", "wontfix"] },
    };

    it("returns effective resolved statuses for the repo", async () => {
      useGlobalConfigStore.setState({
        globalConfig: { default_resolved_status_list: ["closed"] },
      });

      const list = await useCurrentTrackerRepoStore
        .getState()
        .getResolvedStatusList(repo);

      expect(list).toEqual(["done", "wontfix"]);
    });

    it("uses global and built-in defaults when repo override is unset", async () => {
      useGlobalConfigStore.setState({ globalConfig: {} });

      const list = await useCurrentTrackerRepoStore
        .getState()
        .getResolvedStatusList({
          ...repo,
          config: {},
        });

      expect(list).toEqual(DEFAULT_RESOLVED_STATUS_LIST);
    });
  });

  describe("getStatusAliases", () => {
    it("returns the effective alias map for the repo", async () => {
      useGlobalConfigStore.setState({
        globalConfig: {
          default_status_aliases: {
            active: { statuses: ["open", "backlog"] },
          },
        },
      });

      const aliases = await useCurrentTrackerRepoStore
        .getState()
        .getStatusAliases({
          name: "repo",
          projectPath: "/tmp/repo",
          trackerPath: "/tmp/repo",
          config: {
            status_aliases: {
              active: { statuses: ["open"] },
            },
          },
        });

      expect(aliases).toEqual({
        [SystemStatus.Resolved]: DEFAULT_RESOLVED_STATUS_LIST,
        active: ["open"],
      });
    });
  });

  describe("recent projects registry", () => {
    let upsertRecentProjectsMock: jest.Mock<() => Promise<void>>;

    beforeEach(() => {
      upsertRecentProjectsMock = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      RegistryService.setInstance({
        upsertRecentProjects: upsertRecentProjectsMock,
      } as unknown as RegistryService);
      useGlobalConfigStore.setState({ globalConfig: {} });
    });

    afterEach(() => {
      RegistryService.setInstance(
        null as unknown as RegistryService,
      );
      jest.restoreAllMocks();
    });

    it("upserts recents on ensure when the loaded tracker repo has mud.conf", async () => {
      const repo: TrackerRepo = {
        name: "proj-a",
        projectPath: "/tmp/proj-a",
        trackerPath: "/tmp/proj-a",
        config: {},
        configFilePath: "/tmp/proj-a/mud.conf",
      };
      jest.spyOn(TrackerRepoStorage, "find").mockResolvedValue({
        root: "/tmp/proj-a",
        configPath: "/tmp/proj-a/mud.conf",
      });
      jest
        .spyOn(TrackerRepoStorage, "createByProjectPath")
        .mockResolvedValue(asTrackerRepoStorage(repo));
      jest.spyOn(TrackerRepoStorage, "findSubTrackerRepos").mockResolvedValue([]);

      await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();

      expect(upsertRecentProjectsMock).toHaveBeenCalledWith({
        name: "proj-a",
        projectPath: "/tmp/proj-a",
      });
    });

    it("does not upsert recents on ensure when no mud.conf was loaded", async () => {
      const repo: TrackerRepo = {
        name: "cwd",
        projectPath: "/tmp/cwd",
        trackerPath: "/tmp/cwd",
        config: {},
      };
      jest.spyOn(TrackerRepoStorage, "find").mockResolvedValue(null);
      jest
        .spyOn(TrackerRepoStorage, "createByProjectPath")
        .mockResolvedValue(asTrackerRepoStorage(repo));
      jest.spyOn(TrackerRepoStorage, "findSubTrackerRepos").mockResolvedValue([]);

      await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();

      expect(upsertRecentProjectsMock).not.toHaveBeenCalled();
    });

    it("does not upsert again when ensure is called after the tracker repo is set", async () => {
      const findSpy = jest.spyOn(TrackerRepoStorage, "find");
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: {
          name: "already",
          projectPath: "/tmp/already",
          trackerPath: "/tmp/already",
          config: {},
          configFilePath: "/tmp/already/mud.conf",
        },
        subTrackerRepoList: [],
      });

      await useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();

      expect(upsertRecentProjectsMock).not.toHaveBeenCalled();
      expect(findSpy).not.toHaveBeenCalled();
    });

    it("upserts recents after loadCurrentTrackerRepoByPath when the target has mud.conf", async () => {
      const repo: TrackerRepo = {
        name: "proj-b",
        projectPath: "/tmp/proj-b",
        trackerPath: "/tmp/proj-b",
        config: {},
        configFilePath: "/tmp/proj-b/mud.conf",
      };
      useGlobalConfigStore.setState({
        globalConfig: {},
        reloadGlobalConfig: jest.fn().mockResolvedValue({}),
      });
      jest
        .spyOn(TrackerRepoStorage, "createByProjectPath")
        .mockResolvedValue(asTrackerRepoStorage(repo));
      jest.spyOn(TrackerRepoStorage, "findSubTrackerRepos").mockResolvedValue([]);

      await useCurrentTrackerRepoStore
        .getState()
        .loadCurrentTrackerRepoByPath("/tmp/proj-b");

      expect(upsertRecentProjectsMock).toHaveBeenCalledWith({
        name: "proj-b",
        projectPath: "/tmp/proj-b",
      });
    });

    it("keeps the previous tracker repo until load by path finishes", async () => {
      const repoA: TrackerRepo = {
        name: "proj-a",
        projectPath: "/tmp/proj-a",
        trackerPath: "/tmp/proj-a",
        config: {},
        configFilePath: "/tmp/proj-a/mud.conf",
      };
      const repoB: TrackerRepo = {
        name: "proj-b",
        projectPath: "/tmp/proj-b",
        trackerPath: "/tmp/proj-b",
        config: {},
        configFilePath: "/tmp/proj-b/mud.conf",
      };
      useCurrentTrackerRepoStore.setState({
        currentTrackerRepo: repoA,
        subTrackerRepoList: [],
      });
      useGlobalConfigStore.setState({
        globalConfig: {},
        reloadGlobalConfig: jest.fn().mockResolvedValue({}),
      });
      let resolveCreate!: (value: TrackerRepoStorage) => void;
      const createDeferred = new Promise<TrackerRepoStorage>((resolve) => {
        resolveCreate = resolve;
      });
      jest
        .spyOn(TrackerRepoStorage, "createByProjectPath")
        .mockReturnValue(createDeferred);
      jest.spyOn(TrackerRepoStorage, "findSubTrackerRepos").mockResolvedValue([]);

      const loadPromise = useCurrentTrackerRepoStore
        .getState()
        .loadCurrentTrackerRepoByPath("/tmp/proj-b");

      expect(useCurrentTrackerRepoStore.getState().currentTrackerRepo).toBe(
        repoA,
      );
      resolveCreate(asTrackerRepoStorage(repoB));
      await loadPromise;

      expect(useCurrentTrackerRepoStore.getState().currentTrackerRepo).toBe(
        repoB,
      );
    });
  });
});
