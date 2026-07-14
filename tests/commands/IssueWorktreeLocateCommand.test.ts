import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeLocateCommand } from "../../src/commands/IssueWorktreeLocateCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";

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
  name: "proj",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueWorktreeLocateCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    useGlobalConfigStore.setState({ globalConfig: {} });
  });

  afterEach(() => {
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = () => new IssueWorktreeLocateCommand();

  it("returns ISSUE_NOT_FOUND when no issue matches", async () => {
    issueFinderService.find.mockResolvedValue([]);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("returns ISSUE_MULTI_MATCHED when multiple issues match", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("MI001-a"),
      buildIssueFolder("MI001-b"),
    ]);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    await expect(command.command("MI001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
  });

  it("returns success with path when worktree exists", async () => {
    const folderName = "MI0042-feature";
    issueFinderService.find.mockResolvedValue([buildIssueFolder(folderName)]);
    const expectedPath = path.join(mockRepo.projectPath, ".claude/worktrees", folderName);
    fileService.exists.mockResolvedValue(true);

    const command = buildCommand();
    const result = await command.command("MI0042");

    expect(result?.status).toBe("ok");
    expect((result as { result: { path: string } }).result).toMatchObject({
      path: expectedPath,
    });
  });

  it("calls getTrackerRepoByProjectName and find with project when project is passed", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    issueFinderService.find.mockResolvedValue([]);
    fileService.exists.mockResolvedValue(false);

    const command = buildCommand();
    await expect(command.command("MI001", "proj-a")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("MI001", {
      project: "proj-a",
    });
  });
});
