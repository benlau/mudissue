import { jest } from "@jest/globals";
import { ChangeIssueIdHelper } from "../../../src/helpers/ChangeIssueIdHelper.ts";
import { useAlertDialogStore } from "../../../src/store/AlertDialogStore.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import { useTextInputDialogStore } from "../../../src/store/TextInputDialogStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { ChangeIssueIdPaletteCommand } from "../../../src/views/PaletteCommands/ChangeIssueIdPaletteCommand.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../../fixture/navigationStack.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
        path: `/repo/issues/${issueId}-test`,
  });

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

function resetAlertStore(): void {
  useAlertDialogStore.setState({
    isDialogOpen: false,
    message: "",
    pendingResolve: null,
  });
}

function resetTextInputDialogStore(): void {
  useTextInputDialogStore.setState({
    isDialogOpen: false,
    title: "",
    prompt: "",
    placeholder: "",
    confirmLabel: undefined,
    value: "",
    error: null,
    inputKey: 0,
    validate: null,
    pendingResolve: null,
    activeOpenPromise: null,
  });
}

describe("ChangeIssueIdPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let toastErrorMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["error"]
  >;
  let alertOpenMock: jest.Mock<
    ReturnType<typeof useAlertDialogStore.getState>["open"]
  >;
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  >;
  let changeIssueIdMock: jest.Mock<
    ReturnType<ChangeIssueIdHelper["changeIssueId"]>
  >;
  let stopAllWatchersMock: jest.Mock;
  let resumeWatchersMock: jest.Mock;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetFileWatcherStore();
    resetToastStore();
    resetAlertStore();
    resetTextInputDialogStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    toastErrorMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock, error: toastErrorMock });

    alertOpenMock = jest.fn().mockResolvedValue(undefined);
    useAlertDialogStore.setState({ open: alertOpenMock });

    refreshIssueListsMock = jest.fn().mockResolvedValue([]);
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });

    changeIssueIdMock = jest.fn().mockResolvedValue({
      oldIssueFolderName: "0001-test",
      newIssueFolderName: "MI042-test",
    });
    jest
      .spyOn(ChangeIssueIdHelper.prototype, "changeIssueId")
      .mockImplementation(changeIssueIdMock);

    stopAllWatchersMock = jest.fn();
    resumeWatchersMock = jest.fn();
    useFileWatcherStore.setState({
      stopAllWatchers: stopAllWatchersMock,
      resumeWatchers: resumeWatchersMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetFileWatcherStore();
    resetToastStore();
    resetAlertStore();
    resetTextInputDialogStore();
  });

  it("no-ops when no issue is selected", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const openMock = jest.fn().mockResolvedValue({ type: "cancelled" });
    useTextInputDialogStore.setState({ open: openMock });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(openMock).not.toHaveBeenCalled();
    expect(changeIssueIdMock).not.toHaveBeenCalled();
    expect(stopAllWatchersMock).not.toHaveBeenCalled();
  });

  it("opens the text input dialog for the first selected issue", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    const openMock = jest.fn().mockResolvedValue({ type: "cancelled" });
    useTextInputDialogStore.setState({ open: openMock });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(openMock).toHaveBeenCalled();
    const openArgs = openMock.mock.calls[0]![0] as {
      initialValue: string;
      validate: (value: string) => string | null;
    };
    expect(openArgs.initialValue).toBe("0001");
    expect(openArgs.validate("not valid")).not.toBeNull();
    expect(openArgs.validate("MI042")).toBeNull();
    expect(changeIssueIdMock).not.toHaveBeenCalled();
    expect(stopAllWatchersMock).not.toHaveBeenCalled();
  });

  it("changes the issue id, refreshes the list, and shows a toast", async () => {
    const issue = buildIssue("0001");
    const updated = buildIssue("MI042");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    refreshIssueListsMock.mockResolvedValue([updated]);
    useTextInputDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: "accepted",
        value: "MI042",
      }),
    });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(stopAllWatchersMock).toHaveBeenCalled();
    expect(changeIssueIdMock).toHaveBeenCalledWith(mockRepo, issue, "MI042");
    expect(stopAllWatchersMock.mock.invocationCallOrder[0]).toBeLessThan(
      changeIssueIdMock.mock.invocationCallOrder[0]!,
    );
    expect(refreshIssueListsMock).toHaveBeenCalled();
    expect(useAppStore.getState().selectedIssueId).toBe("MI042-test");
    expect(toastInfoMock).toHaveBeenCalled();
    expect(resumeWatchersMock).toHaveBeenCalled();
  });

  it("replaces the active issue viewer with the refreshed renamed issue", async () => {
    const issue = buildIssue("0001");
    const updated = buildIssueFolder("MI042-test", {
      path: "/repo/issues/MI042-test",
      label: "MI042",
    });
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: viewerNavigationStack(issue),
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    refreshIssueListsMock.mockResolvedValue([updated]);
    useTextInputDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: "accepted",
        value: "MI042",
      }),
    });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(stopAllWatchersMock).toHaveBeenCalled();
    expect(resumeWatchersMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().getCurrentPage()).toEqual({
      name: "ISSUE_VIEWER",
      args: { issue: updated },
    });
  });

  it("does not replace the viewer when the current page is the issue table", async () => {
    const issue = buildIssue("0001");
    const updated = buildIssue("MI042");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    refreshIssueListsMock.mockResolvedValue([updated]);
    useTextInputDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: "accepted",
        value: "MI042",
      }),
    });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");
    expect(resumeWatchersMock).toHaveBeenCalledTimes(1);
  });

  it("shows a red error toast when the target issue id already exists", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    useTextInputDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: "accepted",
        value: "MI042",
      }),
    });
    changeIssueIdMock.mockRejectedValue({
      status: "error",
      error: {
        code: "CHANGE_ISSUE_ID_TARGET_EXISTS",
        message: 'Another issue folder matches issue ID "MI042".',
      },
    });

    await new ChangeIssueIdPaletteCommand().callback();

    expect(stopAllWatchersMock).toHaveBeenCalled();
    expect(resumeWatchersMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalled();
    expect(alertOpenMock).not.toHaveBeenCalled();
    expect(refreshIssueListsMock).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("resumes watchers when an unexpected id change error is thrown", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    useTextInputDialogStore.setState({
      open: jest.fn().mockResolvedValue({
        type: "accepted",
        value: "MI042",
      }),
    });
    changeIssueIdMock.mockRejectedValue(new Error("rename failed"));

    await expect(
      new ChangeIssueIdPaletteCommand().callback(),
    ).rejects.toThrow();

    expect(stopAllWatchersMock).toHaveBeenCalledTimes(1);
    expect(resumeWatchersMock).toHaveBeenCalledTimes(1);
  });
});
