import { jest } from "@jest/globals";
import * as path from "path";
import { TmuxLauncher } from "../../../src/async/launchers/TmuxLauncher.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { FileService } from "../../../src/services/FileService.ts";
import { ShellService } from "../../../src/services/ShellService.ts";
import type { FileService as FileServiceType } from "../../../src/services/FileService.ts";
import type { ShellService as ShellServiceType } from "../../../src/services/ShellService.ts";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const buildIssueFolder = (issueId: string, label?: string): IssueFolder => ({
  issueId,
  label: label ?? extractIssueLabel(issueId),
  path: `/repo/issues/${issueId}`,
});
const extractIssueLabel = (issueId: string): string => {
  const m = issueId.trim().match(/^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/);
  return m ? `${m[1]}${m[2]}` : issueId;
};

describe("TmuxLauncher", () => {
  let launcher: TmuxLauncher;
  let fileService: jest.Mocked<Pick<FileServiceType, "exists">>;
  let shellService: jest.Mocked<Pick<ShellServiceType, "which" | "runAndWait">>;
  let savedFileService: FileServiceType;
  let savedShellService: ShellServiceType;

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    savedShellService = ShellService.getInstance();
    fileService = {
      exists: jest.fn(),
    } as jest.Mocked<Pick<FileServiceType, "exists">>;
    shellService = {
      which: jest.fn(),
      runAndWait: jest.fn().mockReturnValue({ status: 0 }),
    } as unknown as jest.Mocked<
      Pick<ShellServiceType, "which" | "runAndWait">
    >;
    launcher = new TmuxLauncher({
      fileService: fileService as FileServiceType,
      shellService: shellService as ShellServiceType,
    });
    FileService.setInstance(fileService as FileServiceType);
    ShellService.setInstance(shellService as ShellServiceType);
    shellService.which.mockResolvedValue("/usr/bin/tmux");
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
    ShellService.setInstance(savedShellService);
  });

  describe("getTmuxSessionName", () => {
    it("returns the sanitized folder name when command is not provided", () => {
      expect(launcher.getTmuxSessionName("  Tmux Title!  ")).toBe("Tmux-Title");
    });

    it("adds a sanitized command suffix to the folder name", () => {
      expect(launcher.getTmuxSessionName("MI0001-xxx-xxx", "/bin/sh")).toBe(
        "MI0001-xxx-xxx-/bin/sh",
      );
    });

    it("cleans unsafe command characters before appending the suffix", () => {
      expect(launcher.getTmuxSessionName("MI001", "npm run lint:fix")).toBe(
        "MI001-npmrunlint_fix",
      );
    });

    it("keeps non-English characters in the folder name and command suffix", () => {
      expect(launcher.getTmuxSessionName("修正 問題", "npm run 測試")).toBe(
        "修正-問題-npmrun測試",
      );
    });

    it("truncates the issue folder part to 20 characters", () => {
      expect(
        launcher.getTmuxSessionName("MI0001-very-long-issue-folder", "/bin/sh"),
      ).toBe("MI0001-very-long-iss-/bin/sh");
    });

    it("truncates the command suffix to 20 characters", () => {
      expect(
        launcher.getTmuxSessionName("MI001", "abcdefghijklmnopqrstuvwxyz"),
      ).toBe("MI001-abcdefghijklmnopqrst");
    });
  });

  it("returns TMUX_NOT_FOUND when tmux is not in PATH", async () => {
    shellService.which.mockResolvedValue(null);

    await expect(
      launcher.launch({
        issue: buildIssueFolder("MI001"),
        repo: mockRepo,
        worktreeAbs: "/repo/worktree/MI001",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "TMUX_NOT_FOUND" },
    });
  });

  it("uses the expected worktree directory as cwd when it exists", async () => {
    const folderName = "MI001";
    const worktreeAbs = path.join(
      mockRepo.projectPath,
      ".claude",
      "worktrees",
      folderName,
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === worktreeAbs),
    );

    await launcher.launch({
      issue: buildIssueFolder(folderName),
      repo: mockRepo,
      worktreeAbs,
      command: "npm test -- --watch",
    });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/tmux",
      ["new-session", "-A", "-s", "MI001-npmtest-watch", "npm test -- --watch"],
      { cwd: worktreeAbs },
    );
  });

  it("uses the issue folder absolute path as cwd when the worktree directory does not exist", async () => {
    const folderName = "MI002";
    const issueAbs = `/repo/issues/${folderName}`;
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p.endsWith("/issue.md")),
    );

    await launcher.launch({
      issue: buildIssueFolder(folderName),
      repo: mockRepo,
      worktreeAbs: "/repo/worktree/MI002",
    });

    expect(shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/tmux",
      ["new-session", "-A", "-s", expect.any(String)],
      { cwd: issueAbs },
    );
  });

  it("returns TMUX_EXIT_NONZERO when tmux exits with a nonzero status", async () => {
    fileService.exists.mockResolvedValue(false);
    shellService.runAndWait.mockReturnValue({ status: 2 });

    await expect(
      launcher.launch({
        issue: buildIssueFolder("MI001"),
        repo: mockRepo,
        worktreeAbs: "/repo/worktree/MI001",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "TMUX_EXIT_NONZERO", details: { exitCode: 2 } },
    });
  });
});
