import { jest } from "@jest/globals";
import { CreateIssueHelper } from "../../../src/helpers/CreateIssueHelper.ts";
import { useAlertDialogStore } from "../../../src/store/AlertDialogStore.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useTextInputDialogStore } from "../../../src/store/TextInputDialogStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { IssueMergeSectionGenerator } from "../../../src/async/generators/IssueMergeSectionGenerator.ts";
import { IssueFolderStorage } from "../../../src/async/storage/IssueFolderStorage.ts";
import { MergeSelectedIssuesPaletteCommand } from "../../../src/views/PaletteCommands/MergeSelectedIssuesPaletteCommand.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import { INITIAL_NAVIGATION_STACK } from "../../fixture/navigationStack.ts";

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

const createdIssue = buildIssueFolder("MI0100-merged", {
  path: "/repo/issues/MI0100-merged",
});

function resetConfirmationDialogStore(): void {
  useConfirmationDialogStore.setState(
    useConfirmationDialogStore.getInitialState(),
    true,
  );
}

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

describe("MergeSelectedIssuesPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let toastErrorMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["error"]
  >;
  let alertOpenMock: jest.Mock<
    ReturnType<typeof useAlertDialogStore.getState>["open"]
  >;
  let confirmationOpenMock: jest.Mock<
    ReturnType<typeof useConfirmationDialogStore.getState>["open"]
  >;
  let textInputOpenMock: jest.Mock<
    ReturnType<typeof useTextInputDialogStore.getState>["open"]
  >;
  let createIssueMock: jest.Mock<
    ReturnType<CreateIssueHelper["createIssue"]>
  >;
  let renderMergedContentMock: jest.Mock<
    ReturnType<IssueMergeSectionGenerator["renderMergedContent"]>
  >;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();
    resetAlertStore();
    resetTextInputDialogStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    toastErrorMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock, error: toastErrorMock });

    alertOpenMock = jest.fn().mockResolvedValue(undefined);
    useAlertDialogStore.setState({ open: alertOpenMock });

    confirmationOpenMock = jest
      .fn()
      .mockResolvedValue({ type: "accepted" as const });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });

    textInputOpenMock = jest.fn().mockResolvedValue({
      type: "accepted" as const,
      value: "Merged Title",
    });
    useTextInputDialogStore.setState({ open: textInputOpenMock });

    renderMergedContentMock = jest
      .fn<ReturnType<IssueMergeSectionGenerator["renderMergedContent"]>>()
      .mockResolvedValue("merged-body");
    jest
      .spyOn(IssueMergeSectionGenerator.prototype, "renderMergedContent")
      .mockImplementation(renderMergedContentMock);

    createIssueMock = jest
      .fn<ReturnType<CreateIssueHelper["createIssue"]>>()
      .mockResolvedValue(createdIssue);
    jest
      .spyOn(CreateIssueHelper.prototype, "createIssue")
      .mockImplementation(createIssueMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();
    resetAlertStore();
    resetTextInputDialogStore();
  });

  it("alerts when only a single issue is selected", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    await new MergeSelectedIssuesPaletteCommand().callback();

    expect(alertOpenMock).toHaveBeenCalled();
    expect(confirmationOpenMock).not.toHaveBeenCalled();
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it("does nothing when no issue is selected", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    await new MergeSelectedIssuesPaletteCommand().callback();

    expect(alertOpenMock).not.toHaveBeenCalled();
    expect(confirmationOpenMock).not.toHaveBeenCalled();
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it("does not create when merge confirmation is cancelled", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    confirmationOpenMock.mockResolvedValue({ type: "cancelled" });

    await new MergeSelectedIssuesPaletteCommand().callback();

    expect(createIssueMock).not.toHaveBeenCalled();
    expect(textInputOpenMock).not.toHaveBeenCalled();
  });

  it("creates a merged issue and removes originals without a second confirmation", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    const removeSpy = jest
      .spyOn(IssueFolderStorage.prototype, "remove")
      .mockResolvedValue([]);
    const refreshMock = jest.fn().mockResolvedValue([createdIssue]);
    useAppStore.setState({ refreshIssueLists: refreshMock });

    await new MergeSelectedIssuesPaletteCommand().callback();

    expect(renderMergedContentMock).toHaveBeenCalledWith([issueA, issueB]);
    expect(createIssueMock).toHaveBeenCalledWith(
      "Merged Title",
      undefined,
      "merged-body",
    );
    expect(confirmationOpenMock).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(refreshMock).toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
    expect(
      useAppStore.getState().tableRangeSelectionAnchorIssueId,
    ).toBeNull();
  });

});
