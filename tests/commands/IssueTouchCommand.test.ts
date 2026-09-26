import * as path from "path";
import { jest } from "@jest/globals";
import { IssueTouchCommand } from "../../src/commands/IssueTouchCommand.ts";
import { IssueFolderStorage } from "../../src/async/storage/IssueFolderStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (issueId: string, label?: string): IssueFolder => ({
  issueId,
  label: label ?? extractIssueLabel(issueId),
  path: `/dummy/${issueId}`,
});

const extractIssueLabel = (issueId: string): string => {
  const m = issueId.trim().match(/^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/);
  return m ? `${m[1]}${m[2]}` : issueId;
};

describe("IssueTouchCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];

  const mockRepo: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    shellService = bundle.shellService;

    shellService.cwd.mockReturnValue("/repo");
    shellService.relative.mockImplementation((from: string, to: string) =>
      path.relative(from, to),
    );

    jest.clearAllMocks();
  });

  test("returns ErrorResponse when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = new IssueTouchCommand();

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when multiple matches", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);

    const command = new IssueTouchCommand();

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when no issue file found", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("0001")]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = new IssueTouchCommand();

    const issueFilePath = path.join("/dummy", "0001", "issue.md");

    const result = await command.command("0001");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "ISSUE_MD_MISSING",
    );
    expect(
      (result as { error: { details: { path: string } } }).error.details.path,
    ).toBe("/dummy/0001");
    expect(fileService.exists).toHaveBeenCalledWith(issueFilePath);
  });

  test("returns SuccessResponse when exactly one match and file exists", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    const originalContent = `---
title: An issue
---
# Body
`;
    fileService.readFile.mockResolvedValue(originalContent);
    fileService.writeFile.mockResolvedValue(undefined);
    const touchUpdatedAtSpy = jest.spyOn(
      IssueFolderStorage.prototype,
      "touchUpdatedAt",
    );

    const command = new IssueTouchCommand();

    const result = await command.command("0001");

    expect(result.status).toBe("ok");
    expect(result.result.updatedAt).toEqual(expect.any(String));
    const expectedPath = path.join("/dummy", "0001-rename", "issue.md");
    expect(result.result.issueFilePath).toBe(expectedPath);
    expect(touchUpdatedAtSpy).toHaveBeenCalled();
    expect(fileService.writeFile).toHaveBeenCalledWith(
      expectedPath,
      expect.stringMatching(/updated_at:/),
    );
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    const command = new IssueTouchCommand();

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
});
