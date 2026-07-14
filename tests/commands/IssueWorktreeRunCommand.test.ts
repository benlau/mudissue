import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeRunCommand } from "../../src/commands/IssueWorktreeRunCommand.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

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

const getWorktreePath = (issueId: string) =>
  path.join(mockRepo.projectPath, ".claude/worktrees", issueId);

describe("IssueWorktreeRunCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let originalShell: string | undefined;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    shellService = bundle.shellService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    originalShell = process.env.SHELL;
    process.env.SHELL = "/bin/test-shell";

    fileService.exists.mockResolvedValue(true);
    shellService.which.mockImplementation((name: string) =>
      Promise.resolve(name === "git" ? "/usr/bin/git" : "/usr/bin/tmux"),
    );
    shellService.runAndWait.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "show-ref") {
        return { status: 1 };
      }
      return { status: 0 };
    });
    shellService.runShellAndWait.mockReturnValue({ status: 0 });
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
    if (originalShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = originalShell;
    }
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = () => new IssueWorktreeRunCommand();

  it("creates a missing worktree before running the command in tmux", async () => {
    const folderName = "MI0042-feature";
    const worktreePath = getWorktreePath(folderName);
    let worktreeExists = false;
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(
        p === path.join(mockRepo.projectPath, ".git") || p === worktreePath
          ? worktreeExists || p === path.join(mockRepo.projectPath, ".git")
          : false,
      ),
    );
    shellService.runAndWait.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "show-ref") {
        return { status: 1 };
      }
      if (command === "git" && args[0] === "worktree") {
        worktreeExists = true;
        return { status: 0 };
      }
      return { status: 0 };
    });

    const result = await buildCommand().command("MI0042", {
      command: "npm test -- --watch",
    });

    expect(result).toEqual({
      status: "ok",
      result: {},
    });
    expect(shellService.runAndWait).toHaveBeenNthCalledWith(
      1,
      "git",
      ["show-ref", "--verify", "--quiet", "refs/heads/MI0042-feature"],
      { cwd: "/repo" },
    );
    expect(shellService.runAndWait).toHaveBeenNthCalledWith(
      2,
      "git",
      ["worktree", "add", "-b", "MI0042-feature", worktreePath],
      { cwd: "/repo" },
    );
    expect(shellService.runAndWait).toHaveBeenNthCalledWith(
      3,
      "/usr/bin/tmux",
      [
        "new-session",
        "-A",
        "-s",
        "MI0042-feature-npmtest-watch",
        "npm test -- --watch",
      ],
      { cwd: "/repo/.claude/worktrees/MI0042-feature" },
    );
  });

  it("reuses an existing worktree", async () => {
    const folderName = "MI0043-existing";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(
        p === path.join(mockRepo.projectPath, ".git") || p === getWorktreePath(folderName),
      ),
    );

    const result = await buildCommand().command("MI0043", {
      command: "npm run lint",
    });

    expect(result).toEqual({
      status: "ok",
      result: {},
    });
    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/tmux",
      ["new-session", "-A", "-s", "MI0043-existing-npmrunlint", "npm run lint"],
      { cwd: "/repo/.claude/worktrees/MI0043-existing" },
    );
    expect(shellService.runAndWait).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["add"]),
      expect.any(Object),
    );
  });

  it("uses project lookup when project is passed", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    issueFinderService.find.mockResolvedValue([buildIssueFolder("MI0044-project")]);

    await buildCommand().command("MI0044", {
      project: "proj-a",
      command: "npm test",
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith("proj-a");
    expect(issueFinderService.find).toHaveBeenCalledWith("MI0044", {
      project: "proj-a",
    });
  });

  it("falls back to direct shell execution when tmux is unavailable", async () => {
    const folderName = "MI0045-direct";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    shellService.which.mockImplementation((name: string) =>
      Promise.resolve(name === "git" ? "/usr/bin/git" : null),
    );

    const result = await buildCommand().command("MI0045", {
      command: "npm run build",
    });

    expect(result).toEqual({
      status: "ok",
      result: {},
    });
    expect(shellService.runShellAndWait).toHaveBeenCalledWith("npm run build", {
      cwd: "/repo/.claude/worktrees/MI0045-direct",
    });
  });

  it("launches the default shell when no command is provided", async () => {
    const folderName = "MI0046-shell";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    shellService.which.mockImplementation((name: string) =>
      Promise.resolve(name === "git" ? "/usr/bin/git" : null),
    );

    const result = await buildCommand().command("MI0046");

    expect(result).toEqual({
      status: "ok",
      result: {},
    });
    expect(shellService.runShellAndWait).toHaveBeenCalledWith("/bin/test-shell", {
      cwd: "/repo/.claude/worktrees/MI0046-shell",
    });
  });

  it("runCommand writes JSON with an empty result object when outputJson is true", async () => {
    const folderName = "MI0048-json";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(
        p === path.join(mockRepo.projectPath, ".git") || p === getWorktreePath(folderName),
      ),
    );
    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const result = await buildCommand().runCommand({ outputJson: true }, "MI0048", {
        command: "echo ok",
      });
      expect(result).toEqual({ status: "ok", result: {} });
      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({ status: "ok", result: {} }),
      );
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("propagates git worktree add failures", async () => {
    const folderName = "MI0047-failure";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === path.join(mockRepo.projectPath, ".git")),
    );
    shellService.runAndWait.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "show-ref") {
        return { status: 1 };
      }
      return { status: 2 };
    });

    await expect(
      buildCommand().command("MI0047", { command: "npm test" }),
    ).rejects.toThrow(/git worktree add failed.*exit code 2/);
    expect(shellService.runShellAndWait).not.toHaveBeenCalled();
  });
});
