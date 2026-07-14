import { jest } from "@jest/globals";
import { IssueSetPropertyCommand } from "../../../src/commands/IssueSetPropertyCommand.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../../../src/utils/storage/IssueMarkdownFileStorage.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import {
  resetIssueMetadataChangedPostHookStore,
  useIssueMetadataChangedPostHookStore,
} from "../../../src/store/IssueMetadataChangedPostHookStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import { usePopupStore } from "../../../src/store/PopupStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { DEFAULT_STATUS_LIST } from "../../../src/types/status.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import { SetSelectedIssueStatusPaletteCommand } from "../../../src/views/PaletteCommands/SetSelectedIssueStatusPaletteCommand.ts";

const buildIssue = (issueId: string, status?: string): IssueFolder =>
  buildIssueFolder(issueId, {
        path: `/repo/issues/${issueId}-test`,
    status,
  });

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

function resetPickItemDialogStore(): void {
  usePickItemDialogStore.setState({
    isDialogOpen: false,
    items: [],
    getDisplay: String,
    title: "Select item",
    columns: [],
    footerLabel: "Cancel<Esc>",
    minWidth: 52,
    maxWidth: 86,
    geom: {
      dialogWidth: 0,
      contentWidth: 0,
      columnWidths: [],
      tableWidth: 0,
    },
    displayRows: [],
    initialSelectedIndex: 0,
    pendingResolve: null,
  });
}

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

function resetPopupStore(): void {
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
}

describe("SetSelectedIssueStatusPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetFileWatcherStore();
    resetIssueMetadataChangedPostHookStore();
    resetPopupStore();
    resetCurrentTrackerRepoStore();
    resetPickItemDialogStore();
    resetToastStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });

    pickOpenMock = jest.fn();
    usePickItemDialogStore.setState({ open: pickOpenMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetFileWatcherStore();
    resetIssueMetadataChangedPostHookStore();
    resetPopupStore();
    resetCurrentTrackerRepoStore();
    resetPickItemDialogStore();
    resetToastStore();
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
    });

    const command = new SetSelectedIssueStatusPaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("marks the current status with (*) in the pick dialog", async () => {
    const issue = buildIssue("0001", "closed");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getStatusList: jest.fn().mockResolvedValue(DEFAULT_STATUS_LIST),
    });
    pickOpenMock.mockImplementation(async (items, getDisplay) => {
      expect(items).toEqual(DEFAULT_STATUS_LIST);
      const closedIndex = DEFAULT_STATUS_LIST.indexOf("closed");
      expect(getDisplay(DEFAULT_STATUS_LIST[closedIndex])).toBe("(*) closed");
      expect(getDisplay(DEFAULT_STATUS_LIST[0])).toBe("open");
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new SetSelectedIssueStatusPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("updates the issue status when a choice is confirmed", async () => {
    const issue = buildIssue("0001", "open");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getStatusList: jest.fn().mockResolvedValue(DEFAULT_STATUS_LIST),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "closed",
    });
    jest.spyOn(IssueSetPropertyCommand.prototype, "command").mockResolvedValue({
      status: "ok",
      result: {
        issueFilePath: "/repo/issues/0001-test/issue.md",
        property: "status",
        value: "closed",
      },
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0001-test/issue.md");
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    jest.spyOn(IssueMarkdownFileStorage.prototype, "load").mockResolvedValue();
    jest
      .spyOn(IssueMarkdownFileStorage.prototype, "getParsed")
      .mockReturnValueOnce({
        frontmatter: { title: "Test", status: "open" },
        content: "",
        raw: "",
        parseError: false,
      })
      .mockReturnValueOnce({
        frontmatter: { title: "Test", status: "closed" },
        content: "",
        raw: "",
        parseError: false,
      });
    const notifySpy = jest.fn().mockResolvedValue(undefined);
    useIssueMetadataChangedPostHookStore.setState({
      notifyMetadataChanged: notifySpy,
    });
    const requestReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "requestReload",
    );
    useFileWatcherStore.getState().registerWatcher(
      "/repo/issues/0001-test/issue.md",
    );

    await new SetSelectedIssueStatusPaletteCommand().callback();

    expect(IssueSetPropertyCommand.prototype.command).toHaveBeenCalledWith(
      issue.issueId,
      "status",
      "closed",
      mockRepo.name,
    );
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.status).toBe(
      "closed",
    );
    expect(
      useAppStore.getState().mainIssueLists?.[0]?.metadata?.updatedAt,
    ).toEqual(updatedAt);
    expect(requestReloadSpy).toHaveBeenCalledWith(
      "/repo/issues/0001-test/issue.md",
    );
    expect(notifySpy).toHaveBeenCalledWith(
      issue,
      { title: "Test", status: "closed" },
      { title: "Test", status: "open" },
    );
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("sets status on every issue in a table range selection", async () => {
    const issueA = buildIssue("0001", "open");
    const issueB = buildIssue("0002", "open");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getStatusList: jest.fn().mockResolvedValue(DEFAULT_STATUS_LIST),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "closed",
    });
    const commandSpy = jest
      .spyOn(IssueSetPropertyCommand.prototype, "command")
      .mockResolvedValue({
        status: "ok",
        result: {
          issueFilePath: "/repo/issues/issue.md",
          property: "status",
          value: "closed",
        },
      });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/issue.md");
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    jest.spyOn(IssueMarkdownFileStorage.prototype, "load").mockResolvedValue();
    jest.spyOn(IssueMarkdownFileStorage.prototype, "getParsed").mockReturnValue({
      frontmatter: { status: "open" },
      content: "",
      raw: "",
      parseError: false,
    });
    useIssueMetadataChangedPostHookStore.setState({
      notifyMetadataChanged: jest.fn().mockResolvedValue(undefined),
    });
    useFileWatcherStore.getState().registerWatcher("/repo/issues/issue.md");
    await new SetSelectedIssueStatusPaletteCommand().callback();

    expect(commandSpy).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.status).toBe(
      "closed",
    );
    expect(useAppStore.getState().mainIssueLists?.[1]?.metadata?.status).toBe(
      "closed",
    );
    expect(
      useFileWatcherStore.getState().generationByPath["/repo/issues/issue.md"],
    ).toBe(2);
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("does nothing when the pick dialog is cancelled", async () => {
    const issue = buildIssue("0001", "open");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getStatusList: jest.fn().mockResolvedValue(DEFAULT_STATUS_LIST),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });
    const commandSpy = jest.spyOn(IssueSetPropertyCommand.prototype, "command");

    await new SetSelectedIssueStatusPaletteCommand().callback();

    expect(commandSpy).not.toHaveBeenCalled();
  });
});
