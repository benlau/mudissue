import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeListCommand } from "../../src/commands/IssueWorktreeListCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

describe("IssueWorktreeListCommand", () => {
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    loggerService = bundle.loggerService;
    trackerRepoStore = bundle.trackerRepoStore;
    fileService = bundle.fileService;
    gitService = bundle.gitService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    bundle.shellService.which.mockResolvedValue("/usr/bin/git");
    fileService.exists.mockResolvedValue(true);

    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      path.join(mockRepo.projectPath, ".claude", "worktrees", "MI0100-mudissue"),
      path.join(path.sep, "other", "ROOT", "0042-not-mudissue-layout"),
    ]);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = () => new IssueWorktreeListCommand();

  it("logs only paths that match getGitWorktreePath for the basename", async () => {
    const expectedMudissuePath = path.join(
      mockRepo.projectPath,
      ".claude",
      "worktrees",
      "MI0100-mudissue",
    );

    const command = buildCommand();
    const result = await command.command();

    expect(result?.status).toBe("ok");
    expect((result as { result: { paths: string[] } }).result.paths).toEqual([
      path.normalize(expectedMudissuePath),
    ]);
    expect(gitService.listWorktree).toHaveBeenCalledWith(mockRepo.projectPath);
    expect(loggerService.info.mock.calls.map((c) => c[0])).toEqual([
      path.normalize(expectedMudissuePath),
    ]);
  });

  it("excludes the primary project checkout from listed issue worktrees", async () => {
    const expectedMudissuePath = path.join(
      mockRepo.projectPath,
      ".claude",
      "worktrees",
      "MI0100-mudissue",
    );

    const command = buildCommand();
    const result = await command.command();

    expect((result as { result: { paths: string[] } }).result.paths).not.toContain(
      path.normalize(mockRepo.projectPath),
    );
    expect((result as { result: { paths: string[] } }).result.paths).toEqual([
      path.normalize(expectedMudissuePath),
    ]);
  });

  it("calls getTrackerRepoByProjectName when project is set", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);

    const command = buildCommand();
    await command.command("child");

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "child",
    );
    expect(gitService.listWorktree).toHaveBeenCalledWith(mockRepo.projectPath);
  });

  it("ignores checkout paths whose basename is not a valid issue folder name", async () => {
    gitService.listWorktree.mockResolvedValue([
      path.join(mockRepo.projectPath, "not-an-issue-folder"),
    ]);

    const command = buildCommand();
    const result = await command.command();

    expect((result as { result: { paths: string[] } }).result.paths).toEqual(
      [],
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });
});
