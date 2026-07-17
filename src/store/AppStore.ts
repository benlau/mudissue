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
  options?: { project?: string; attachmentPath?: string },
): IssueViewerPage {
  return {
    name: "ISSUE_VIEWER",
    args: {
      issue,
      ...(options?.project !== undefined ? { project: options.project } : {}),
      ...(options?.attachmentPath !== undefined
        ? { attachmentPath: options.attachmentPath }
        : {}),
    },
  };
}

export type AppStoreState = {
  mainIssueLists: IssueFolder[] | null;
  pinnedIssueIds: string[];
  filter: string | null;
  navigationStack: NavigationStack;
  selectedIssueId: string | null;
  /** When set, table range selection is active; anchor is fixed, focus follows selectedIssueId. */
  tableRangeSelectionAnchorIssueId: string | null;
  searchRestoreIssueId: string | null;
  isLoadingIssueList: boolean;
  debug: boolean;
  setDebug: (debug: boolean) => void;
  setSelectedIssueId: (issueId: string | null) => void;
  toggleTableRangeSelection: () => void;
  clearTableRangeSelection: () => void;
  reset: () => void;
  refreshIssueLists: () => Promise<IssueFolder[]>;
  searchIssues: (filter: string | null) => Promise<void>;
  pushIssueViewer: (
    issue: IssueFolder,
    options?: { project?: string; attachmentPath?: string },
  ) => void;
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
  pinnedIssueIds: [] as string[],
  filter: null as string | null,
  navigationStack: INITIAL_NAVIGATION_STACK,
  selectedIssueId: null as string | null,
  tableRangeSelectionAnchorIssueId: null as string | null,
  searchRestoreIssueId: null as string | null,
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

    setSelectedIssueId: (issueId) => {
      set((draft) => {
        draft.selectedIssueId = issueId;
      });
    },

    toggleTableRangeSelection: () => {
      const {
        mainIssueLists,
        selectedIssueId,
        tableRangeSelectionAnchorIssueId,
      } = get();
      if (tableRangeSelectionAnchorIssueId != null) {
        set((draft) => {
          draft.tableRangeSelectionAnchorIssueId = null;
        });
        return;
      }
      if (
        mainIssueLists == null ||
        mainIssueLists.length === 0 ||
        selectedIssueId == null
      ) {
        return;
      }
      set((draft) => {
        draft.tableRangeSelectionAnchorIssueId = selectedIssueId;
      });
    },

    clearTableRangeSelection: () => {
      set((draft) => {
        draft.tableRangeSelectionAnchorIssueId = null;
      });
    },

    reset: () => {
      set((draft) => {
        draft.filter = null;
        draft.searchRestoreIssueId = null;
        draft.tableRangeSelectionAnchorIssueId = null;
      });
    },

    refreshIssueLists: async () => {
      const { filter } = get();
      const repoList = await useCurrentTrackerRepoStore
        .getState()
        .getTrackerRepoList();
      const rootRepo = repoList[0];
      const pinnedIssueIds =
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
        draft.pinnedIssueIds = pinnedIssueIds;
      });
      return list;
    },

    searchIssues: async (newFilter: string | null) => {
      const normalized =
        newFilter != null && newFilter.trim() !== "" ? newFilter.trim() : null;
      const { filter, selectedIssueId, searchRestoreIssueId } = get();
      const wasSearching = filter != null && filter.trim() !== "";
      const list = await IssueSearchStoreFactory.createOrGet(
        IssueSearchStoreKey.IssueTable,
      )
        .getState()
        .searchAllFolders(normalized);
      set((draft) => {
        draft.filter = normalized;
        draft.mainIssueLists = list;
        draft.tableRangeSelectionAnchorIssueId = null;
        if (normalized != null) {
          draft.searchRestoreIssueId = wasSearching
            ? searchRestoreIssueId
            : selectedIssueId;
          draft.selectedIssueId = list[0]?.issueId ?? null;
        } else {
          draft.selectedIssueId = searchRestoreIssueId ?? selectedIssueId;
          draft.searchRestoreIssueId = null;
        }
      });
    },

    pushIssueViewer: (
      issue: IssueFolder,
      options?: { project?: string; attachmentPath?: string },
    ) => {
      const viewerPage = buildIssueViewerPage(issue, options);
      set((draft) => {
        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .push(viewerPage)
          .get();
        draft.selectedIssueId = issue.issueId;
        draft.tableRangeSelectionAnchorIssueId = null;
      });
    },

    replaceIssueViewer: (
      issue: IssueFolder,
      options?: { project?: string },
    ) => {
      const viewerPage = buildIssueViewerPage(issue, options);
      set((draft) => {
        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .replaceTop(viewerPage)
          .get();
        draft.selectedIssueId = issue.issueId;
      });
    },

    popNavigation: () => {
      set((draft) => {
        const closingPage = accessNavigationStack(
          draft.navigationStack,
        ).getCurrentPage();
        let closingIssueId: string | null = null;
        if (closingPage.name === "ISSUE_VIEWER") {
          closingIssueId = closingPage.args.issue.issueId;
        }

        draft.navigationStack = accessNavigationStack(draft.navigationStack)
          .pop()
          .get();

        const newPage = accessNavigationStack(
          draft.navigationStack,
        ).getCurrentPage();
        if (newPage.name === "ISSUE_VIEWER") {
          draft.selectedIssueId = newPage.args.issue.issueId;
        } else if (closingIssueId != null) {
          draft.selectedIssueId = closingIssueId;
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
        (issue) => issue.issueId === active.issueId,
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
        (issue) => issue.issueId === active.issueId,
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
        if (currentPage.args.attachmentPath != null) {
          return [];
        }
        return [currentPage.args.issue];
      }
      const {
        mainIssueLists,
        selectedIssueId,
        tableRangeSelectionAnchorIssueId,
      } = get();
      if (mainIssueLists == null || selectedIssueId == null) {
        return [];
      }
      if (tableRangeSelectionAnchorIssueId != null) {
        const anchorIdx = mainIssueLists.findIndex(
          (item) => item.issueId === tableRangeSelectionAnchorIssueId,
        );
        const focusIdx = mainIssueLists.findIndex(
          (item) => item.issueId === selectedIssueId,
        );
        if (anchorIdx >= 0 && focusIdx >= 0) {
          const lo = Math.min(anchorIdx, focusIdx);
          const hi = Math.max(anchorIdx, focusIdx);
          return mainIssueLists.slice(lo, hi + 1);
        }
      }
      const selected = mainIssueLists.find(
        (item) => item.issueId === selectedIssueId,
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
        const pinnedIssueIds = await registryService.getPinnedIssueFolderNames(
          repo.projectPath,
        );
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
              pinnedIssueIds,
              statusList,
              priorityList: priorityTable.priorities,
            })
            .get();
          draft.pinnedIssueIds = pinnedIssueIds;
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
