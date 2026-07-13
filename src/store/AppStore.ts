import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  accessIssueFolder,
  accessIssueFolderList,
  type IssueFolder,
  type IssueFolderMetadata,
} from "../types/Issue.ts";
import {
  accessNavigationStack,
  INITIAL_NAVIGATION_STACK,
  type NavigationStack,
} from "../types/navigation.ts";
import { type IssueViewerPage, type Page } from "../types/page.ts";
import { useCurrentTrackerRepoStore } from "./CurrentTrackerRepoStore.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
} from "./IssueSearchStore.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { useToastStore } from "./ToastStore.ts";

function buildIssueViewerPage(
  issue: IssueFolder,
  project?: string,
): IssueViewerPage {
  return {
    name: "ISSUE_VIEWER",
    args: {
      issue,
      ...(project !== undefined ? { project } : {}),
    },
  };
}

export type AppStoreState = {
  mainIssueLists: IssueFolder[] | null;
  pinnedFolderNames: string[];
  filter: string | null;
  navigationStack: NavigationStack;
  selectedFolderName: string | null;
  /** When set, table range selection is active; anchor is fixed, focus follows selectedFolderName. */
  tableRangeSelectionAnchorFolderName: string | null;
  searchRestoreFolderName: string | null;
  isLoadingIssueList: boolean;
  debug: boolean;
  setDebug: (debug: boolean) => void;
  setSelectedFolderName: (folderName: string | null) => void;
  toggleTableRangeSelection: () => void;
  clearTableRangeSelection: () => void;
  reset: () => void;
  refreshIssueLists: () => Promise<IssueFolder[]>;
  searchIssues: (filter: string | null) => Promise<void>;
  pushIssueViewer: (issue: IssueFolder, options?: { project?: string }) => void;
  replaceIssueViewer: (
    issue: IssueFolder,
    options?: { project?: string },
  ) => void;
  popNavigation: () => void;
  resetToIssueTable: () => void;
  /** @deprecated Use pushIssueViewer */
  openIssue: (issue: IssueFolder, options?: { project?: string }) => void;
  openPreviousIssue: () => void;
  openNextIssue: () => void;
  /** @deprecated Use popNavigation */
  closeIssue: () => void;
  getCurrentPage: () => Page;
  /** Viewer issue from the navigation stack, or table row selection when no viewer is open. */
  getSelectedIssues: () => IssueFolder[];
  applyIssueMetadataUpdate: (
    issueId: string,
    metadata: IssueFolderMetadata,
  ) => void;
};

const initialDataSlice = {
  mainIssueLists: null as IssueFolder[] | null,
  pinnedFolderNames: [] as string[],
  filter: null as string | null,
  navigationStack: INITIAL_NAVIGATION_STACK,
  selectedFolderName: null as string | null,
  tableRangeSelectionAnchorFolderName: null as string | null,
  searchRestoreFolderName: null as string | null,
  isLoadingIssueList: false,
  debug: false,
};

