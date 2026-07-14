import { jest } from "@jest/globals";
import * as path from "path";
import { IssueSelectorArgumentHelper } from "../../src/helpers/IssueSelectorArgumentHelper.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

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

const buildIssueFolder = (issueId: string): IssueFolder =>
  buildIssueFolderFixture(issueId, {
    path: path.join(mockRepo.projectPath, "issues", issueId),
    title: "t",
    status: "open",
  });

const mudissueWorktreePath = path.join(
  mockRepo.projectPath,
  ".claude",
  "worktrees",
  "MI0100-mudissue",
);

describe("IssueSelectorArgumentHelper.processIssueSelectorArgument", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    shellService = bundle.shellService;
    gitService = bundle.gitService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-mudissue"),
    ]);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
    ]);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-mudissue"),
    ]);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
    ]);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  it("returns current repo and issue when project is omitted", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
        "MI0100-mudissue",
      );

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

    const result =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument(
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

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument("MI0100"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
  });

  it("throws PROJECT_NOT_FOUND when project does not exist", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument(
        "MI0100-mudissue",
        "missing",
      ),
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

  it("resolves current when cwd is inside a mudissue worktree", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result =
      await IssueSelectorArgumentHelper.processIssueSelectorArgument("current");

    expect(result).toEqual({ repo: mockRepo, issue });
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue");
  });

  it("throws CURRENT_ISSUE_REQUIRES_WORKTREE for current outside a worktree", async () => {
    shellService.cwd.mockReturnValue(path.join(mockRepo.projectPath, "src"));

    await expect(
      IssueSelectorArgumentHelper.processIssueSelectorArgument("current"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "CURRENT_ISSUE_REQUIRES_WORKTREE" },
    });
  });
});
