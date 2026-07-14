import { jest } from "@jest/globals";
import { IssueEditCommand } from "../../src/commands/IssueEditCommand.ts";
import { ShellService } from "../../src/services/ShellService.ts";
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

describe("IssueEditCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  const originalEnvEditor = process.env.MUDISSUE_EDITOR;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    shellService = bundle.shellService;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    process.env.MUDISSUE_EDITOR = "my-editor";
    shellService.run.mockImplementation(() => {});
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    ShellService.setInstance(shellService as unknown as ShellService);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    if (originalEnvEditor === undefined) {
      delete process.env.MUDISSUE_EDITOR;
    } else {
      process.env.MUDISSUE_EDITOR = originalEnvEditor;
    }
  });

  const buildCommand = () =>
    new IssueEditCommand();

  it("returns ISSUE_NOT_FOUND when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(shellService.run).not.toHaveBeenCalled();
  });

  it("returns ISSUE_MULTI_MATCHED when more than one match", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(shellService.run).not.toHaveBeenCalled();
  });

  it("returns EDIT_ISSUE_NO_ISSUE_FILE when findIssueFile returns undefined", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001"),
    ]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result?.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "EDIT_ISSUE_NO_ISSUE_FILE",
    );
    expect(shellService.run).not.toHaveBeenCalled();
  });

  it("calls shell to open resolved path and returns success with command", async () => {
    const folder = buildIssueFolder("0001-edit-cmd");
    issueFinderService.find.mockResolvedValue([folder]);

    const issueFilePath = "/repo/issues/0001-edit-cmd/issue.md";
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    const cmd = buildCommand();
    const result = await cmd.command("0001");

    expect(result?.status).toBe("ok");
    expect(shellService.run).toHaveBeenCalledWith("my-editor", [issueFilePath]);
    expect((result as { result: { openedFile: string; command: string } }).result)
      .toMatchObject({
        openedFile: issueFilePath,
        command: `my-editor ${issueFilePath}`,
      });
    expect(loggerService.info).toHaveBeenCalled();
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
});
