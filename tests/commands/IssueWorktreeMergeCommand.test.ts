import { jest } from "@jest/globals";
import * as path from "path";
import { WorktreeHelper } from "../../src/helpers/WorktreeHelper.ts";
import { IssueWorktreeMergeCommand } from "../../src/commands/IssueWorktreeMergeCommand.ts";
import { GitService } from "../../src/services/GitService.ts";
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

class TestIssueWorktreeMergeCommand extends IssueWorktreeMergeCommand {
  confirmMessages: string[] = [];

  constructor(private readonly confirmed: boolean) {
    super();
  }

  protected override async askUserConfirmation(message: string): Promise<boolean> {
    this.confirmMessages.push(message);
    return this.confirmed;
  }
}

describe("IssueWorktreeMergeCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    gitService = bundle.gitService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    fileService.exists.mockResolvedValue(true);
    shellService.which.mockResolvedValue("/usr/bin/git");
    shellService.runAndWait.mockReturnValue({ status: 0 });
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    gitService.getCurrentBranchLabel.mockResolvedValue("develop");
    gitService.getGitFolderHeadObjectId.mockResolvedValue("develop");
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();

    ShellService.setInstance(shellService as unknown as ShellService);
    GitService.setInstance(gitService as unknown as GitService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    useGlobalConfigStore.setState({ globalConfig: {} });
  });

  afterEach(() => {
    ShellService.setInstance(null);
    GitService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = (confirmed = true) =>
    new TestIssueWorktreeMergeCommand(confirmed);

  const wtPath = (issueId: string) =>
    path.join(mockRepo.projectPath, ".claude/worktrees", issueId);

  it("rejects --json with interactive (no-force) mode at preprocessArgument", () => {
    const cmd = buildCommand();
    expect(() =>
      cmd.preprocessArgument("issue worktree merge", {
        debug: false,
        json: true,
        interactive: true,
      }),
    ).toThrow('Command "issue worktree merge" does not support --json');
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("does not call findIssue for base operand token", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI099-mergeDst", "MI099"),
    ]);

    await buildCommand().command("base", "MI099", { force: true });

    expect(issueFinderService.find).toHaveBeenCalledTimes(1);
    expect(issueFinderService.find).toHaveBeenCalledWith("MI099", {});
    expect(gitService.getGitFolderHeadObjectId).toHaveBeenCalledWith(
      mockRepo.projectPath,
    );
  });

  it("confirmation prompt uses cd && git merge shell line", async () => {
    const srcFolder = "MI018-src";
    const dstFolder = "MI019-dst";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI018")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI019")]);

    const cmd = buildCommand(true);
    const result = await cmd.command("MI018", "MI019", { force: false });

    const expectedLine = WorktreeHelper.formatWorktreeGitShellCommand(wtPath(srcFolder), [
      "merge",
      dstFolder,
    ]);
    expect(cmd.confirmMessages).toEqual([`${expectedLine}?`]);
    expect(result?.status).toBe("ok");
    expect(result?.result?.command).toBe(expectedLine);
  });

  it("merges dst branch at src issue worktree cwd", async () => {
    const srcFolder = "MI010-src-feature";
    const dstFolder = "MI011-dst-feature";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI010")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI011")]);

    const result = await buildCommand().command("MI010", "MI011", {
      force: true,
    });

    expect(result?.status).toBe("ok");
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", dstFolder],
      { cwd: wtPath(srcFolder) },
    );
  });

  it("merge base <- issue uses repo root cwd and issue branch name", async () => {
    const dstFolder = "MI012-other";
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder(dstFolder, "MI012"),
    ]);

    await buildCommand().command("base", "MI012", { force: true });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", dstFolder],
      { cwd: mockRepo.projectPath },
    );
    expect(gitService.getGitFolderHeadObjectId).toHaveBeenCalledWith(
      mockRepo.projectPath,
    );
  });

  it("returns undefined when confirmation is rejected", async () => {
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder("MI014-a")])
      .mockResolvedValueOnce([buildIssueFolder("MI014-b")]);

    await expect(buildCommand(false).command("MI014", "014")).resolves.toBeUndefined();
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("throws when issue worktree path does not exist", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI015-missing-wt"),
    ]);
    fileService.exists.mockImplementation(async (p: string) => {
      if (p.endsWith("/.git") || p.endsWith("\\.git")) {
        return true;
      }
      return !p.includes("MI015-missing-wt");
    });

    await expect(
      buildCommand().command("MI015", "base", { force: true }),
    ).rejects.toThrow(/Issue worktree does not exist/);
  });

  it("throws when src and dst resolve to same checkout and branch", async () => {
    const folder = "MI016-same";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(folder)])
      .mockResolvedValueOnce([buildIssueFolder(folder)]);

    await expect(
      buildCommand().command("MI016", "MI016", { force: true }),
    ).rejects.toThrow(/same checkout and branch/);
    expect(shellService.runAndWait).not.toHaveBeenCalled();
  });

  it("throws when git merge exits non-zero", async () => {
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder("MI017-a")])
      .mockResolvedValueOnce([buildIssueFolder("MI017-b")]);
    shellService.runAndWait.mockReturnValue({ status: 1 });

    await expect(buildCommand().command("MI017", "017", { force: true })).rejects.toThrow(
      /git merge failed/,
    );
  });

  it("shell one-liner escapes single quotes in cwd", () => {
    const cwd = `/tmp/foo'bar`;
    expect(WorktreeHelper.posixShellSingleQuotedDir(cwd)).toBe(`'/tmp/foo'\\''bar'`);
    expect(WorktreeHelper.formatWorktreeGitShellCommand(cwd, ["merge", "main"])).toBe(
      `cd '/tmp/foo'\\''bar' && git merge main`,
    );
  });

  it("passes --ff-only when ffOnly option is true", async () => {
    const srcFolder = "MI020-ff-src";
    const dstFolder = "MI021-ff-dst";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI020")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI021")]);

    await buildCommand().command("MI020", "MI021", {
      force: true,
      ffOnly: true,
    });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", "--ff-only", dstFolder],
      { cwd: wtPath(srcFolder) },
    );
  });

  it("adds --ff-only by default when tracker config worktree_git_ff_only_enabled is true", async () => {
    const srcFolder = "MI022-tracker-src";
    const dstFolder = "MI023-tracker-dst";
    const repoWithFfOnly: TrackerRepo = {
      ...mockRepo,
      config: { ...mockRepo.config, worktree_git_ff_only_enabled: true },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithFfOnly);
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI022")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI023")]);

    await buildCommand().command("MI022", "MI023", { force: true });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", "--ff-only", dstFolder],
      { cwd: path.join(repoWithFfOnly.projectPath, ".claude/worktrees", srcFolder) },
    );
  });

  it("adds --ff-only by default when global config worktree_git_ff_only_enabled is true", async () => {
    const srcFolder = "MI024-global-src";
    const dstFolder = "MI025-global-dst";
    useGlobalConfigStore.setState({
      globalConfig: { worktree_git_ff_only_enabled: true },
    });
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI024")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI025")]);

    await buildCommand().command("MI024", "MI025", { force: true });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", "--ff-only", dstFolder],
      { cwd: wtPath(srcFolder) },
    );
  });

  it("ffOnly: false overrides tracker config and omits --ff-only", async () => {
    const srcFolder = "MI026-override-src";
    const dstFolder = "MI027-override-dst";
    const repoWithFfOnly: TrackerRepo = {
      ...mockRepo,
      config: { ...mockRepo.config, worktree_git_ff_only_enabled: true },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithFfOnly);
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI026")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI027")]);

    await buildCommand().command("MI026", "MI027", {
      force: true,
      ffOnly: false,
    });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", dstFolder],
      { cwd: path.join(repoWithFfOnly.projectPath, ".claude/worktrees", srcFolder) },
    );
  });

  it("tracker config takes precedence over global config", async () => {
    const srcFolder = "MI028-prec-src";
    const dstFolder = "MI029-prec-dst";
    const repoWithFfOnlyOff: TrackerRepo = {
      ...mockRepo,
      config: { ...mockRepo.config, worktree_git_ff_only_enabled: false },
    };
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(repoWithFfOnlyOff);
    useGlobalConfigStore.setState({
      globalConfig: { worktree_git_ff_only_enabled: true },
    });
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI028")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI029")]);

    await buildCommand().command("MI028", "MI029", { force: true });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "git",
      ["merge", dstFolder],
      { cwd: path.join(repoWithFfOnlyOff.projectPath, ".claude/worktrees", srcFolder) },
    );
  });

  it("confirmation prompt shell line includes --ff-only when active", async () => {
    const srcFolder = "MI030-prompt-src";
    const dstFolder = "MI031-prompt-dst";
    issueFinderService.find
      .mockResolvedValueOnce([buildIssueFolder(srcFolder, "MI030")])
      .mockResolvedValueOnce([buildIssueFolder(dstFolder, "MI031")]);

    const cmd = buildCommand(true);
    const result = await cmd.command("MI030", "MI031", {
      force: false,
      ffOnly: true,
    });

    const expectedLine = WorktreeHelper.formatWorktreeGitShellCommand(wtPath(srcFolder), [
      "merge",
      "--ff-only",
      dstFolder,
    ]);
    expect(cmd.confirmMessages).toEqual([`${expectedLine}?`]);
    expect(result?.result?.command).toBe(expectedLine);
  });
});
