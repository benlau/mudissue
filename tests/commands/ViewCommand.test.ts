import { jest } from "@jest/globals";
import * as path from "path";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import { GitService } from "../../src/services/GitService.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import { ISSUE_TABLE_PAGE } from "../../src/types/page.ts";
import {
  createMockSystemContext,
  setMockCurrentTrackerRepo,
} from "../fixture/MockServiceContext.tsx";

const waitUntilExit = jest.fn<() => Promise<void>>(async () => {});
const renderMock = jest.fn(() => ({ waitUntilExit }));

const actualInk = await import("ink");

await jest.unstable_mockModule("ink", () => ({
  ...actualInk,
  render: renderMock,
}));

const { ViewCommand } = await import("../../src/commands/ViewCommand.tsx");
const { App } = await import("../../src/App.tsx");

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

const buildIssueFolder = (
  folderName: string,
  issueId = "MI1",
): IssueFolder =>
  buildIssueFolderFixture(issueId, {
    folderName,
    path: path.join(mockRepo.projectPath, "issues", folderName),
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

describe("ViewCommand", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];

  beforeEach(() => {
    resetAppStore();
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
    ]);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    GitService.setInstance(bundle.gitService as unknown as GitService);
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));
    setMockCurrentTrackerRepo(mockRepo);
    trackerRepoStore.ensureCurrentTrackerRepoFound.mockResolvedValue(undefined);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    gitService.listWorktree.mockResolvedValue([
      mockRepo.projectPath,
      mudissueWorktreePath,
      truncatedWorktreePath,
    ]);
    renderMock.mockReturnValue({ waitUntilExit });
    waitUntilExit.mockImplementation(async () => {});
  });

  afterEach(() => {
    ShellService.setInstance(null);
    GitService.setInstance(null);
    resetGlobalConfigStore();
  });

  const buildCommand = () => new ViewCommand();

  it("opens the issue in AppStore and renders App when cwd is in a mudissue worktree", async () => {
    const folder = buildIssueFolder("MI0100-mudissue");
    shellService.cwd.mockReturnValue(mudissueWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([folder]);

    await buildCommand().command();

    expect(useAppStore.getState().getCurrentPage()).toEqual({
      name: "ISSUE_VIEWER",
      args: { issue: folder },
    });
    expect(useAppStore.getState().selectedFolderName).toBe("MI0100-mudissue");
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(waitUntilExit).toHaveBeenCalledTimes(1);
    const intlEl = renderMock.mock.calls[0]?.[0] as {
      props: { children: { type: typeof App; props: Record<string, unknown> } };
    };
    const appEl = intlEl.props.children;
    expect(appEl.type).toBe(App);
  });

  it("renders App without opening an issue when cwd is not in a mudissue worktree", async () => {
    shellService.cwd.mockReturnValue(path.join(mockRepo.projectPath, "src"));

    await buildCommand().command();

    expect(useAppStore.getState().getCurrentPage()).toEqual(ISSUE_TABLE_PAGE);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(waitUntilExit).toHaveBeenCalledTimes(1);
  });

  it("opens the issue when cwd is in a truncated mudissue worktree folder", async () => {
    const folder = buildIssueFolder("MI0100-duplicated-issue-number-bug");
    shellService.cwd.mockReturnValue(truncatedWorktreePath);
    trackerRepoStore.findIssue.mockResolvedValue([folder]);

    await buildCommand().command();

    expect(useAppStore.getState().getCurrentPage()).toEqual({
      name: "ISSUE_VIEWER",
      args: { issue: folder },
    });
    expect(useAppStore.getState().selectedFolderName).toBe(folder.folderName);
    expect(trackerRepoStore.findIssue).toHaveBeenCalledWith(
      "MI0100-duplicated-issue",
    );
  });

  it("throws when issue_path in mud.conf is absolute", async () => {
    const absoluteIssue = path.resolve("/tmp/external-issues");
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      ...mockRepo,
      configFilePath: path.join(mockRepo.projectPath, "mud.conf"),
      config: { issue_path: absoluteIssue },
    });
    shellService.isAbsolute.mockImplementation((p: string) => path.isAbsolute(p));

    await expect(buildCommand().command()).rejects.toThrow(
      /issue_path must be relative/,
    );
    expect(renderMock).not.toHaveBeenCalled();
  });
});
