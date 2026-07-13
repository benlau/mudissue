import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeRemoveCommand } from "../../src/commands/IssueWorktreeRemoveCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";

const buildIssueFolder = (folderName: string, issueId?: string): IssueFolder => ({
  issueId: issueId ?? folderName,
  folderName,
  path: `/repo/issues/${folderName}`,
});

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

class TestIssueWorktreeRemoveCommand extends IssueWorktreeRemoveCommand {
  confirmMessages: string[] = [];

  constructor(private readonly confirmed: boolean) {
    super();
  }

  protected override async askUserConfirmation(message: string): Promise<boolean> {
    this.confirmMessages.push(message);
    return this.confirmed;
  }
}

describe("IssueWorktreeRemoveCommand", () => {
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

    fileService.exists.mockResolvedValue(true);
    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockReturnValue({ status: 0 });
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    useGlobalConfigStore.setState({ globalConfig: {} });
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = (confirmed = true) =>
    new TestIssueWorktreeRemoveCommand(confirmed);

  it("returns ISSUE_NOT_FOUND when no issue matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns ISSUE_MULTI_MATCHED when multiple issues match", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI001-a"),
      buildIssueFolder("MI001-b"),
    ]);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("returns without removing when confirmation is rejected", async () => {
    const folderName = "MI0042-feature";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    const expectedPath = path.join(mockRepo.projectPath, ".claude/worktrees", folderName);

    const command = buildCommand(false);
    await expect(command.command("MI0042")).resolves.toBeUndefined();
    expect(command.confirmMessages).toEqual([`Remove worktree ${expectedPath}?`]);
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("rejects --json with interactive (no-force) mode at preprocessArgument", () => {
    const cmd = buildCommand();
    expect(() =>
      cmd.preprocessArgument("issue worktree remove", {
        debug: false,
        json: true,
        interactive: true,
      }),
    ).toThrow('Command "issue worktree remove" does not support --json');
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("removes the worktree and skips confirmation when force is true", async () => {
    const folderName = "MI0042-feature";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    const expectedPath = path.join(mockRepo.projectPath, ".claude/worktrees", folderName);

    const command = buildCommand(false);
    const result = await command.command("MI0042", { force: true });

    expect(result?.status).toBe("ok");
    expect((result as { result: { path: string } }).result).toMatchObject({
      path: expectedPath,
    });
    expect(command.confirmMessages).toEqual([]);
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["worktree", "remove", expectedPath],
      { cwd: mockRepo.projectPath },
    );
  });

  it("deletes the branch after removing the worktree when deleteBranch is true", async () => {
    const folderName = "MI0042-feature";
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder(folderName, "MI0042"),
    ]);
    const expectedPath = path.join(mockRepo.projectPath, ".claude/worktrees", folderName);

    const result = await buildCommand().command("MI0042", {
      force: true,
      deleteBranch: true,
    });

    expect(result?.status).toBe("ok");
    expect(
      (
        result as {
          result: { path: string; branch: string };
        }
      ).result,
    ).toMatchObject({
      path: expectedPath,
      branch: folderName,
    });
    expect(shellService.runAndWait).toHaveBeenNthCalledWith(
      1,
      "git",
      ["worktree", "remove", expectedPath],
      { cwd: mockRepo.projectPath },
    );
    expect(shellService.runAndWait).toHaveBeenNthCalledWith(
      2,
      "git",
      ["branch", "-D", folderName],
      { cwd: mockRepo.projectPath },
    );
  });

  it("calls getTrackerRepoByProjectName and find with project when project is passed", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI0042-feature")]);

    await buildCommand().command("MI0042", { project: "proj-a", force: true });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("MI0042", {
      project: "proj-a",
    });
  });

  it("throws when git worktree remove returns non-zero", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI0042-feature")]);
    shellService.runAndWait.mockReturnValue({ status: 1 });

    await expect(
      buildCommand().command("MI0042", { force: true }),
    ).rejects.toThrow("git worktree remove failed");
  });

  it("throws when branch deletion returns non-zero", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI0042-feature")]);
    shellService.runAndWait.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "branch") {
        return { status: 1 };
      }
      return { status: 0 };
    });

    await expect(
      buildCommand().command("MI0042", { force: true, deleteBranch: true }),
    ).rejects.toThrow("git branch -D failed");
  });
});
