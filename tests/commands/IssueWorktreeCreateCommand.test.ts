import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeCreateCommand } from "../../src/commands/IssueWorktreeCreateCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";

const buildIssueFolder = (issueId: string, label?: string): IssueFolder => ({
  issueId,
  label: label ?? extractIssueLabel(issueId),
  path: `/repo/issues/${issueId}`,
});

const extractIssueLabel = (issueId: string): string => {
  const m = issueId.trim().match(/^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/);
  return m ? `${m[1]}${m[2]}` : issueId;
};

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const defaultRunAndWait = (_command: string, args: string[]) => {
  if (args[0] === "show-ref") {
    return { status: 1 };
  }
  return { status: 0 };
};

describe("IssueWorktreeCreateCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockImplementation(defaultRunAndWait);
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();

    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockImplementation(defaultRunAndWait);
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    ShellService.setInstance(shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    useGlobalConfigStore.setState({ globalConfig: {} });
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = () => new IssueWorktreeCreateCommand();

  it("returns ISSUE_NOT_FOUND when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns ISSUE_MULTI_MATCHED when more than one match", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI001-a"),
      buildIssueFolder("MI001-b"),
    ]);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns DOT_GIT_NOT_FOUND when .git does not exist at repo root", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI001")]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p !== path.join(mockRepo.projectPath, ".git")),
    );

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "DOT_GIT_NOT_FOUND" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns GIT_BINARY_NOT_FOUND when git is not in PATH", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI001")]);
    fileService.exists.mockResolvedValue(true);
    shellService.which.mockResolvedValue(null);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "GIT_BINARY_NOT_FOUND" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns success with worktree_path when path already exists", async () => {
    const folderName = "MI0036-mi-create-worktree";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    const existingPath = path.join(
      mockRepo.projectPath,
      ".claude/worktrees/",
      folderName,
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git") || p === existingPath),
    );

    const command = buildCommand();
    const result = await command.command("MI0036");

    expect(result?.status).toBe("ok");
    expect((result as { result: { worktree_path: string } }).result).toMatchObject({
      worktree_path: existingPath,
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("calls git worktree add and returns success when path does not exist", async () => {
    const folderName = "MI0042-feature";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git")),
    );

    const command = buildCommand();
    const result = await command.command("MI0042");

    expect(result?.status).toBe("ok");
    const expectedPath = path.join(
      mockRepo.projectPath,
      ".claude/worktrees/",
      folderName,
    );
    expect((result as { result: { worktree_path: string } }).result).toMatchObject({
      worktree_path: expectedPath,
    });
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", folderName, expectedPath],
      { cwd: mockRepo.projectPath },
    );
  });

  it("uses repo.config.worktree_path when set", async () => {
    const repoWithWorktree: TrackerRepo = {
      ...mockRepo,
      config: { ...mockRepo.config, worktree_path: "worktrees" },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithWorktree);
    const folderName = "MI001";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(repoWithWorktree.projectPath, ".git")),
    );

    const command = buildCommand();
    await command.command("MI001");

    const expectedPath = path.join(
      repoWithWorktree.projectPath,
      "worktrees",
      folderName,
    );
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", folderName, expectedPath],
      { cwd: repoWithWorktree.projectPath },
    );
  });

  it("uses repo.config.issue_branch_name_template for the git branch", async () => {
    const repoWithBranchTemplate: TrackerRepo = {
      ...mockRepo,
      config: {
        ...mockRepo.config,
        issue_branch_name_template: "pr/<%= issue_folder_name %>-dev",
      },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithBranchTemplate);
    const folderName = "MI001-branch-template";
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder(folderName, "MI001"),
    ]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(repoWithBranchTemplate.projectPath, ".git")),
    );

    const command = buildCommand();
    await command.command("MI001");

    const expectedPath = path.join(
      repoWithBranchTemplate.projectPath,
      ".claude/worktrees/",
      folderName,
    );
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", `pr/${folderName}-dev`, expectedPath],
      { cwd: repoWithBranchTemplate.projectPath },
    );
  });

  it("uses an existing branch when it is already present", async () => {
    const folderName = "MI001-existing-branch";
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder(folderName, "MI001"),
    ]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git")),
    );
    shellService.runAndWait.mockReturnValue({ status: 0 });

    const command = buildCommand();
    await command.command("MI001");

    const expectedPath = path.join(
      mockRepo.projectPath,
      ".claude/worktrees/",
      folderName,
    );
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", expectedPath, folderName],
      { cwd: mockRepo.projectPath },
    );
  });

  it("uses absolute repo.config.worktree_path when set", async () => {
    const absWorktreePath = "/abs/worktrees";
    const repoWithWorktree: TrackerRepo = {
      ...mockRepo,
      config: { ...mockRepo.config, worktree_path: absWorktreePath },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithWorktree);
    const folderName = "MI001";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(repoWithWorktree.projectPath, ".git")),
    );

    const command = buildCommand();
    await command.command("MI001");

    const expectedPath = path.join(absWorktreePath, folderName);
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", folderName, expectedPath],
      { cwd: repoWithWorktree.projectPath },
    );
  });

  it("uses global default_worktree_path when repo has no worktree_path", async () => {
    useGlobalConfigStore.setState({
      globalConfig: { default_worktree_path: "global/worktrees" },
    });
    const folderName = "MI001";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git")),
    );

    const command = buildCommand();
    await command.command("MI001");

    const expectedPath = path.join(
      mockRepo.projectPath,
      "global/worktrees",
      folderName,
    );
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", folderName, expectedPath],
      { cwd: mockRepo.projectPath },
    );
  });

  it("throws when git worktree add returns non-zero", async () => {
    const folderName = "MI001";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git")),
    );
    shellService.runAndWait.mockImplementation((_command, args) => {
      if (args[0] === "show-ref") {
        return { status: 1 };
      }
      return { status: 1 };
    });

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toThrow(
      /git worktree add failed.*exit code 1/,
    );
  });

  it("calls getTrackerRepoByProjectName and find with project when project is passed", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("MI001", "proj-a")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("MI001", {
      project: "proj-a",
    });
  });
});
