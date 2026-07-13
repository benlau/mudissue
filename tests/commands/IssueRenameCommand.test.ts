import { jest } from "@jest/globals";
import { IssueRenameCommand } from "../../src/commands/IssueRenameCommand.ts";
import type { IssueRenameCommandSuccessResult } from "../../src/types/Response.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (folderName: string, issueId?: string): IssueFolder => ({
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

const issueMdFixture = "---\ntitle: Old title\n---\n\nBody\n";

describe("IssueRenameCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    fileService.readdir.mockResolvedValue([] as any);
    fileService.rename.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(issueMdFixture);
    fileService.writeFile.mockResolvedValue(undefined);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    jest.clearAllMocks();

    fileService.readdir.mockResolvedValue([] as any);
    fileService.rename.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(issueMdFixture);
    fileService.writeFile.mockResolvedValue(undefined);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  const buildCommand = () => new IssueRenameCommand();

  it("throws ISSUE_NOT_FOUND when 0 matches", async () => {
    (issueFinderService.find as jest.Mock).mockResolvedValue([]);

    const command = buildCommand();
    await expect(
      command.command("0001", "New Suffix"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws ISSUE_MULTI_MATCHED when more than one match", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    (issueFinderService.find as jest.Mock).mockResolvedValue(folders);

    const command = buildCommand();
    await expect(
      command.command("0001", "New Suffix"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws RENAME_ISSUE_INVALID_TITLE when title is empty (validates before find)", async () => {
    const command = buildCommand();
    await expect(command.command("0001", "")).rejects.toMatchObject({
      status: "error",
      error: { code: "RENAME_ISSUE_INVALID_TITLE" },
    });
    await expect(command.command("0001", "   ")).rejects.toMatchObject({
      status: "error",
      error: { code: "RENAME_ISSUE_INVALID_TITLE" },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws RENAME_ISSUE_TARGET_EXISTS when target folder exists", async () => {
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(
          selector === "0001"
            ? [buildIssueFolder("0001-old", "0001")]
            : [],
        ),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-new-suffix"),
    );

    const command = buildCommand();
    await expect(
      command.command("0001", "New Suffix"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "RENAME_ISSUE_TARGET_EXISTS" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws RENAME_ISSUE_TARGET_EXISTS when another folder matches the same issue id", async () => {
    const current = buildIssueFolder("0001-old", "0001");
    const other: IssueFolder = {
      ...buildIssueFolder("0001-other", "0001"),
      path: "/repo/issues/0001-other",
    };
    let findCall = 0;
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) => {
        if (selector !== "0001") {
          return Promise.resolve([]);
        }
        findCall += 1;
        if (findCall === 1) {
          return Promise.resolve([current]);
        }
        return Promise.resolve([current, other]);
      },
    );

    const command = buildCommand();
    await expect(
      command.command("0001", "New Suffix"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "RENAME_ISSUE_TARGET_EXISTS" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("renames folder preserving issue id 0001 (not 001)", async () => {
    const folder = buildIssueFolder("0001-old", "0001");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(
          selector === "0001" ? [folder] : [],
        ),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-new-suffix/issue.md"),
    );

    const command = buildCommand();
    const result = await command.command("0001", "New Suffix");

    expect(result?.status).toBe("ok");
    expect(fileService.rename).toHaveBeenCalledWith(
      "/repo/issues/0001-old",
      "/repo/issues/0001-new-suffix",
    );
  });

  it("renames folder and returns success when target does not exist", async () => {
    const folder = buildIssueFolder("0001-old", "0001");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "0001" ? [folder] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-new-suffix/issue.md"),
    );

    const command = buildCommand();
    const result = await command.command("0001", "New Suffix");

    expect(result?.status).toBe("ok");
    expect((result as { result: IssueRenameCommandSuccessResult }).result).toEqual({
      oldIssueFolderName: "0001-old",
      newIssueFolderName: "0001-new-suffix",
    });
    expect(fileService.rename).toHaveBeenCalledWith(
      "/repo/issues/0001-old",
      "/repo/issues/0001-new-suffix",
    );
  });

  it("writes title to issue frontmatter after rename", async () => {
    const folder = buildIssueFolder("0001-old", "0001");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "0001" ? [folder] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-new-suffix/issue.md"),
    );

    const command = buildCommand();
    await command.command("0001", "New Suffix");

    expect(fileService.writeFile).toHaveBeenCalled();
    const writeCalls = (fileService.writeFile as jest.Mock).mock.calls;
    const lastWrite = writeCalls[writeCalls.length - 1];
    expect(lastWrite[0]).toBe(
      "/repo/issues/0001-new-suffix/0001-new-suffix.md",
    );
    expect(lastWrite[1]).toEqual(
      [
        "---",
        "title: New Suffix",
        "---",
        "",
        "Body",
        "",
      ].join("\n"),
    );
  });

  it("renames issue file to expected name when issue_file_pattern is long", async () => {
    const folder = buildIssueFolder("0001-old", "0001");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "0001" ? [folder] : []),
    );
    const repoWithLong: TrackerRepo = {
      ...mockRepo,
      config: { issue_path: "issues", issue_file_pattern: "long" },
    };
    (trackerRepoStore.getCurrentTrackerRepo as jest.Mock).mockResolvedValue(
      repoWithLong,
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-old/issue.md"),
    );

    const command = buildCommand();
    const result = await command.command("0001", "New Suffix");

    expect(result?.status).toBe("ok");
    expect(fileService.rename).toHaveBeenCalledTimes(2);
    expect(fileService.rename).toHaveBeenNthCalledWith(
      1,
      "/repo/issues/0001-old",
      "/repo/issues/0001-new-suffix",
    );
    expect(fileService.rename).toHaveBeenNthCalledWith(
      2,
      "/repo/issues/0001-new-suffix/issue.md",
      "/repo/issues/0001-new-suffix/0001-new-suffix.md",
    );
  });

  it("when new folder name equals current, skips folder rename but renames file when type is long", async () => {
    const folder = buildIssueFolder("0001-old", "0001");
    (issueFinderService.find as jest.Mock).mockResolvedValue([folder]);
    const repoWithLong: TrackerRepo = {
      ...mockRepo,
      config: { issue_path: "issues", issue_file_pattern: "long" },
    };
    (trackerRepoStore.getCurrentTrackerRepo as jest.Mock).mockResolvedValue(
      repoWithLong,
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-old/issue.md"),
    );

    const command = buildCommand();
    const result = await command.command("0001", "Old");

    expect(result?.status).toBe("ok");
    expect(fileService.rename).toHaveBeenCalledTimes(1);
    expect(fileService.rename).toHaveBeenCalledWith(
      "/repo/issues/0001-old/issue.md",
      "/repo/issues/0001-old/0001-old.md",
    );
  });

  it("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    (trackerRepoStore.getTrackerRepoByProjectName as jest.Mock).mockResolvedValue(
      null,
    );

    const command = buildCommand();
    await expect(
      command.command("0001", "New title", "nonexistent"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PROJECT_NOT_FOUND" },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  it("uses project repo when project is passed", async () => {
    const folder = buildIssueFolder("0001", "0001");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "0001" ? [folder] : []),
    );
    (trackerRepoStore.getTrackerRepoByProjectName as jest.Mock).mockResolvedValue(
      mockRepo,
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/0001-new-title/issue.md"),
    );

    const command = buildCommand();
    await command.command("0001", "New Title", "proj-a");

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("0001", {
      project: "proj-a",
    });
    expect(fileService.rename).toHaveBeenCalledWith(
      "/repo/issues/0001",
      "/repo/issues/0001-new-title",
    );
  });

  it("throws when no repo found (getCurrentTrackerRepo returns null)", async () => {
    (issueFinderService.find as jest.Mock).mockResolvedValue([
      buildIssueFolder("0001", "0001"),
    ]);
    (trackerRepoStore.getCurrentTrackerRepo as jest.Mock).mockResolvedValue(
      null,
    );

    const command = buildCommand();
    await expect(
      command.command("0001", "New title"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("preserves prefixed issue id when renaming by title", async () => {
    const repoWithPrefix: TrackerRepo = {
      ...mockRepo,
      config: { issue_path: "issues", issue_prefix: "pr" },
    };
    (trackerRepoStore.getCurrentTrackerRepo as jest.Mock).mockResolvedValue(
      repoWithPrefix,
    );
    const folder = buildIssueFolder("pr02-suffix", "pr02");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(
          selector === "pr02" || selector === "pr02-suffix"
            ? [folder]
            : [],
        ),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/pr02-new-title/issue.md"),
    );

    const command = buildCommand();
    const result = await command.command("pr02-suffix", "New Title");

    expect(result?.status).toBe("ok");
    expect((result as { result: IssueRenameCommandSuccessResult }).result).toMatchObject({
      oldIssueFolderName: "pr02-suffix",
      newIssueFolderName: "pr02-new-title",
    });
    expect(fileService.rename).toHaveBeenCalledWith(
      "/repo/issues/pr02-suffix",
      "/repo/issues/pr02-new-title",
    );
  });
});
