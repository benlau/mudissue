import * as path from "path";
import { jest } from "@jest/globals";
import { IssueGetPropertyCommand } from "../../src/commands/IssueGetPropertyCommand.ts";
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

describe("IssueGetPropertyCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];
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
    loggerService = bundle.loggerService;
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

    const command = new IssueGetPropertyCommand();

    await expect(command.command("0001", "status")).rejects.toMatchObject({
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

    const command = new IssueGetPropertyCommand();

    await expect(command.command("0001", "status")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when property key is invalid", async () => {
    const command = new IssueGetPropertyCommand();

    const result = await command.command("0001", "invalid key");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "SET_ISSUE_INVALID_PROPERTY",
    );
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when no issue file found", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("0001")]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = new IssueGetPropertyCommand();

    const result = await command.command("0001", "status");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "ISSUE_MD_MISSING",
    );
  });

  test("returns ErrorResponse when property is missing in frontmatter", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);

    const command = new IssueGetPropertyCommand();

    const result = await command.command("0001", "status");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "GET_ISSUE_PROPERTY_NOT_FOUND",
    );
    const expectedPath = path.join("/dummy", "0001-rename", "issue.md");
    expect(
      (result as { error: { details: { issueFilePath: string } } }).error.details
        .issueFilePath,
    ).toBe(expectedPath);
  });

  test("returns SuccessResponse and logs scalar property value", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
status: open
---
# Body
`);

    const command = new IssueGetPropertyCommand();

    const result = await command.command("0001", "status");

    const expectedPath = path.join("/dummy", "0001-rename", "issue.md");
    expect(result.status).toBe("ok");
    expect(result.result.issueFilePath).toBe(expectedPath);
    expect(result.result.property).toBe("status");
    expect(result.result.value).toBe("open");
    expect(loggerService.info).toHaveBeenCalledWith("open");
  });

  test("returns SuccessResponse and logs array property as JSON", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
tags:
  - bug
  - urgent
---
# Body
`);

    const command = new IssueGetPropertyCommand();

    const result = await command.command("0001", "tags");

    const expectedPath = path.join("/dummy", "0001-rename", "issue.md");
    expect(result.status).toBe("ok");
    expect(result.result.issueFilePath).toBe(expectedPath);
    expect(result.result.value).toEqual(["bug", "urgent"]);
    expect(loggerService.info).toHaveBeenCalledWith(
      JSON.stringify(["bug", "urgent"]),
    );
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    const command = new IssueGetPropertyCommand();

    await expect(command.command("07", "status", "123")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        details: { project: "123" },
      },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  test("calls find with project option when project is passed and repo exists", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    issueFinderService.find.mockResolvedValue([]);

    const command = new IssueGetPropertyCommand();

    await expect(
      command.command("0001", "status", "proj-a"),
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
