import { jest } from "@jest/globals";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../../fixture/navigationStack.ts";
import { RemoveSelectedIssuePaletteCommand } from "../../../src/views/PaletteCommands/RemoveSelectedIssuePaletteCommand.ts";

import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
    folderName: `${issueId}-test`,
    path: `/repo/issues/${issueId}-test`,
  });

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

function resetConfirmationDialogStore(): void {
  useConfirmationDialogStore.setState(
    useConfirmationDialogStore.getInitialState(),
    true,
  );
}

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

describe("RemoveSelectedIssuePaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let toastErrorMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["error"]
  >;
  let confirmationOpenMock: jest.Mock<
    ReturnType<typeof useConfirmationDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();

    confirmationOpenMock = jest
      .fn()
      .mockResolvedValue({ type: "accepted" as const });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    toastErrorMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock, error: toastErrorMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedFolderName: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const command = new RemoveSelectedIssuePaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("removes the active issue, closes the viewer, and refreshes the list", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedFolderName: issueA.folderName,
      navigationStack: viewerNavigationStack(issueA),
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    const removeSpy = jest
      .spyOn(IssueFolderStorage.prototype, "remove")
      .mockResolvedValue([]);
    const refreshMock = jest.fn().mockImplementation(async () => {
      useAppStore.setState({ mainIssueLists: [issueB] });
      return [issueB];
    });
    const originalCloseIssue = useAppStore.getState().closeIssue;
    const closeMock = jest.fn(() => originalCloseIssue());
    useAppStore.setState({
      refreshIssueLists: refreshMock,
      closeIssue: closeMock,
    });

    await new RemoveSelectedIssuePaletteCommand().callback();

    expect(removeSpy).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");
    expect(useAppStore.getState().selectedFolderName).toBe(issueB.folderName);
  });

  it("removes the selected table row and selects a neighbor in the refreshed list", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedFolderName: issueB.folderName,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "remove")
      .mockResolvedValue([]);
    useAppStore.setState({
      refreshIssueLists: jest.fn().mockImplementation(async () => {
        useAppStore.setState({ mainIssueLists: [issueA] });
        return [issueA];
      }),
    });

    await new RemoveSelectedIssuePaletteCommand().callback();

    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");
    expect(useAppStore.getState().selectedFolderName).toBe(issueA.folderName);
  });

  it("removes every issue in a table range selection", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    const issueC = buildIssue("0003");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB, issueC],
      selectedFolderName: issueB.folderName,
      tableRangeSelectionAnchorFolderName: issueA.folderName,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    const removeSpy = jest
      .spyOn(IssueFolderStorage.prototype, "remove")
      .mockResolvedValue([]);
    useAppStore.setState({
      refreshIssueLists: jest.fn().mockImplementation(async () => {
        useAppStore.setState({ mainIssueLists: [issueC] });
        return [issueC];
      }),
    });

    await new RemoveSelectedIssuePaletteCommand().callback();

    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(toastInfoMock).toHaveBeenCalled();
    expect(
      useAppStore.getState().tableRangeSelectionAnchorFolderName,
    ).toBeNull();
  });

  it("does nothing when confirmation is cancelled", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    confirmationOpenMock.mockResolvedValue({ type: "cancelled" });
    const removeSpy = jest.spyOn(IssueFolderStorage.prototype, "remove");

    await new RemoveSelectedIssuePaletteCommand().callback();

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("shows an error toast when remove throws", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "remove")
      .mockRejectedValue(new Error("ENOTEMPTY"));
    const refreshMock = jest.fn();
    useAppStore.setState({ refreshIssueLists: refreshMock });

    await new RemoveSelectedIssuePaletteCommand().callback();

    expect(toastErrorMock).toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
