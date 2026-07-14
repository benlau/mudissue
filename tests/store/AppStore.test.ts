import { jest } from "@jest/globals";
import * as path from "path";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import type { IssueSearchStoreState } from "../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../src/store/IssueSearchStore.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import { usePopupStore } from "../../src/store/PopupStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { useToastStore } from "../../src/store/ToastStore.ts";
import { ISSUE_TABLE_PAGE } from "../../src/types/page.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../fixture/navigationStack.ts";

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

import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

function buildIssue(
  label: string,
  overrides?: Parameters<typeof buildIssueFolder>[1],
): IssueFolder {
  const issueId =
    overrides?.path != null
      ? path.basename(overrides.path)
      : `${label}-sample`;
  return buildIssueFolder(issueId, {
    label,
    title: `${label} title`,
    status: "open",
    ...overrides,
  });
}

function viewerPageStack(issue: IssueFolder, project?: string) {
  return viewerNavigationStack(issue, project);
}

function currentViewerIssue(): IssueFolder | null {
  const page = useAppStore.getState().getCurrentPage();
  return page.name === "ISSUE_VIEWER" ? page.args.issue : null;
}

function mockIssueSearchStore(state: IssueSearchStoreState): IssueSearchStore {
  return {
    getState: () => state,
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  } as IssueSearchStore;
}