export const useAppStore = create<AppStoreState>()(
  immer((set, get) => ({
    ...initialDataSlice,
    setDebug: (debug) => {
      set((draft) => {
        draft.debug = debug;
      });
    },

    setSelectedFolderName: (folderName) => {
      set((draft) => {
        draft.selectedFolderName = folderName;
      });
    },

    toggleTableRangeSelection: () => {
      const {
        mainIssueLists,
        selectedFolderName,
        tableRangeSelectionAnchorFolderName,
      } = get();
      if (tableRangeSelectionAnchorFolderName != null) {
        set((draft) => {
          draft.tableRangeSelectionAnchorFolderName = null;
        });
        return;
      }
      if (
        mainIssueLists == null ||
        mainIssueLists.length === 0 ||
        selectedFolderName == null
      ) {
        return;
      }
      set((draft) => {
        draft.tableRangeSelectionAnchorFolderName = selectedFolderName;
      });
    },

    clearTableRangeSelection: () => {
      set((draft) => {
        draft.tableRangeSelectionAnchorFolderName = null;
      });
    },

    reset: () => {
      set((draft) => {
        draft.filter = null;
        draft.searchRestoreFolderName = null;
        draft.tableRangeSelectionAnchorFolderName = null;
      });
    },

    refreshIssueLists: async () => {
      const { filter } = get();
      const repoList = await useCurrentTrackerRepoStore
        .getState()
        .getTrackerRepoList();
      const rootRepo = repoList[0];
      const pinnedFolderNames =
        rootRepo != null
          ? await RegistryService.getInstance().getPinnedIssueFolderNames(
              rootRepo.projectPath,
            )
          : [];
      const list = await IssueSearchStoreFactory.createOrGet(
        IssueSearchStoreKey.IssueTable,
      )
        .getState()
        .searchAllFolders(filter);
      set((draft) => {
        draft.mainIssueLists = list;
        draft.pinnedFolderNames = pinnedFolderNames;
      });
      return list;
    },

    searchIssues: async (newFilter: string | null) => {
      const normalized =
        newFilter != null && newFilter.trim() !== "" ? newFilter.trim() : null;
      const { filter, selectedFolderName, searchRestoreFolderName } = get();
      const wasSearching = filter != null && filter.trim() !== "";
      const list = await IssueSearchStoreFactory.createOrGet(
        IssueSearchStoreKey.IssueTable,
      )
        .getState()
        .searchAllFolders(normalized);
      set((draft) => {
        draft.filter = normalized;
        draft.mainIssueLists = list;
        draft.tableRangeSelectionAnchorFolderName = null;
        if (normalized != null) {
          draft.searchRestoreFolderName = wasSearching
            ? searchRestoreFolderName
            : selectedFolderName;
          draft.selectedFolderName = list[0]?.folderName ?? null;
        } else {
          draft.selectedFolderName =
            searchRestoreFolderName ?? selectedFolderName;
          draft.searchRestoreFolderName = null;
        }
      });
    },

    pushIssueViewer: (issue: IssueFolder, options?: { project?: string }) => {
      const viewerPage = buildIssueViewerPage(issue, options?.project);
      set((draft) => {
        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .push(viewerPage)
          .get();
        draft.selectedFolderName = issue.folderName;
        draft.tableRangeSelectionAnchorFolderName = null;
      });
    },

    replaceIssueViewer: (
      issue: IssueFolder,
      options?: { project?: string },
    ) => {
      const viewerPage = buildIssueViewerPage(issue, options?.project);
      set((draft) => {
        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .replaceTop(viewerPage)
          .get();
        draft.selectedFolderName = issue.folderName;
      });
    },

    popNavigation: () => {
      set((draft) => {
        const closingPage = accessNavigationStack(
          draft.navigationStack,
        ).getCurrentPage();
        let closingIssueFolderName: string | null = null;
        if (closingPage.name === "ISSUE_VIEWER") {
          closingIssueFolderName = closingPage.args.issue.folderName;
        }

        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .pop()
          .get();

        const newPage = accessNavigationStack(
          draft.navigationStack,
        ).getCurrentPage();
        if (newPage.name === "ISSUE_VIEWER") {
          draft.selectedFolderName = newPage.args.issue.folderName;
        } else if (closingIssueFolderName != null) {
          draft.selectedFolderName = closingIssueFolderName;
        }
      });
    },

    resetToIssueTable: () => {
      set((draft) => {
        draft.navigationStack = accessNavigationStack().resetToTable().get();
      });
    },

    openIssue: (issue: IssueFolder, options?: { project?: string }) => {
      get().pushIssueViewer(issue, options);
    },

    openPreviousIssue: () => {
      const { mainIssueLists: issues } = get();
      const currentPage = get().getCurrentPage();
      if (
        currentPage.name !== "ISSUE_VIEWER" ||
        !issues ||
        issues.length === 0
      ) {
        return;
      }
      const active = currentPage.args.issue;
      const currentIndex = issues.findIndex(
        (issue) => issue.folderName === active.folderName,
      );
      if (currentIndex < 0) return;
      if (currentIndex === 0) {
        void useToastStore
          .getState()
          .info("Already at the first issue.", { position: "top-middle" });
        return;
      }
      const previousIssue = issues[currentIndex - 1] ?? active;
      get().replaceIssueViewer(previousIssue);
    },

    openNextIssue: () => {
      const { mainIssueLists: issues } = get();
      const currentPage = get().getCurrentPage();
      if (
        currentPage.name !== "ISSUE_VIEWER" ||
        !issues ||
        issues.length === 0
      ) {
        return;
      }
      const active = currentPage.args.issue;
      const currentIndex = issues.findIndex(
        (issue) => issue.folderName === active.folderName,
      );
      if (currentIndex < 0) return;
      if (currentIndex === issues.length - 1) {
        void useToastStore
          .getState()
          .info("Already at the last issue.", { position: "top-middle" });
        return;
      }
      const nextIssue = issues[currentIndex + 1] ?? active;
      get().replaceIssueViewer(nextIssue);
    },

    closeIssue: () => {
      get().popNavigation();
    },

    getCurrentPage: () => {
      const { navigationStack } = get();
      return accessNavigationStack(navigationStack).getCurrentPage();
    },

    getSelectedIssues: () => {
      const currentPage = get().getCurrentPage();
      if (currentPage.name === "ISSUE_VIEWER") {
        return [currentPage.args.issue];
      }
      const {
        mainIssueLists,
        selectedFolderName,
        tableRangeSelectionAnchorFolderName,
      } = get();
      if (mainIssueLists == null || selectedFolderName == null) {
        return [];
      }
      if (tableRangeSelectionAnchorFolderName != null) {
        const anchorIdx = mainIssueLists.findIndex(
          (item) => item.folderName === tableRangeSelectionAnchorFolderName,
        );
        const focusIdx = mainIssueLists.findIndex(
          (item) => item.folderName === selectedFolderName,
        );
        if (anchorIdx >= 0 && focusIdx >= 0) {
          const lo = Math.min(anchorIdx, focusIdx);
          const hi = Math.max(anchorIdx, focusIdx);
          return mainIssueLists.slice(lo, hi + 1);
        }
      }
      const selected = mainIssueLists.find(
        (item) => item.folderName === selectedFolderName,
      );
      return selected != null ? [selected] : [];
    },

    applyIssueMetadataUpdate: (issueId, metadata) => {
      set((draft) => {
        if (draft.mainIssueLists != null) {
          draft.mainIssueLists = accessIssueFolderList(draft.mainIssueLists)
            .updateMetadata(issueId, metadata)
            .get();
        }
        draft.navigationStack = draft.navigationStack.map((page) => {
          if (
            page.name !== "ISSUE_VIEWER" ||
            page.args.issue.issueId !== issueId
          ) {
            return page;
          }
          return {
            ...page,
            args: {
              ...page.args,
              issue: accessIssueFolder(page.args.issue)
                .mergeMetadata(metadata)
                .get(),
            },
          };
        });
      });

      void (async () => {
        const { mainIssueLists } = get();
        if (mainIssueLists == null) {
          return;
        }
        const repo = await useCurrentTrackerRepoStore
          .getState()
          .getCurrentTrackerRepo();
        const registryService = RegistryService.getInstance();
        const sortingOrder = await registryService.getIssueListSortOrder(
          repo.projectPath,
        );
        const pinnedFolderNames =
          await registryService.getPinnedIssueFolderNames(repo.projectPath);
        const trackerRepoStore = useCurrentTrackerRepoStore.getState();
        const statusList = await trackerRepoStore.getStatusList(repo);
        const priorityTable = await trackerRepoStore.getPriorityTable(repo);
        set((draft) => {
          if (draft.mainIssueLists == null) {
            return;
          }
          draft.mainIssueLists = accessIssueFolderList(draft.mainIssueLists)
            .sortBy({
              orders: [sortingOrder],
              pinnedFolderNames,
              statusList,
              priorityList: priorityTable.priorities,
            })
            .get();
          draft.pinnedFolderNames = pinnedFolderNames;
        });
      })();
    },
  })),
);

export function resetAppStore(): void {
  useAppStore.setState({
    ...initialDataSlice,
    navigationStack: [...INITIAL_NAVIGATION_STACK],
  });
}
