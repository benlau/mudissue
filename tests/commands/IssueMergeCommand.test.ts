import { jest } from "@jest/globals";
import { IssueMergeCommand } from "../../src/commands/IssueMergeCommand.ts";
import { IssueResource } from "../../src/utils/resources/IssueResource.ts";
import { IssueMergeSectionGenerator } from "../../src/utils/generators/IssueMergeSectionGenerator.ts";
import { NextIssueIdHelper } from "../../src/helpers/NextIssueIdHelper.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (
  folderName: string,
  issueId: string,
): IssueFolder => ({
  issueId,
  folderName,
  path: `/repo/issues/${folderName}`,
});

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueMergeCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.rename.mockResolvedValue(undefined);
    fileService.exists.mockResolvedValue(false);

    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("0003");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
      (absPath: string) => ({
        absPath,
        relativePath: absPath.replace("/repo/", ""),
      }),
    );
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockImplementation(async (folder: IssueFolder) =>
        `/repo/issues/${folder.folderName}/issue.md`,
      );
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultStatus")
      .mockReturnValue("open");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultPriority")
      .mockReturnValue("urgent");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssueFilePattern")
      .mockReturnValue("fixed");
  });

  afterEach(() => {
    LoggerService.setInstance(new LoggerService());
    jest.restoreAllMocks();
  });

  const buildCommand = () => new IssueMergeCommand();

  it("returns ISSUE_MERGE_DUPLICATE when the same issue is listed twice", async () => {
    const folder = buildIssueFolder("0001-alpha", "0001");
    trackerRepoStore.findIssue.mockResolvedValue([folder]);

    const command = buildCommand();
    await expect(
      command.command({
        issueSelectors: ["0001", "0001"],
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MERGE_DUPLICATE" },
    });
  });

  it("returns ISSUE_NOT_FOUND when a selector has no match", async () => {
    trackerRepoStore.findIssue.mockResolvedValue([]);

    const command = buildCommand();
    await expect(
      command.command({
        issueSelectors: ["0001", "0002"],
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("creates a merged issue, archives sources, and returns structured result", async () => {
    const sourceOne = buildIssueFolder("0001-alpha", "0001");
    const sourceTwo = buildIssueFolder("0002-beta", "0002");
    trackerRepoStore.findIssue
      .mockResolvedValueOnce([sourceOne])
      .mockResolvedValueOnce([sourceTwo]);

    jest
      .spyOn(IssueMergeSectionGenerator.prototype, "renderMergedContent")
      .mockResolvedValue("Merged body");
    jest
      .spyOn(IssueMergeSectionGenerator.prototype, "deriveTitle")
      .mockResolvedValue("Alpha issue");
    jest.spyOn(IssueResource.prototype, "create").mockResolvedValue({
      issueId: "0003",
      folderName: "0003-merged-title",
      path: "/repo/issues/0003-merged-title",
      title: "Merged title",
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValueOnce("/repo/issues/0001-alpha/issue.md")
      .mockResolvedValueOnce("/repo/issues/0002-beta/issue.md");

    const command = buildCommand();
    const result = await command.command({
      issueSelectors: ["0001", "0002"],
      title: "Merged title",
    });

    expect(result).toMatchObject({
      status: "ok",
      result: {
        createdIssue: {
          createdIssue: {
            issueId: "0003",
            issueFolderName: "0003-merged-title",
            issueFilePath: "/repo/issues/0003-merged-title/issue.md",
          },
        },
        archivedIssues: [
          {
            archivedIssue: {
              issueId: "0001",
              issueFolderName: "0001-alpha",
              issueFilePath: "/repo/issues/.archive/0001-alpha/issue.md",
            },
            oldIssueFolderPath: "/repo/issues/0001-alpha",
            newIssueFolderPath: "/repo/issues/.archive/0001-alpha",
          },
          {
            archivedIssue: {
              issueId: "0002",
              issueFolderName: "0002-beta",
              issueFilePath: "/repo/issues/.archive/0002-beta/issue.md",
            },
            oldIssueFolderPath: "/repo/issues/0002-beta",
            newIssueFolderPath: "/repo/issues/.archive/0002-beta",
          },
        ],
      },
    });

    expect(IssueResource.prototype.create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: "0003",
        folderName: "0003-merged-title",
      }),
      "/repo/issues/0003-merged-title/issue.md",
      "Merged title",
      undefined,
      "open",
      "urgent",
      "fixed",
      "Merged body",
    );
    expect(fileService.rename).toHaveBeenCalledTimes(2);
    expect(loggerService.info).toHaveBeenCalledTimes(3);
  });

  it("returns ARCHIVE_TARGET_EXISTS when an archive destination already exists", async () => {
    const sourceOne = buildIssueFolder("0001-alpha", "0001");
    const sourceTwo = buildIssueFolder("0002-beta", "0002");
    trackerRepoStore.findIssue
      .mockResolvedValueOnce([sourceOne])
      .mockResolvedValueOnce([sourceTwo]);

    jest
      .spyOn(IssueMergeSectionGenerator.prototype, "renderMergedContent")
      .mockResolvedValue("Merged body");
    jest.spyOn(IssueResource.prototype, "create").mockResolvedValue({
      issueId: "0003",
      folderName: "0003-merged-title",
      path: "/repo/issues/0003-merged-title",
    });

    fileService.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0001-alpha/issue.md");

    const command = buildCommand();
    await expect(
      command.command({
        issueSelectors: ["0001", "0002"],
        title: "Merged title",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "ARCHIVE_TARGET_EXISTS",
        details: { path: "/repo/issues/.archive/0002-beta" },
      },
    });
  });
});
