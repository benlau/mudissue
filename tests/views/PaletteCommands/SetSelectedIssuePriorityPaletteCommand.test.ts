import { jest } from "@jest/globals";
import { IssueSetPropertyCommand } from "../../../src/commands/IssueSetPropertyCommand.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import { usePopupStore } from "../../../src/store/PopupStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { DEFAULT_PRIORITY_TABLE } from "../../../src/types/priority.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import { SetSelectedIssuePriorityPaletteCommand } from "../../../src/views/PaletteCommands/SetSelectedIssuePriorityPaletteCommand.ts";

const buildIssue = (issueId: string, priority?: string): IssueFolder =>
  buildIssueFolder(issueId, {
    folderName: `${issueId}-test`,
    path: `/repo/issues/${issueId}-test`,
    priority,
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

describe("SetSelectedIssuePriorityPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetFileWatcherStore();
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
    resetPopupStore();
    resetCurrentTrackerRepoStore();
    resetPickItemDialogStore();
    resetToastStore();
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedFolderName: null,
    });

    const command = new SetSelectedIssuePriorityPaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("marks the current priority with (*) in the pick dialog", async () => {
    const issue = buildIssue("0001", "high");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getPriorityTable: jest.fn().mockResolvedValue(DEFAULT_PRIORITY_TABLE),
    });
    pickOpenMock.mockImplementation(async (items, getDisplay) => {
      expect(items).toEqual(DEFAULT_PRIORITY_TABLE.priorities);
      expect(getDisplay(DEFAULT_PRIORITY_TABLE.priorities[1]!)).toBe("(*) high");
      expect(getDisplay(DEFAULT_PRIORITY_TABLE.priorities[0]!)).toBe("urgent");
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new SetSelectedIssuePriorityPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("updates the issue priority when a choice is confirmed", async () => {
    const issue = buildIssue("0001", "low");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getPriorityTable: jest.fn().mockResolvedValue(DEFAULT_PRIORITY_TABLE),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: DEFAULT_PRIORITY_TABLE.priorities[0],
    });
    jest.spyOn(IssueSetPropertyCommand.prototype, "command").mockResolvedValue({
      status: "ok",
      result: {
        issueFilePath: "/repo/issues/0001-test/issue.md",
        property: "priority",
        value: "urgent",
      },
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    const requestReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "requestReload",
    );
    useFileWatcherStore.getState().registerWatcher(
      "/repo/issues/0001-test/issue.md",
    );

    await new SetSelectedIssuePriorityPaletteCommand().callback();

    expect(IssueSetPropertyCommand.prototype.command).toHaveBeenCalledWith(
      issue.folderName,
      "priority",
      "urgent",
      mockRepo.name,
    );
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.priority).toBe("urgent");
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.updatedAt).toEqual(
      updatedAt,
    );
    expect(requestReloadSpy).toHaveBeenCalledWith(
      "/repo/issues/0001-test/issue.md",
    );
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("sets priority on every issue in a table range selection", async () => {
    const issueA = buildIssue("0001", "low");
    const issueB = buildIssue("0002", "low");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedFolderName: issueB.folderName,
      tableRangeSelectionAnchorFolderName: issueA.folderName,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getPriorityTable: jest.fn().mockResolvedValue(DEFAULT_PRIORITY_TABLE),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: DEFAULT_PRIORITY_TABLE.priorities[0],
    });
    const commandSpy = jest
      .spyOn(IssueSetPropertyCommand.prototype, "command")
      .mockResolvedValue({
        status: "ok",
        result: {
          issueFilePath: "/repo/issues/issue.md",
          property: "priority",
          value: "urgent",
        },
      });
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAt")
      .mockResolvedValue(updatedAt);
    useFileWatcherStore.getState().registerWatcher("/repo/issues/issue.md");
    await new SetSelectedIssuePriorityPaletteCommand().callback();

    expect(commandSpy).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.priority).toBe("urgent");
    expect(useAppStore.getState().mainIssueLists?.[1]?.metadata?.priority).toBe("urgent");
    expect(
      useFileWatcherStore.getState().generationByPath["/repo/issues/issue.md"],
    ).toBe(2);
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("does nothing when the pick dialog is cancelled", async () => {
    const issue = buildIssue("0001", "low");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getPriorityTable: jest.fn().mockResolvedValue(DEFAULT_PRIORITY_TABLE),
    });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });
    const commandSpy = jest.spyOn(IssueSetPropertyCommand.prototype, "command");

    await new SetSelectedIssuePriorityPaletteCommand().callback();

    expect(commandSpy).not.toHaveBeenCalled();
  });
});
