import { jest } from "@jest/globals";
import { IssueViewCommand } from "../../src/commands/IssueViewCommand.tsx";
import { App } from "../../src/App.tsx";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (
  issueId: string,
  label?: string,
): IssueFolder => ({
  issueId,
  label: label ?? issueId,
  path: `/repo/issues/${issueId}`,
  metadata: { title: "t", status: "open" },
});

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueViewCommand", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  beforeEach(() => {
    resetAppStore();
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService = bundle.issueFinderService;
    loggerService = bundle.loggerService;
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    LoggerService.setInstance(loggerService);
    jest.clearAllMocks();
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  const buildCommand = (overrides?: {
    renderInk?: jest.Mock;
  }) =>
    new IssueViewCommand({
      ...(overrides?.renderInk && { renderInk: overrides.renderInk }),
    });

  it("throws ISSUE_NOT_FOUND when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const waitUntilExit = jest.fn(async () => {});
    const renderInk = jest.fn(() => ({ waitUntilExit }));
    const command = buildCommand({ renderInk });

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(renderInk).not.toHaveBeenCalled();
  });

  it("throws ISSUE_MULTI_MATCHED when multiple issues match", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-a", "0001"),
      buildIssueFolder("0001-b", "0001"),
    ]);
    const waitUntilExit = jest.fn(async () => {});
    const renderInk = jest.fn(() => ({ waitUntilExit }));
    const command = buildCommand({ renderInk });

    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(renderInk).not.toHaveBeenCalled();
  });

  it("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);
    const waitUntilExit = jest.fn(async () => {});
    const renderInk = jest.fn(() => ({ waitUntilExit }));
    const command = buildCommand({ renderInk });

    await expect(command.command("07", "missing")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        details: { project: "missing" },
      },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
    expect(renderInk).not.toHaveBeenCalled();
  });

  it("opens the issue in AppStore and renders App", async () => {
    const folder = buildIssueFolder("0001-view", "MI1");
    issueFinderService.find.mockResolvedValue([folder]);
    const waitUntilExit = jest.fn(async () => {});
    const renderInk = jest.fn(() => ({ waitUntilExit }));
    const command = buildCommand({ renderInk });

    await command.command("0001");

    expect(useAppStore.getState().getCurrentPage()).toEqual({
      name: "ISSUE_VIEWER",
      args: { issue: folder },
    });
    expect(useAppStore.getState().selectedIssueId).toBe("0001-view");
    expect(renderInk).toHaveBeenCalledTimes(1);
    expect(waitUntilExit).toHaveBeenCalledTimes(1);
    const intlEl = renderInk.mock.calls[0]?.[0] as {
      props: { children: { type: typeof App; props: Record<string, unknown> } };
    };
    const appEl = intlEl.props.children;
    expect(appEl.type).toBe(App);
    expect(appEl.props.serviceContext).toBeUndefined();
  });

  it("calls find with project when project is set and repo exists", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(mockRepo);
    const folder = buildIssueFolder("0001-p");
    issueFinderService.find.mockResolvedValue([folder]);
    const waitUntilExit = jest.fn(async () => {});
    const renderInk = jest.fn(() => ({ waitUntilExit }));
    const command = buildCommand({ renderInk });

    await command.command("0001", "proj-a");

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("0001", {
      project: "proj-a",
    });
  });
});
