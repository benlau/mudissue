import { jest } from "@jest/globals";
import { IssueCatCommand } from "../../src/commands/IssueCatCommand.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (folderName: string, issueId?: string): IssueFolder => ({
  issueId: issueId ?? folderName,
  folderName,
  path: `/dummy/${folderName}`,
});

describe("IssueCatCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  const mockRepo: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  const issueMarkdown = `---
title: An issue
status: open
---
# Body
`;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    loggerService = bundle.loggerService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    jest.clearAllMocks();
  });

  test("returns ErrorResponse when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = new IssueCatCommand();

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when multiple matches", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);

    const command = new IssueCatCommand();

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when no issue file found", async () => {
    issueFinderService.find.mockResolvedValue([buildIssueFolder("0001")]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = new IssueCatCommand();

    const result = await command.command("0001");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "ISSUE_MD_MISSING",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when issue file is binary", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(true);

    const command = new IssueCatCommand();

    const result = await command.command("0001");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "SET_FILE_BINARY",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("returns SuccessResponse with file content and logs to stdout", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(issueMarkdown);

    const command = new IssueCatCommand();

    const result = await command.command("0001");

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({ content: issueMarkdown });
    expect(loggerService.info).toHaveBeenCalled();
  });

  test("runCommand writes JSON with content when outputJson is true", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(issueMarkdown);

    const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const command = new IssueCatCommand();
      command.preprocessArgument(command.name, {
        debug: false,
        json: true,
        interactive: false,
      });
      const result = await command.runCommand({ outputJson: true }, "0001");

      expect(result).toEqual({
        status: "ok",
        result: { content: issueMarkdown },
      });
      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({
          status: "ok",
          result: { content: issueMarkdown },
        }),
      );
      expect(loggerService.info).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    const command = new IssueCatCommand();

    await expect(command.command("07", "123")).rejects.toMatchObject({
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

    const command = new IssueCatCommand();

    await expect(command.command("0001", "proj-a")).rejects.toMatchObject({
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
