import { jest } from "@jest/globals";
import * as path from "path";
import { IssueSelectorArgumentHelper } from "../../src/helpers/IssueSelectorArgumentHelper.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { isErrorResponse } from "../../src/types/Response.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

const otherRepo: TrackerRepo = {
  name: "other",
  projectPath: path.join(path.sep, "other-repo"),
  trackerPath: path.join(path.sep, "other-repo"),
  config: { issue_path: "issues" },
};

import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

const buildIssueFolder = (folderName: string): IssueFolder =>
  buildIssueFolderFixture("MI100", {
    folderName,
    path: path.join(mockRepo.projectPath, "issues", folderName),
    title: "t",
    status: "open",
  });

describe("IssueSelectorArgumentHelper.processIssueSelectorArgument", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-mudissue"),
    ]);

    jest.clearAllMocks();
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-mudissue"),
    ]);
  });

  it("returns current repo and issue when project is omitted", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result = await IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100-mudissue");

    expect(result).toEqual({ repo: mockRepo, issue });
    expect(trackerRepoStore.getCurrentTrackerRepo).toHaveBeenCalled();
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue", {
      project: undefined,
    });
    expect(trackerRepoStore.getTrackerRepoByProjectName).not.toHaveBeenCalled();
  });

  it("returns project repo and issue when project is given", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(otherRepo);
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result = await IssueSelectorArgumentHelper.processIssueSelectorArgument(
      "MI0100-mudissue",
      "other",
    );

    expect(result).toEqual({ repo: otherRepo, issue });
    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "other",
    );
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue", {
      project: "other",
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  it("throws ISSUE_NOT_FOUND when findIssue returns no matches", async () => {
    trackerRepoStore.findIssue.mockResolvedValue([]);

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100-mudissue"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws ISSUE_MULTI_MATCHED when findIssue returns multiple matches", async () => {
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-a"),
      buildIssueFolder("MI0100-b"),
    ]);

    try {
      await IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100");
    } catch (err) {
      expect(isErrorResponse(err)).toBe(true);
      if (isErrorResponse(err)) {
        expect(err.error.code).toBe("ISSUE_MULTI_MATCHED");
      }
      return;
    }
    throw new Error("expected rejection");
  });

  it("throws PROJECT_NOT_FOUND when project does not exist", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100-mudissue", "missing"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  it("throws ISSUE_NOT_FOUND when repo is still missing after fallback", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      undefined as unknown as TrackerRepo,
    );

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100-mudissue"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });
});
