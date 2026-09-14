import { jest } from "@jest/globals";
import { ChangeIssueIdHelper } from "../../src/helpers/ChangeIssueIdHelper.ts";
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

const issueMdFixture = "---\ntitle: Summary\n---\n\nBody\n";

describe("ChangeIssueIdHelper.changeIssueId", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let registryService: ReturnType<typeof createMockSystemContext>["registryService"];
  let helper: ChangeIssueIdHelper;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;
    registryService = bundle.registryService;
    helper = new ChangeIssueIdHelper();

    fileService.readdir.mockResolvedValue([] as any);
    fileService.rename.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(issueMdFixture);
    fileService.writeFile.mockResolvedValue(undefined);
    fileService.exists.mockResolvedValue(false);
    registryService.getPinnedIssueFolderNames.mockResolvedValue([]);
    registryService.setPinnedIssueFolderNames.mockResolvedValue(undefined);
  });

  it("throws CHANGE_ISSUE_ID_INVALID for empty new id", async () => {
    const issue = buildIssueFolder("43-summary", "43");

    await expect(
      helper.changeIssueId(mockRepo, issue, "   "),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_ID_INVALID" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_ID_INVALID for invalid new id", async () => {
    const issue = buildIssueFolder("43-summary", "43");

    await expect(
      helper.changeIssueId(mockRepo, issue, "no-digits"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_ID_INVALID" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_ID_UNCHANGED when new id matches current id", async () => {
    const issue = buildIssueFolder("43-summary", "43");

    await expect(
      helper.changeIssueId(mockRepo, issue, "43"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_ID_UNCHANGED" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_ID_TARGET_EXISTS when another folder matches new id", async () => {
    const issue = buildIssueFolder("43-summary", "43");
    const other = buildIssueFolder("PR45-other", "PR45");
    (trackerRepoStore.findIssue as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(
          selector === "PR45" ? [other] : selector === "43" ? [issue] : [],
        ),
    );

    await expect(
      helper.changeIssueId(mockRepo, issue, "PR45"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_ID_TARGET_EXISTS" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_ID_TARGET_EXISTS when target folder path exists", async () => {
    const issue = buildIssueFolder("43-summary", "43");
    (trackerRepoStore.findIssue as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "43" ? [issue] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/PR45-summary"),
    );

    await expect(
      helper.changeIssueId(mockRepo, issue, "PR45"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_ID_TARGET_EXISTS" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("renames folder and issue file and returns old and new issue folder names", async () => {
    const issue = buildIssueFolder("43-summary", "43");
    (trackerRepoStore.findIssue as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "43" ? [issue] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/43-summary/43-summary.md"),
    );

    const result = await helper.changeIssueId(mockRepo, issue, "PR45");

    expect(result).toEqual({
      oldIssueFolderName: "43-summary",
      newIssueFolderName: "PR45-summary",
    });
    expect(fileService.rename).toHaveBeenCalledTimes(2);
    expect(fileService.rename).toHaveBeenNthCalledWith(
      1,
      "/repo/issues/43-summary",
      "/repo/issues/PR45-summary",
    );
    expect(fileService.rename).toHaveBeenNthCalledWith(
      2,
      "/repo/issues/PR45-summary/43-summary.md",
      "/repo/issues/PR45-summary/PR45-summary.md",
    );
  });

  it("renames issue file to new issue id when issue_file_pattern is short", async () => {
    const issue = buildIssueFolder("MI0297-summary", "MI0297");
    const repoWithShort: TrackerRepo = {
      ...mockRepo,
      config: { issue_path: "issues", issue_file_pattern: "short" },
    };
    (trackerRepoStore.findIssue as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "MI0297" ? [issue] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/MI0297-summary/MI0297.md"),
    );

    const result = await helper.changeIssueId(repoWithShort, issue, "300");

    expect(result).toEqual({
      oldIssueFolderName: "MI0297-summary",
      newIssueFolderName: "300-summary",
    });
    expect(fileService.rename).toHaveBeenCalledTimes(2);
    expect(fileService.rename).toHaveBeenNthCalledWith(
      1,
      "/repo/issues/MI0297-summary",
      "/repo/issues/300-summary",
    );
    expect(fileService.rename).toHaveBeenNthCalledWith(
      2,
      "/repo/issues/300-summary/MI0297.md",
      "/repo/issues/300-summary/300.md",
    );
  });

  it("updates pinned registry entry when folder was pinned", async () => {
    const issue = buildIssueFolder("43-summary", "43");
    (trackerRepoStore.findIssue as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "43" ? [issue] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/43-summary/43-summary.md"),
    );
    registryService.getPinnedIssueFolderNames.mockResolvedValue([
      "43-summary",
      "0001-other",
    ]);

    await helper.changeIssueId(mockRepo, issue, "PR45");

    expect(registryService.setPinnedIssueFolderNames).toHaveBeenCalledWith(
      ["PR45-summary", "0001-other"],
      "/repo",
    );
  });
});
