import { jest } from "@jest/globals";
import * as path from "path";
import { IssueLocateCommand } from "../../src/commands/IssueLocateCommand.ts";
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
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const mudissueWorktreePath = path.join(
  mockRepo.projectPath,
  ".claude",
  "worktrees",
  "MI0100-mudissue",
);

describe("IssueLocateCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    shellService = bundle.shellService;
    gitService = bundle.gitService;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);

    jest.clearAllMocks();

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
    ]);
  });

  const buildCommand = () =>
    new IssueLocateCommand();

  it("returns ISSUE_NOT_FOUND when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("returns paths when multiple issues match", async () => {
    const path1 = "/repo/issues/0001-rename/issue.md";
    const path2 = "/repo/issues/0001-other/issue.md";
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    fileService.exists.mockImplementation((path: string) =>
      Promise.resolve(path === path1 || path === path2),
    );

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result).toEqual({
      status: "ok",
      result: { paths: [path1, path2] },
    });
    expect(loggerService.info).toHaveBeenCalledWith(path1);
    expect(loggerService.info).toHaveBeenCalledWith(path2);
  });

  it("returns LOCATE_ISSUE_NO_ISSUE_FILE when findIssueFile returns undefined", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001"),
    ]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result?.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "LOCATE_ISSUE_NO_ISSUE_FILE",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("returns paths and logs path when issue file is found", async () => {
    const folder = buildIssueFolder("0001-edit-cmd");
    issueFinderService.find.mockResolvedValue([folder]);

    const issueFilePath = "/repo/issues/0001-edit-cmd/issue.md";
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result?.status).toBe("ok");
    expect((result as { result: { paths: string[] } }).result.paths).toEqual([
      issueFilePath,
    ]);
    expect(loggerService.info).toHaveBeenCalledWith(issueFilePath);
  });

  it("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      null,
    );

    const command = buildCommand();
    await expect(command.command("07", "123")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("123"),
        details: { project: "123" },
      },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  it("calls find with project option when project is passed and repo exists", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      mockRepo,
    );
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(
      command.command("0001", "proj-a"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("0001", {
      project: "proj-a",
    });
  });

  it("resolves current from the cwd mudissue worktree and returns the path", async () => {
    const folder = buildIssueFolder("MI0100-mudissue", "MI0100");
    const issueFilePath = "/repo/issues/MI0100-mudissue/issue.md";
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([folder]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    const command = buildCommand();
    const result = await command.command("current");

    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue");
    expect(result).toEqual({
      status: "ok",
      result: { paths: [issueFilePath] },
    });
    expect(loggerService.info).toHaveBeenCalledWith(issueFilePath);
  });
});
