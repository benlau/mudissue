import { jest } from "@jest/globals";
import * as path from "path";
import { WorktreeHelper } from "../../src/helpers/WorktreeHelper.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { createMockShellService } from "../fixture/MockServiceContext.tsx";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues", worktree_path: "../worktree-mudissue" },
};

describe("WorktreeHelper.filterIssueWorktreeCheckoutPaths", () => {
  let mockShellService: ReturnType<typeof createMockShellService>;

  beforeEach(() => {
    mockShellService = createMockShellService();
    mockShellService.isAbsolute.mockImplementation((p: string) =>
      path.isAbsolute(p),
    );
    ShellService.setInstance(mockShellService as unknown as ShellService);

    useCurrentTrackerRepoStore.setState({
      currentTrackerRepo: mockRepo,
      subTrackerRepoList: [],
    });
    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetCurrentTrackerRepoStore();
    resetGlobalConfigStore();
  });

  it("excludes the primary project checkout even when it appears in listWorktree output", async () => {
    const issuePath = path.join(
      path.dirname(mockRepo.projectPath),
      "worktree-mudissue",
      "MI0100-mudissue",
    );

    const result = await WorktreeHelper.filterIssueWorktreeCheckoutPaths(
      mockRepo,
      [mockRepo.projectPath, issuePath],
    );

    expect(result).toEqual([path.normalize(issuePath)]);
  });

  it("returns issue worktree paths sorted by locale", async () => {
    const first = path.join(
      path.dirname(mockRepo.projectPath),
      "worktree-mudissue",
      "MI0200-second",
    );
    const second = path.join(
      path.dirname(mockRepo.projectPath),
      "worktree-mudissue",
      "MI0100-first",
    );

    const result = await WorktreeHelper.filterIssueWorktreeCheckoutPaths(
      mockRepo,
      [mockRepo.projectPath, second, first],
    );

    expect(result).toEqual([
      path.normalize(second),
      path.normalize(first),
    ]);
  });
});
