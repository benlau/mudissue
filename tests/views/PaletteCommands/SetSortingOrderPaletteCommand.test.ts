import { jest } from "@jest/globals";
import { RegistryService } from "../../../src/services/RegistryService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import { DEFAULT_SORTING_ORDER } from "../../../src/types/SortingOrder.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { SetSortingOrderPaletteCommand } from "../../../src/views/PaletteCommands/SetSortingOrderPaletteCommand.ts";

function resetToastStore(): void {
  useToastStore.setState({
    isToastOpen: false,
    message: "",
    variant: "info",
    duration: 800,
    position: "top-right",
    toastKey: 0,
    pendingResolve: null,
  });
}

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("SetSortingOrderPaletteCommand", () => {
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;
  let setIssueListSortOrderSpy: jest.SpiedFunction<
    RegistryService["setIssueListSortOrder"]
  >;
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();

    pickOpenMock = jest.fn();
    usePickItemDialogStore.setState({ open: pickOpenMock });

    refreshIssueListsMock = jest.fn().mockResolvedValue([]);
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });

    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(mockRepo),
    });

    useToastStore.setState({
      info: jest.fn().mockResolvedValue(undefined),
    });

    setIssueListSortOrderSpy = jest.spyOn(
      RegistryService.getInstance(),
      "setIssueListSortOrder",
    );
    jest
      .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
      .mockResolvedValue({ ...DEFAULT_SORTING_ORDER });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();
  });

  it("marks the current sort field with (*) in the field pick dialog", async () => {
    pickOpenMock.mockImplementationOnce(async (items, getDisplay) => {
      const lastModified = (
        items as Array<{ field: string; label: string }>
      ).find((i) => i.field === "updated_at");
      expect(lastModified).toBeDefined();
      expect(getDisplay(lastModified!)).toBe("(*) Last updated date");

      const idField = (items as Array<{ field: string; label: string }>).find(
        (i) => i.field === "id",
      );
      expect(getDisplay(idField!)).toBe("Issue ID");

      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new SetSortingOrderPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("persists sort order and refreshes the issue list when confirmed", async () => {
    pickOpenMock
      .mockResolvedValueOnce({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: { field: "title" as const, label: "Title" },
      })
      .mockResolvedValueOnce({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: { order: "asc" as const, label: "Ascending" },
      });

    setIssueListSortOrderSpy.mockResolvedValue(undefined);

    await new SetSortingOrderPaletteCommand().callback();

    expect(setIssueListSortOrderSpy).toHaveBeenCalledWith(
      { field: "title", order: "asc" },
      mockRepo.projectPath,
    );
    expect(refreshIssueListsMock).toHaveBeenCalled();
  });

  it("clears table range selection anchor when sort order is changed", async () => {
    const issueA: IssueFolder = {
      issueId: "0001",
      folderName: "0001-a",
      path: "/repo/0001-a",
    };
    const issueB: IssueFolder = {
      issueId: "0002",
      folderName: "0002-b",
      path: "/repo/0002-b",
    };
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedFolderName: issueB.folderName,
      tableRangeSelectionAnchorFolderName: issueA.folderName,
    });

    pickOpenMock
      .mockResolvedValueOnce({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: { field: "title" as const, label: "Title" },
      })
      .mockResolvedValueOnce({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: { order: "asc" as const, label: "Ascending" },
      });

    setIssueListSortOrderSpy.mockResolvedValue(undefined);

    await new SetSortingOrderPaletteCommand().callback();

    expect(
      useAppStore.getState().tableRangeSelectionAnchorFolderName,
    ).toBeNull();
    expect(refreshIssueListsMock).toHaveBeenCalled();
  });

  it("does not persist when the field dialog is cancelled", async () => {
    pickOpenMock.mockImplementationOnce(async () => ({
      type: PickItemDialogResponseType.Cancelled,
    }));

    await new SetSortingOrderPaletteCommand().callback();

    expect(setIssueListSortOrderSpy).not.toHaveBeenCalled();
    expect(refreshIssueListsMock).not.toHaveBeenCalled();
  });
});
