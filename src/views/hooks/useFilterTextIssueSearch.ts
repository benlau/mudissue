import { useCallback, useMemo, useRef } from "react";
import {
  IssueSearchStoreFactory,
  type IssueSearchStoreKey,
} from "../../store/IssueSearchStore.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import type {
  Choice,
  FilterTextDialogStore,
} from "../components/FilterTextDialog.tsx";
import { useDebounce } from "./useDebounce.ts";

const ISSUE_SEARCH_DEBOUNCE_MS = 250;

export type UseFilterTextIssueSearchOptions = {
  filterStore: FilterTextDialogStore;
  contentWidthForTable: number;
  tableLayouter: TableLayouter;
  searchStoreKey: IssueSearchStoreKey;
  excludeFolderNames?: ReadonlySet<string>;
  matchedIdFirst?: boolean;
};

export type UseFilterTextIssueSearchResult = {
  search: (filterQuery: string) => void;
  cancel: () => void;
  reset: () => void;
  getIssue: (folderName: string) => IssueFolder | undefined;
};

function formatIssueTitle(title: string): string {
  return title.replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "");
}

function buildIssueChoices(
  issues: IssueFolder[],
  excludeFolderNames: ReadonlySet<string>,
  contentWidth: number,
  tableLayouter: TableLayouter,
): { choices: Choice[]; issueByFolderName: Map<string, IssueFolder> } {
  tableLayouter.layout(contentWidth);
  const issueByFolderName = new Map<string, IssueFolder>();
  const choices: Choice[] = [];
  for (const issue of issues) {
    if (excludeFolderNames.has(issue.issueId)) {
      continue;
    }
    issueByFolderName.set(issue.issueId, issue);
    choices.push({
      key: issue.issueId,
      text: tableLayouter.makeRow([
        issue.issueId,
        formatIssueTitle(issue.metadata?.title?.trim() ?? ""),
      ]),
    });
  }
  return { choices, issueByFolderName };
}

export function useFilterTextIssueSearch({
  filterStore,
  contentWidthForTable,
  tableLayouter,
  searchStoreKey,
  excludeFolderNames = new Set(),
  matchedIdFirst = false,
}: UseFilterTextIssueSearchOptions): UseFilterTextIssueSearchResult {
  const issueByFolderNameRef = useRef(new Map<string, IssueFolder>());
  const latestSearchQueryRef = useRef("");
  const excludeFolderNamesRef = useRef(excludeFolderNames);
  excludeFolderNamesRef.current = excludeFolderNames;

  const runSearch = useCallback(
    async (filterQuery: string) => {
      latestSearchQueryRef.current = filterQuery;
      const results = await IssueSearchStoreFactory.createOrGet(searchStoreKey)
        .getState()
        .searchAllFolders(filterQuery.trim() === "" ? null : filterQuery, {
          matchedIdFirst,
        });
      if (latestSearchQueryRef.current !== filterQuery) {
        return;
      }
      const { choices, issueByFolderName } = buildIssueChoices(
        results,
        excludeFolderNamesRef.current,
        contentWidthForTable,
        tableLayouter,
      );
      issueByFolderNameRef.current = issueByFolderName;
      filterStore.getState().setChoiceList(choices);
    },
    [
      contentWidthForTable,
      filterStore,
      matchedIdFirst,
      searchStoreKey,
      tableLayouter,
    ],
  );

  const { run: debouncedSearch, cancel } = useDebounce(
    ISSUE_SEARCH_DEBOUNCE_MS,
    runSearch,
  );

  const search = useCallback(
    (filterQuery: string) => {
      latestSearchQueryRef.current = filterQuery;
      debouncedSearch(filterQuery);
    },
    [debouncedSearch],
  );

  const reset = useCallback(() => {
    issueByFolderNameRef.current = new Map();
    latestSearchQueryRef.current = "";
  }, []);

  const getIssue = useCallback((folderName: string) => {
    return issueByFolderNameRef.current.get(folderName);
  }, []);

  return useMemo(
    () => ({
      search,
      cancel,
      reset,
      getIssue,
    }),
    [search, cancel, reset, getIssue],
  );
}
