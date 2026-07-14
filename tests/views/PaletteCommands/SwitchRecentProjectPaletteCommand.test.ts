import { jest } from "@jest/globals";
import { RegistryService } from "../../../src/services/RegistryService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { resetGlobalConfigStore } from "../../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { SwitchRecentProjectPaletteCommand } from "../../../src/views/PaletteCommands/SwitchRecentProjectPaletteCommand.ts";

const issuesAfterSwitch: IssueFolder[] = [
  {
    issueId: "ZZ0001-x",
    label: "ZZ0001",
    path: "/tmp/repo-b/ZZ0001-x",
    metadata: { title: "Alpha", status: "open" },
  },
];

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
    pendingResolve: null,
  });
}

describe("SwitchRecentProjectPaletteCommand", () => {
  let loadCurrentTrackerRepoByPathMock: jest.Mock<
    ReturnType<
      typeof useCurrentTrackerRepoStore.getState
    >["loadCurrentTrackerRepoByPath"]
  >;
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetGlobalConfigStore();
    resetPickItemDialogStore();

    jest
      .spyOn(RegistryService.getInstance(), "getRecentProjects")
      .mockResolvedValue([{ name: "repo-b", projectPath: "/tmp/repo-b" }]);

    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue({
        name: "repo-a",
        projectPath: "/tmp/repo-a",
        trackerPath: "/tmp/repo-a",
        config: {},
      }),
    });

    loadCurrentTrackerRepoByPathMock = jest.fn().mockResolvedValue(undefined);
    useCurrentTrackerRepoStore.setState({
      loadCurrentTrackerRepoByPath: loadCurrentTrackerRepoByPathMock,
    });

    refreshIssueListsMock = jest.fn().mockImplementation(async () => {
      useAppStore.setState({
        mainIssueLists: issuesAfterSwitch,
        pinnedIssueIds: ["ZZ0001-x"],
      });
      return issuesAfterSwitch;
    });
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });

    pickOpenMock = jest.fn().mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: { name: "repo-b", projectPath: "/tmp/repo-b" },
    });
    usePickItemDialogStore.setState({ open: pickOpenMock });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetGlobalConfigStore();
    resetPickItemDialogStore();
  });

  it("reloads the target project, refreshes issue lists and pins, and selects the first row", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: "MI0002-b",
      filter: "status:open",
      searchRestoreIssueId: "MI0001-a",
      tableRangeSelectionAnchorIssueId: "MI0001-a",
      pinnedIssueIds: ["MI0001-a"],
    });

    const callbackPromise = new SwitchRecentProjectPaletteCommand().callback();
    await jest.advanceTimersByTimeAsync(2000);
    await callbackPromise;

    expect(loadCurrentTrackerRepoByPathMock).toHaveBeenCalledWith("/tmp/repo-b");
    expect(refreshIssueListsMock).toHaveBeenCalled();

    const state = useAppStore.getState();
    expect(state.filter).toBeNull();
    expect(state.searchRestoreIssueId).toBeNull();
    expect(state.tableRangeSelectionAnchorIssueId).toBeNull();
    expect(state.selectedIssueId).toBe("ZZ0001-x");
    expect(state.pinnedIssueIds).toEqual(["ZZ0001-x"]);
    expect(state.isLoadingIssueList).toBe(false);
  });

  it("does nothing when the pick dialog is cancelled", async () => {
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });

    await new SwitchRecentProjectPaletteCommand().callback();

    expect(loadCurrentTrackerRepoByPathMock).not.toHaveBeenCalled();
    expect(refreshIssueListsMock).not.toHaveBeenCalled();
  });
});
