import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import {
  IssueSearcher,
  type IssueSearchOptions,
} from "../async/search/IssueSearcher.ts";
import { SearchQueryParser } from "../async/search/SearchQueryParser.ts";
import type { ParsedSearchTerm } from "../async/search/types.ts";
import { TrackerRepoStorage } from "../async/storage/TrackerRepoStorage.ts";
import { useCurrentTrackerRepoStore } from "./CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "./GlobalConfigStore.ts";
import { RegistryService } from "../services/RegistryService.ts";
import {
  accessIssueFolderList,
  IssueFolderRowListAccessor,
  type IssueFolder,
  type IssueFolderRow,
  type IssueSortingRules,
} from "../types/Issue.ts";
import { DEFAULT_SORTING_ORDER } from "../types/SortingOrder.ts";

const issueSearcher = new IssueSearcher();
const searchQueryParser = new SearchQueryParser();

export enum IssueSearchStoreKey {
  IssueTable,
  Headless,
  LinkPalette,
  PaletteCommand,
}

export type SearchAllFoldersOptions = {
  matchedIdFirst?: boolean;
};

export type IssueSearchStoreState = {
  savedSearchResults: IssueFolder[];
  searchFolders: (
    issues: IssueFolder[],
    parsedTerms: ParsedSearchTerm[],
    options?: IssueSearchOptions,
  ) => Promise<IssueFolder[]>;
  searchAllFolders: (
    filter: string | null,
    options?: SearchAllFoldersOptions,
  ) => Promise<IssueFolder[]>;
  searchIssueTableRows: (filter: string | null) => Promise<IssueFolderRow[]>;
};

export type IssueSearchStore = StoreApi<IssueSearchStoreState>;

const globalIssueSearchStores: Partial<
  Record<IssueSearchStoreKey, IssueSearchStore>
> = {};

function createIssueSearchStore(): IssueSearchStore {
  return createStore<IssueSearchStoreState>()(
    immer((set, get) => {
      const loadIssueSearch = async (
        filter: string | null,
        options?: SearchAllFoldersOptions,
      ): Promise<{ allResults: IssueFolder[]; rules: IssueSortingRules }> => {
        const terms =
          filter != null && filter.trim() !== ""
            ? searchQueryParser.parse(filter)
            : [];

        const trackerRepoStore = useCurrentTrackerRepoStore.getState();
        const repoList = await trackerRepoStore.getTrackerRepoList();
        const globalConfig = await useGlobalConfigStore
          .getState()
          .ensureGlobalConfig();
        const allResults: IssueFolder[] = [];

        for (const repo of repoList) {
          const storage = new TrackerRepoStorage(repo, globalConfig);
          const issues = await storage.listIssues();
          const resolvedStatusList =
            await trackerRepoStore.getResolvedStatusList(repo);
          const results = await get().searchFolders(issues, terms, {
            resolvedStatusList,
          });
          allResults.push(...results);
        }

        const rootRepo = repoList[0];
        const registryService = RegistryService.getInstance();
        const sortingOrder =
          rootRepo != null
            ? await registryService.getIssueListSortOrder(rootRepo.projectPath)
            : DEFAULT_SORTING_ORDER;
        const pinnedIssueIds =
          rootRepo != null
            ? await registryService.getPinnedIssueFolderNames(
                rootRepo.projectPath,
              )
            : [];
        const statusList =
          rootRepo != null
            ? await trackerRepoStore.getStatusList(rootRepo)
            : [];
        const priorityList =
          rootRepo != null
            ? (await trackerRepoStore.getPriorityTable(rootRepo)).priorities
            : [];
        return {
          allResults,
          rules: {
            orders: [sortingOrder],
            issueSelector:
              options?.matchedIdFirst === true ? filter : undefined,
            pinnedIssueIds,
            statusList,
            priorityList,
          },
        };
      };

      return {
        savedSearchResults: [],

        searchFolders: async (issues, parsedTerms, options) =>
          issueSearcher.search(issues, parsedTerms, options),

        searchAllFolders: async (filter, options) => {
          const { allResults, rules } = await loadIssueSearch(filter, options);
          const sorted = accessIssueFolderList(allResults).sortBy(rules).get();

          set((draft) => {
            draft.savedSearchResults = sorted;
          });

          return sorted;
        },

        searchIssueTableRows: async (filter) => {
          const { allResults, rules } = await loadIssueSearch(filter);
          const groupSubissues = filter == null || filter.trim() === "";
          const rows = IssueFolderRowListAccessor.createFromIssueFolderList(
            allResults,
          )
            .sortBy(rules, { groupByParentSubissue: groupSubissues })
            .get();

          set((draft) => {
            draft.savedSearchResults = rows.map((row) => row.issueFolder);
          });

          return rows;
        },
      };
    }),
  );
}

export class IssueSearchStoreFactory {
  static createOrGet(key: IssueSearchStoreKey): IssueSearchStore {
    const existing = globalIssueSearchStores[key];
    if (existing != null) {
      return existing;
    }
    const created = createIssueSearchStore();
    globalIssueSearchStores[key] = created;
    return created;
  }
}

export function resetIssueSearchStore(key?: IssueSearchStoreKey): void {
  if (key != null) {
    globalIssueSearchStores[key]?.setState({ savedSearchResults: [] });
    return;
  }
  for (const storeKey of Object.values(IssueSearchStoreKey).filter(
    (v): v is IssueSearchStoreKey => typeof v === "number",
  )) {
    globalIssueSearchStores[storeKey]?.setState({ savedSearchResults: [] });
  }
}