describe("AppStore", () => {
  const originalEnvEditor = process.env.MUDISSUE_EDITOR;

  beforeEach(() => {
    resetAppStore();
    resetGlobalConfigStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    delete process.env.MUDISSUE_EDITOR;
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([]),
      }),
    );
  });

  afterEach(() => {
    if (originalEnvEditor === undefined) {
      delete process.env.MUDISSUE_EDITOR;
    } else {
      process.env.MUDISSUE_EDITOR = originalEnvEditor;
    }
    jest.restoreAllMocks();
    ShellService.setInstance(null);
    resetAppStore();
    resetGlobalConfigStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("reset clears data slice", () => {
    useAppStore.setState({
      filter: "x",
      selectedIssueId: "MI0001-sample",
      searchRestoreIssueId: "MI0002-sample",
      isLoadingIssueList: true,
    });
    resetAppStore();
    expect(useAppStore.getState().filter).toBeNull();
    expect(useAppStore.getState().mainIssueLists).toBeNull();
    expect(useAppStore.getState().navigationStack).toEqual(
      INITIAL_NAVIGATION_STACK,
    );
    expect(currentViewerIssue()).toBeNull();
    expect(useAppStore.getState().selectedIssueId).toBeNull();
    expect(useAppStore.getState().searchRestoreIssueId).toBeNull();
    expect(useAppStore.getState().isLoadingIssueList).toBe(false);
  });

  it("searchIssues updates filter and mainIssueLists", async () => {
    createMockSystemContext();

    await useAppStore.getState().searchIssues("bar");

    expect(useAppStore.getState().filter).toBe("bar");
    expect(useAppStore.getState().mainIssueLists).toEqual([]);
  });

  it("searchIssues selects the first search result and remembers the original selection", async () => {
    createMockSystemContext();
    const searchResults = [buildIssue("MI0004"), buildIssue("MI0005")];
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn(async () => searchResults),
      }),
    );
    useAppStore.setState({
      selectedIssueId: "MI0003-sample",
    });

    await useAppStore.getState().searchIssues("status:open");

    expect(useAppStore.getState().filter).toBe("status:open");
    expect(useAppStore.getState().mainIssueLists).toEqual([
      buildIssue("MI0004"),
      buildIssue("MI0005"),
    ]);
    expect(useAppStore.getState().selectedIssueId).toBe("MI0004-sample");
    expect(useAppStore.getState().searchRestoreIssueId).toBe(
      "MI0003-sample",
    );
  });

  it("searchIssues restores the original selection when clearing search", async () => {
    createMockSystemContext();
    jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
      mockIssueSearchStore({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn(async () => [
          buildIssue("MI0001"),
          buildIssue("MI0002"),
          buildIssue("MI0003"),
        ]),
      }),
    );
    useAppStore.setState({
      filter: "status:open",
      selectedIssueId: "MI0001-sample",
      searchRestoreIssueId: "MI0003-sample",
    });

    await useAppStore.getState().searchIssues(null);

    expect(useAppStore.getState().filter).toBeNull();
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");
    expect(useAppStore.getState().searchRestoreIssueId).toBeNull();
  });

  it("openIssue selects the active issue and closeIssue keeps it selected", () => {
    const issue = buildIssue("MI0002");
    useAppStore.setState({ mainIssueLists: [issue] });

    useAppStore.getState().openIssue(issue);
    expect(currentViewerIssue()?.issueId).toBe("MI0002-sample");
    expect(useAppStore.getState().navigationStack).toEqual(
      viewerPageStack(issue),
    );
    expect(useAppStore.getState().selectedIssueId).toBe("MI0002-sample");

    useAppStore.getState().closeIssue();
    expect(currentViewerIssue()).toBeNull();
    expect(useAppStore.getState().navigationStack).toEqual(
      INITIAL_NAVIGATION_STACK,
    );
    expect(useAppStore.getState().selectedIssueId).toBe("MI0002-sample");
  });

  describe("getSelectedIssues", () => {
    it("returns viewer issue when the viewer is open", () => {
      const issue = buildIssue("MI0002");
      useAppStore.setState({
        mainIssueLists: [buildIssue("MI0001"), issue],
        selectedIssueId: "MI0001-sample",
        navigationStack: viewerPageStack(issue),
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual([issue]);
    });

    it("returns the selected table row when the viewer is closed", () => {
      const issue = buildIssue("MI0002");
      useAppStore.setState({
        mainIssueLists: [buildIssue("MI0001"), issue],
        selectedIssueId: issue.issueId,
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual([issue]);
    });

    it("returns an empty array when there is no selection", () => {
      useAppStore.setState({
        mainIssueLists: [buildIssue("MI0001")],
        selectedIssueId: null,
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual([]);
    });

    it("returns a contiguous range when table range selection is active", () => {
      const issues = [
        buildIssue("MI0001"),
        buildIssue("MI0002"),
        buildIssue("MI0003"),
        buildIssue("MI0004"),
      ];
      useAppStore.setState({
        mainIssueLists: issues,
        selectedIssueId: issues[2]!.issueId,
        tableRangeSelectionAnchorIssueId: issues[1]!.issueId,
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual([
        issues[1],
        issues[2],
      ]);
    });

    it("returns range in list order when anchor is below focus", () => {
      const issues = [
        buildIssue("MI0001"),
        buildIssue("MI0002"),
        buildIssue("MI0003"),
      ];
      useAppStore.setState({
        mainIssueLists: issues,
        selectedIssueId: issues[0]!.issueId,
        tableRangeSelectionAnchorIssueId: issues[2]!.issueId,
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual(issues);
    });

    it("returns viewer issue instead of table range when viewer is open", () => {
      const issues = [
        buildIssue("MI0001"),
        buildIssue("MI0002"),
        buildIssue("MI0003"),
      ];
      const viewing = issues[1]!;
      useAppStore.setState({
        mainIssueLists: issues,
        selectedIssueId: issues[2]!.issueId,
        tableRangeSelectionAnchorIssueId: issues[0]!.issueId,
        navigationStack: viewerPageStack(viewing),
      });

      expect(useAppStore.getState().getSelectedIssues()).toEqual([viewing]);
    });
  });

  describe("table range selection", () => {
    it("toggleTableRangeSelection sets and clears the anchor", () => {
      const issues = [buildIssue("MI0001"), buildIssue("MI0002")];
      useAppStore.setState({
        mainIssueLists: issues,
        selectedIssueId: issues[1]!.issueId,
      });

      useAppStore.getState().toggleTableRangeSelection();
      expect(useAppStore.getState().tableRangeSelectionAnchorIssueId).toBe(
        issues[1]!.issueId,
      );

      useAppStore.getState().toggleTableRangeSelection();
      expect(
        useAppStore.getState().tableRangeSelectionAnchorIssueId,
      ).toBeNull();
    });

    it("searchIssues clears the table range anchor", async () => {
      const allIssues = [buildIssue("MI0001"), buildIssue("MI0002")];
      const filtered = [buildIssue("MI0002")];
      const searchAllFolders = jest
        .fn<() => Promise<IssueFolder[]>>()
        .mockResolvedValueOnce(filtered)
        .mockResolvedValueOnce(allIssues);
      jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue(
        mockIssueSearchStore({
          savedSearchResults: [],
          searchFolders: jest.fn(),
          searchAllFolders,
        }),
      );

      useAppStore.setState({
        mainIssueLists: allIssues,
        selectedIssueId: allIssues[1]!.issueId,
        tableRangeSelectionAnchorIssueId: allIssues[0]!.issueId,
      });

      await useAppStore.getState().searchIssues("foo");
      expect(
        useAppStore.getState().tableRangeSelectionAnchorIssueId,
      ).toBeNull();
      expect(useAppStore.getState().getSelectedIssues()).toHaveLength(1);

      useAppStore.setState({
        tableRangeSelectionAnchorIssueId: filtered[0]!.issueId,
        selectedIssueId: filtered[0]!.issueId,
      });
      await useAppStore.getState().searchIssues(null);
      expect(
        useAppStore.getState().tableRangeSelectionAnchorIssueId,
      ).toBeNull();
    });

    it("openIssue clears the table range anchor", () => {
      const issues = [buildIssue("MI0001"), buildIssue("MI0002")];
      useAppStore.setState({
        mainIssueLists: issues,
        selectedIssueId: issues[0]!.issueId,
        tableRangeSelectionAnchorIssueId: issues[0]!.issueId,
      });

      useAppStore.getState().openIssue(issues[1]!);
      expect(
        useAppStore.getState().tableRangeSelectionAnchorIssueId,
      ).toBeNull();
    });
  });

  it("openPreviousIssue moves to previous issue and shows a toast at first issue", () => {
    const issues = [
      buildIssue("MI0001"),
      buildIssue("MI0002"),
      buildIssue("MI0003"),
    ];
    useAppStore.setState({
      mainIssueLists: issues,
      navigationStack: viewerPageStack(issues[1]!),
      selectedIssueId: issues[1]!.issueId,
    });

    useAppStore.getState().openPreviousIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0001-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0001-sample");

    useAppStore.getState().openPreviousIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0001-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0001-sample");
    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: expect.any(String),
      variant: "info",
      position: "top-middle",
    });
    useToastStore.getState().close();
  });

  it("openNextIssue moves to next issue and shows a toast at last issue", () => {
    const issues = [
      buildIssue("MI0001"),
      buildIssue("MI0002"),
      buildIssue("MI0003"),
    ];
    useAppStore.setState({
      mainIssueLists: issues,
      navigationStack: viewerPageStack(issues[1]!),
      selectedIssueId: issues[1]!.issueId,
    });

    useAppStore.getState().openNextIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0003-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");

    useAppStore.getState().openNextIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0003-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");
    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: expect.any(String),
      variant: "info",
      position: "top-middle",
    });
    useToastStore.getState().close();
  });

  it("openPreviousIssue and openNextIssue navigate within the search result list", () => {
    const searchResults = [
      buildIssue("MI0001"),
      buildIssue("MI0003"),
      buildIssue("MI0005"),
    ];
    useAppStore.setState({
      filter: "status:open",
      mainIssueLists: searchResults,
      navigationStack: viewerPageStack(searchResults[1]!),
      selectedIssueId: searchResults[1]!.issueId,
    });

    useAppStore.getState().openNextIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0005-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0005-sample");

    useAppStore.getState().openPreviousIssue();
    expect(currentViewerIssue()?.issueId).toBe("MI0003-sample");
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");
  });

  it("openPreviousIssue and openNextIssue are no-op when active issue is null", () => {
    const issues = [buildIssue("MI0001"), buildIssue("MI0002")];
    useAppStore.setState({
      mainIssueLists: issues,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useAppStore.getState().openPreviousIssue();
    expect(currentViewerIssue()).toBeNull();

    useAppStore.getState().openNextIssue();
    expect(currentViewerIssue()).toBeNull();
  });

  it("openPreviousIssue and openNextIssue are no-op when issue list is empty", () => {
    const viewingIssue = buildIssue("MI0001");
    useAppStore.setState({
      mainIssueLists: [],
      navigationStack: viewerPageStack(viewingIssue),
      selectedIssueId: viewingIssue.issueId,
    });

    useAppStore.getState().openPreviousIssue();
    expect(useAppStore.getState().getCurrentPage()).toEqual(
      viewerPageStack(viewingIssue)[1]!,
    );

    useAppStore.getState().openNextIssue();
    expect(useAppStore.getState().getCurrentPage()).toEqual(
      viewerPageStack(viewingIssue)[1]!,
    );
  });

  it("openNextIssue advances by folder when multiple issues share a label", () => {
    const first: IssueFolder = buildIssueFolder("AB0001-hello-world", {
      path: "/tmp/AB0001-hello-world",
      title: "Hello",
      status: "open",
    });
    const second: IssueFolder = buildIssueFolder("AB0001-start", {
      path: "/tmp/AB0001-start",
      title: "Start",
      status: "open",
    });
    useAppStore.setState({
      mainIssueLists: [first, second],
      navigationStack: viewerPageStack(first),
      selectedIssueId: first.issueId,
    });

    useAppStore.getState().openNextIssue();

    expect(currentViewerIssue()?.issueId).toBe(
      "AB0001-start",
    );
    expect(useAppStore.getState().selectedIssueId).toBe("AB0001-start");
  });

  it("openPreviousIssue and openNextIssue are no-op when active issue is not in the list", () => {
    const viewingIssue = buildIssue("MI0003");
    useAppStore.setState({
      mainIssueLists: [buildIssue("MI0001"), buildIssue("MI0002")],
      navigationStack: viewerPageStack(viewingIssue),
      selectedIssueId: "MI0003-sample",
    });

    useAppStore.getState().openPreviousIssue();
    expect(useAppStore.getState().getCurrentPage()).toEqual(
      viewerPageStack(viewingIssue)[1]!,
    );
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");

    useAppStore.getState().openNextIssue();
    expect(useAppStore.getState().getCurrentPage()).toEqual(
      viewerPageStack(viewingIssue)[1]!,
    );
    expect(useAppStore.getState().selectedIssueId).toBe("MI0003-sample");
  });

  describe("applyIssueMetadataUpdate", () => {
    it("patches mainIssueLists when metadata changes", () => {
      const issue = buildIssue("MI0001");
      const other = buildIssue("MI0002");
      useAppStore.setState({
        mainIssueLists: [issue, other],
        navigationStack: viewerPageStack(issue),
        selectedIssueId: issue.issueId,
      });

      const updatedAt = new Date("2026-05-10");
      useAppStore.getState().applyIssueMetadataUpdate("MI0001-sample", {
        title: "Revised title",
        status: "closed",
        priority: "high",
        updatedAt,
      });

      const state = useAppStore.getState();
      expect(state.mainIssueLists?.[0]).toMatchObject({
        issueId: "MI0001-sample",
        metadata: {
          title: "Revised title",
          status: "closed",
          priority: "high",
          updatedAt,
        },
      });
      expect(state.mainIssueLists?.[1]).toEqual(other);
      expect(currentViewerIssue()).toMatchObject({
        issueId: "MI0001-sample",
        metadata: {
          title: "Revised title",
          status: "closed",
          priority: "high",
          updatedAt,
        },
      });
      expect(state.selectedIssueId).toBe("MI0001-sample");
    });

    it("re-sorts mainIssueLists when updatedAt changes", async () => {
      const older = buildIssue("MI0001", {
        updatedAt: new Date("2026-01-01"),
      });
      const newer = buildIssue("MI0002", {
        updatedAt: new Date("2026-05-01"),
      });
      useAppStore.setState({
        mainIssueLists: [older, newer],
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      const mockRepo = {
        name: "proj",
        projectPath: "/repo",
        trackerPath: "/repo",
        config: { issue_path: "issues" },
      };
      useCurrentTrackerRepoStore.setState({
        getCurrentTrackerRepo: jest.fn().mockResolvedValue(mockRepo),
        getStatusList: jest.fn().mockResolvedValue([]),
        getPriorityTable: jest.fn().mockResolvedValue({
          initialPriority: "urgent",
          priorities: [],
        }),
      });
      jest
        .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
        .mockResolvedValue({ field: "updated_at", order: "desc" });

      useAppStore.getState().applyIssueMetadataUpdate("MI0001-sample", {
        title: older.metadata?.title,
        status: older.metadata?.status,
        priority: older.metadata?.priority,
        updatedAt: new Date("2026-06-01"),
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(
        useAppStore.getState().mainIssueLists?.map((i) => i.issueId),
      ).toEqual(["MI0001-sample", "MI0002-sample"]);
    });

    it("keeps list order when only non-sort fields change under default sort", async () => {
      const updatedAt = new Date("2026-03-01");
      const first = buildIssue("MI0001", {
        updatedAt,
      });
      const second = buildIssue("MI0002", {
        updatedAt: new Date("2026-05-01"),
      });
      useAppStore.setState({
        mainIssueLists: [second, first],
        navigationStack: INITIAL_NAVIGATION_STACK,
      });

      const mockRepo = {
        name: "proj",
        projectPath: "/repo",
        trackerPath: "/repo",
        config: { issue_path: "issues" },
      };
      useCurrentTrackerRepoStore.setState({
        getCurrentTrackerRepo: jest.fn().mockResolvedValue(mockRepo),
        getStatusList: jest.fn().mockResolvedValue([]),
        getPriorityTable: jest.fn().mockResolvedValue({
          initialPriority: "urgent",
          priorities: [],
        }),
      });
      jest
        .spyOn(RegistryService.getInstance(), "getIssueListSortOrder")
        .mockResolvedValue({ field: "updated_at", order: "desc" });

      useAppStore.getState().applyIssueMetadataUpdate("MI0001-sample", {
        title: "New title only",
        status: first.metadata?.status,
        priority: first.metadata?.priority,
        updatedAt,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(
        useAppStore.getState().mainIssueLists?.map((i) => i.issueId),
      ).toEqual(["MI0002-sample", "MI0001-sample"]);
      expect(useAppStore.getState().mainIssueLists?.[1]?.metadata?.title).toBe(
        "New title only",
      );
    });

    it("updates viewer page metadata when mainIssueLists is null", () => {
      const issue = buildIssue("MI0001");
      useAppStore.setState({
        mainIssueLists: null,
        navigationStack: viewerPageStack(issue),
      });

      const updatedAt = new Date("2026-05-10");
      useAppStore.getState().applyIssueMetadataUpdate("MI0001-sample", {
        title: "X",
        status: "open",
        updatedAt,
      });

      expect(useAppStore.getState().mainIssueLists).toBeNull();
      expect(currentViewerIssue()).toMatchObject({
        issueId: "MI0001-sample",
        metadata: {
          title: "X",
          status: "open",
          updatedAt,
        },
      });
    });
  });

  describe("navigation history", () => {
    it("pushIssueViewer builds nested viewer layers for link traversal", () => {
      const issueA = buildIssue("MI0001");
      const issueB = buildIssue("MI0002");
      const issueC = buildIssue("MI0003");
      useAppStore.setState({
        mainIssueLists: [issueA, issueB, issueC],
      });

      useAppStore.getState().pushIssueViewer(issueA);
      useAppStore.getState().pushIssueViewer(issueB);
      useAppStore.getState().pushIssueViewer(issueC);

      expect(useAppStore.getState().navigationStack).toEqual([
        ISSUE_TABLE_PAGE,
        { name: "ISSUE_VIEWER", args: { issue: issueA } },
        { name: "ISSUE_VIEWER", args: { issue: issueB } },
        { name: "ISSUE_VIEWER", args: { issue: issueC } },
      ]);
      expect(currentViewerIssue()?.issueId).toBe("MI0003-sample");

      useAppStore.getState().popNavigation();
      expect(currentViewerIssue()?.issueId).toBe("MI0002-sample");

      useAppStore.getState().popNavigation();
      expect(currentViewerIssue()?.issueId).toBe("MI0001-sample");

      useAppStore.getState().popNavigation();
      expect(currentViewerIssue()).toBeNull();
      expect(useAppStore.getState().navigationStack).toEqual(
        INITIAL_NAVIGATION_STACK,
      );
    });

    it("replaceIssueViewer keeps history depth for prev and next navigation", () => {
      const issues = [
        buildIssue("MI0001"),
        buildIssue("MI0002"),
        buildIssue("MI0003"),
      ];
      useAppStore.setState({
        mainIssueLists: issues,
        navigationStack: viewerPageStack(issues[1]!),
        selectedIssueId: issues[1]!.issueId,
      });

      useAppStore.getState().replaceIssueViewer(issues[2]!);

      expect(useAppStore.getState().navigationStack).toHaveLength(2);
      expect(currentViewerIssue()?.issueId).toBe("MI0003-sample");
    });

    it("pushIssueViewer opens an issue outside the filtered list without clearing search", () => {
      const filtered = buildIssue("MI0001");
      const outside = buildIssue("MI0002");
      useAppStore.setState({
        filter: "status:open",
        mainIssueLists: [filtered],
        selectedIssueId: filtered.issueId,
        searchRestoreIssueId: "MI0003-sample",
      });

      useAppStore.getState().pushIssueViewer(outside);

      expect(useAppStore.getState().filter).toBe("status:open");
      expect(useAppStore.getState().mainIssueLists).toEqual([filtered]);
      expect(currentViewerIssue()).toEqual(outside);
      expect(useAppStore.getState().getSelectedIssues()).toEqual([outside]);
      expect(useAppStore.getState().getCurrentPage()).toEqual({
        name: "ISSUE_VIEWER",
        args: { issue: outside },
      });
    });

    it("resetToIssueTable clears nested viewer history", () => {
      const issues = [buildIssue("MI0001"), buildIssue("MI0002")];
      useAppStore.setState({
        mainIssueLists: issues,
      });
      useAppStore.getState().pushIssueViewer(issues[0]!);
      useAppStore.getState().pushIssueViewer(issues[1]!);

      useAppStore.getState().resetToIssueTable();

      expect(useAppStore.getState().navigationStack).toEqual(
        INITIAL_NAVIGATION_STACK,
      );
      expect(currentViewerIssue()).toBeNull();
    });
  });
});
