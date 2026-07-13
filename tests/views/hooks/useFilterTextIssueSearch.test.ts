/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import { TableLayouter } from "../../../src/foundation/layouter/TableLayouter.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
} from "../../../src/store/IssueSearchStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TableColumnDef } from "../../../src/types/TableLayout.ts";
import {
  createFilterTextDialogStore,
  type FilterTextDialogStore,
} from "../../../src/views/components/FilterTextDialog.tsx";
import { useFilterTextIssueSearch } from "../../../src/views/hooks/useFilterTextIssueSearch.ts";

const ISSUE_SEARCH_COLUMNS: TableColumnDef[] = [
  { minWidth: 20, maxWidth: 36, grow: 0 },
  { minWidth: 20, grow: 1 },
];

const sampleIssues: IssueFolder[] = [
  {
    issueId: "0001",
    folderName: "0001-alpha",
    path: "/repo/issues/0001-alpha",
    metadata: { title: "Alpha issue" },
  },
  {
    issueId: "0002",
    folderName: "0002-beta",
    path: "/repo/issues/0002-beta",
    metadata: { title: "Beta issue" },
  },
];

describe("useFilterTextIssueSearch", () => {
  let filterStore: FilterTextDialogStore;
  let tableLayouter: TableLayouter;
  let mockSearchAllFolders: jest.Mock<
    (
      filter: string | null,
      options?: { matchedIdFirst?: boolean },
    ) => Promise<IssueFolder[]>
  >;

  beforeEach(() => {
    jest.useFakeTimers();
    filterStore = createFilterTextDialogStore();
    tableLayouter = new TableLayouter(ISSUE_SEARCH_COLUMNS);
    mockSearchAllFolders = jest
      .fn<
        (
          filter: string | null,
          options?: { matchedIdFirst?: boolean },
        ) => Promise<IssueFolder[]>
      >()
      .mockResolvedValue(sampleIssues);
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
      getState: () => ({ searchAllFolders: mockSearchAllFolders }),
    } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function renderIssueSearch(
    excludeFolderNames?: ReadonlySet<string>,
    matchedIdFirst?: boolean,
  ) {
    return renderHook(() =>
      useFilterTextIssueSearch({
        filterStore,
        contentWidthForTable: 40,
        tableLayouter,
        searchStoreKey: IssueSearchStoreKey.LinkPalette,
        excludeFolderNames,
        matchedIdFirst,
      }),
    );
  }

  it("debounces search and applies choices to the filter store", async () => {
    const { result } = renderIssueSearch();

    act(() => {
      result.current.search("alpha");
    });
    expect(mockSearchAllFolders).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSearchAllFolders).toHaveBeenCalledWith("alpha", {
      matchedIdFirst: false,
    });
    expect(filterStore.getState().choices.map((choice) => choice.key)).toEqual([
      "0001-alpha",
      "0002-beta",
    ]);
    expect(result.current.getIssue("0001-alpha")?.issueId).toBe("0001");
  });

  it("passes matchedIdFirst to searchAllFolders when enabled", async () => {
    const { result } = renderIssueSearch(undefined, true);

    await act(async () => {
      result.current.search("67");
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(mockSearchAllFolders).toHaveBeenCalledWith("67", {
      matchedIdFirst: true,
    });
  });

  it("excludes folder names from choices", async () => {
    const { result } = renderIssueSearch(new Set(["0001-alpha"]));

    await act(async () => {
      result.current.search("issue");
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(filterStore.getState().choices.map((choice) => choice.key)).toEqual([
      "0002-beta",
    ]);
  });

  it("reset clears cached issue lookup", async () => {
    const { result } = renderIssueSearch();

    await act(async () => {
      result.current.search("alpha");
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(result.current.getIssue("0001-alpha")).toBeDefined();

    act(() => {
      result.current.reset();
    });
    expect(result.current.getIssue("0001-alpha")).toBeUndefined();
  });
});
