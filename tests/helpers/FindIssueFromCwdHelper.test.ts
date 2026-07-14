import { jest } from "@jest/globals";
import * as path from "path";
import { FindIssueFromCwdHelper } from "../../src/helpers/FindIssueFromCwdHelper.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

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
const truncatedWorktreePath = path.join(
  mockRepo.projectPath,
  ".claude",
  "worktrees",
  "MI0100-duplicated-issue",
);

describe("FindIssueFromCwdHelper.findIssueFromCwd", () => {
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

    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
      truncatedWorktreePath,
      path.join(path.sep, "other", "0042-not-mudissue-layout"),
    ]);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  it("returns the issue when cwd is at a mudissue worktree root", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd();

    expect(result).toEqual(issue);
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith("MI0100-mudissue");
  });

  it("returns the issue when cwd is in a subdirectory of the worktree", async () => {
    const issue = buildIssueFolder("MI0100-mudissue");
    const subdir = path.join(mudissueWorktreePath, "src", "lib");
    shellService.cwd.mockReturnValue(subdir);
    trackerRepoStore.findIssue.mockResolvedValue([issue]);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd({ cwd: subdir });

    expect(result).toEqual(issue);
  });

  it("returns null when cwd is in the main repo checkout", async () => {
    shellService.cwd.mockReturnValue(path.join(mockRepo.projectPath, "src"));

    const result = await FindIssueFromCwdHelper.findIssueFromCwd({
      cwd: path.join(mockRepo.projectPath, "src"),
    });

    expect(result).toBeNull();
    expect(trackerRepoStore.findIssue).not.toHaveBeenCalled();
  });

  it("returns null when cwd is in a linked worktree that does not match getGitWorktreePath", async () => {
    const otherWorktree = path.join(path.sep, "other", "0042-not-mudissue-layout");
    shellService.cwd.mockReturnValue(otherWorktree);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd({ cwd: otherWorktree });

    expect(result).toBeNull();
    expect(trackerRepoStore.findIssue).not.toHaveBeenCalled();
  });

  it("returns null when folder name is valid but path does not match getGitWorktreePath", async () => {
    const wrongLayoutPath = path.join(mockRepo.projectPath, "wrong", "MI0100-mudissue");
    gitService.listWorktree.mockResolvedValue([wrongLayoutPath]);
    shellService.cwd.mockReturnValue(wrongLayoutPath);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd({ cwd: wrongLayoutPath });

    expect(result).toBeNull();
    expect(trackerRepoStore.findIssue).not.toHaveBeenCalled();
  });

  it("returns null when findIssue returns no matches", async () => {
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([]);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd();

    expect(result).toBeNull();
  });

  it("returns null when findIssue returns multiple matches", async () => {
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-mudissue"),
      buildIssueFolder("MI0100-mudissue-b"),
    ]);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd();

    expect(result).toBeNull();
  });

  it("returns null when truncated selector matches duplicate issue ids", async () => {
    shellService.cwd.mockReturnValue(truncatedWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([
      buildIssueFolder("MI0100-duplicated-issue-number-bug"),
      buildIssueFolder("MI0100-duplicated-issue-note"),
    ]);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd({ cwd: truncatedWorktreePath });

    expect(result).toBeNull();
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith(
      "MI0100-duplicated-issue",
    );
  });

  it("returns null when repo discovery fails", async () => {
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockRejectedValue(
      new Error("no repo"),
    );
    shellService.cwd.mockReturnValue(mudissueWorktreePath);

    const result = await FindIssueFromCwdHelper.findIssueFromCwd();

    expect(result).toBeNull();
    expect(gitService.listWorktree).not.toHaveBeenCalled();
  });
});
