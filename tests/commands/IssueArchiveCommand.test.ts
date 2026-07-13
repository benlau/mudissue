import { jest } from "@jest/globals";
import { IssueArchiveCommand } from "../../src/commands/IssueArchiveCommand.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (
  folderName: string,
  issueId?: string,
): IssueFolder => ({
  issueId: issueId ?? folderName,
  folderName,
  path: `/repo/issues/${folderName}`,
});

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueArchiveCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.mkdir.mockResolvedValue(undefined);
    fileService.rename.mockResolvedValue(undefined);
  });

  const buildCommand = () => new IssueArchiveCommand();

  it("returns ISSUE_NOT_FOUND when 0 matches", async () => {
    trackerRepoStore.findIssue.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(fileService.mkdir).not.toHaveBeenCalled();
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("returns ISSUE_MULTI_MATCHED when more than one match", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-a", "0001"),
      buildIssueFolder("0001-b", "0001"),
    ];
    trackerRepoStore.findIssue.mockResolvedValue(folders);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(fileService.mkdir).not.toHaveBeenCalled();
  });

  it("creates .archive, then renames the issue folder into it", async () => {
    const folder = buildIssueFolder("0042-done", "0042");
    trackerRepoStore.findIssue.mockResolvedValue([folder]);
    fileService.exists.mockResolvedValue(false);
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0042-done/issue.md");

    const command = buildCommand();
    const result = await command.command("0042");

    expect(result).toMatchObject({
      status: "ok",
      result: {
        archivedIssue: {
          issueId: "0042",
          issueFolderName: "0042-done",
          issueFilePath: "/repo/issues/.archive/0042-done/issue.md",
        },
        oldIssueFolderPath: folder.path,
        newIssueFolderPath: "/repo/issues/.archive/0042-done",
      },
    });
    expect(fileService.mkdir).toHaveBeenCalledWith("/repo/issues/.archive", {
      recursive: true,
    });
    expect(fileService.rename).toHaveBeenCalledWith(
      folder.path,
      "/repo/issues/.archive/0042-done",
    );
  });

  it("returns ARCHIVE_TARGET_EXISTS when destination already exists", async () => {
    const folder = buildIssueFolder("0042-dup");
    trackerRepoStore.findIssue.mockResolvedValue([folder]);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    await expect(command.command("0042")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "ARCHIVE_TARGET_EXISTS",
        details: { path: "/repo/issues/.archive/0042-dup" },
      },
    });
    expect(fileService.mkdir).toHaveBeenCalledWith("/repo/issues/.archive", {
      recursive: true,
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });
});
