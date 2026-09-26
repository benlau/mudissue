import { jest } from "@jest/globals";
import { IssueFolderStorage } from "../../../src/async/storage/IssueFolderStorage.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import { useAlertDialogStore } from "../../../src/store/AlertDialogStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import { usePopupStore } from "../../../src/store/PopupStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import { TouchPaletteCommand } from "../../../src/views/PaletteCommands/TouchPaletteCommand.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
        path: `/repo/issues/${issueId}-test`,
    status: "open",
    priority: "normal",
    title: "Test issue",
  });

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

function resetAlertDialogStore(): void {
  useAlertDialogStore.setState({
    isDialogOpen: false,
    message: "",
    pendingResolve: null,
  });
}

function resetPopupStore(): void {
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
}

describe("TouchPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let alertOpenMock: jest.Mock<
    ReturnType<typeof useAlertDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetFileWatcherStore();
    resetPopupStore();
    resetToastStore();
    resetAlertDialogStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });

    alertOpenMock = jest.fn().mockResolvedValue(undefined);
    useAlertDialogStore.setState({ open: alertOpenMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetFileWatcherStore();
    resetPopupStore();
    resetToastStore();
    resetAlertDialogStore();
  });

  it("does nothing when no issue is selected", async () => {
    const touchSpy = jest.spyOn(IssueFolderStorage.prototype, "touchUpdatedAt");

    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
    });

    await new TouchPaletteCommand().callback();

    expect(touchSpy).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("touches the selected issue and updates metadata", async () => {
    const issue = buildIssue("0001");
    const filePath = "/repo/issues/0001-test/issue.md";
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    const requestReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "requestReload",
    );
    useFileWatcherStore.getState().registerWatcher(filePath);

    await new TouchPaletteCommand().callback();

    expect(IssueFolderStorage.prototype.touchUpdatedAt).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.updatedAt).toEqual(
      updatedAt,
    );
    expect(requestReloadSpy).toHaveBeenCalledWith(filePath);
    expect(toastInfoMock).toHaveBeenCalled();
    expect(alertOpenMock).not.toHaveBeenCalled();
  });

  it("touches every issue in a table range selection", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
    });

    const touchSpy = jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/issue.md");
    useFileWatcherStore.getState().registerWatcher("/repo/issues/issue.md");
    await new TouchPaletteCommand().callback();

    expect(touchSpy).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.updatedAt).toEqual(
      updatedAt,
    );
    expect(useAppStore.getState().mainIssueLists?.[1]?.metadata?.updatedAt).toEqual(
      updatedAt,
    );
    expect(
      useFileWatcherStore.getState().generationByPath["/repo/issues/issue.md"],
    ).toBe(2);
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("shows an alert and stops when touch fails", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
    });

    const touchSpy = jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockRejectedValueOnce(new Error("No issue file found in /repo/issues/0001-test"));
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0001-test/issue.md");

    await new TouchPaletteCommand().callback();

    expect(touchSpy).toHaveBeenCalledTimes(1);
    expect(alertOpenMock).toHaveBeenCalledWith(
      "No issue file found in /repo/issues/0001-test",
    );
    expect(toastInfoMock).not.toHaveBeenCalled();
  });
});
