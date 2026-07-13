import { useCallback, useEffect, useRef } from "react";
import { defineMessages, useIntl } from "react-intl";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { useIssueSearchingDialogStore } from "../../store/IssueSearchingDialogStore.ts";
import { IssueSearchStoreKey } from "../../store/IssueSearchStore.ts";
import type { TableColumnDef } from "../../types/TableLayout.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import {
  createFilterTextDialogStore,
  FilterTextDialog,
  type Choice,
} from "./FilterTextDialog.tsx";
import { useFilterTextIssueSearch } from "../hooks/useFilterTextIssueSearch.ts";
import { useTerminalSize } from "../hooks/useTerminal.ts";

const ISSUE_SEARCHING_DIALOG_MIN_WIDTH = 62;
const ISSUE_SEARCHING_DIALOG_HORIZONTAL_BORDER_WIDTH = 2;

const ISSUE_SEARCH_COLUMNS: TableColumnDef[] = [
  { minWidth: 20, maxWidth: 36, grow: 0 },
  { minWidth: 20, grow: 1 },
];

const messages = defineMessages({
  placeholder: {
    id: "views.issueSearchingDialog.input.placeholder",
    defaultMessage: "search…",
  },
  footerCancelLabel: {
    id: "views.issueSearchingDialog.footer.cancel",
    defaultMessage: "Cancel",
  },
  noMatchesLabel: {
    id: "views.issueSearchingDialog.noMatches",
    defaultMessage: "No matching issues",
  },
});

function issueSearchingDialogPreferredWidth(screen: { cols: number }): number {
  return Math.max(
    ISSUE_SEARCHING_DIALOG_MIN_WIDTH,
    Math.floor(screen.cols * 0.8),
  );
}

export function IssueSearchingDialog() {
  const intl = useIntl();
  const size = useTerminalSize();
  const filterStoreRef = useRef(createFilterTextDialogStore());
  const tableLayouterRef = useRef<TableLayouter | null>(null);
  if (tableLayouterRef.current == null) {
    tableLayouterRef.current = new TableLayouter(ISSUE_SEARCH_COLUMNS);
  }
  const tableLayouter = tableLayouterRef.current;

  const isOpen = useIssueSearchingDialogStore((s) => s.isOpen);
  const title = useIssueSearchingDialogStore((s) => s.title);
  const confirmLabel = useIssueSearchingDialogStore((s) => s.confirmLabel);
  const excludeFolderNames = useIssueSearchingDialogStore(
    (s) => s.excludeFolderNames,
  );
  const close = useIssueSearchingDialogStore((s) => s.close);
  const accept = useIssueSearchingDialogStore((s) => s.accept);

  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.IssueSearchingDialog;

  const terminalCols =
    size.cols > 0 ? size.cols : Math.max(ISSUE_SEARCHING_DIALOG_MIN_WIDTH + 16, 80);
  const contentWidthForTable = Math.max(
    8,
    Math.min(
      issueSearchingDialogPreferredWidth({ cols: terminalCols }),
      terminalCols,
    ) - ISSUE_SEARCHING_DIALOG_HORIZONTAL_BORDER_WIDTH,
  );

  const issueSearch = useFilterTextIssueSearch({
    filterStore: filterStoreRef.current,
    contentWidthForTable,
    tableLayouter,
    searchStoreKey: IssueSearchStoreKey.LinkPalette,
    excludeFolderNames: new Set(excludeFolderNames),
  });

  const refreshChoices = useCallback(
    (filterQuery: string) => {
      issueSearch.search(filterQuery);
    },
    [issueSearch],
  );

  const handleActivate = useCallback(
    (choice: Choice) => {
      const issue = issueSearch.getIssue(choice.key);
      if (issue == null) {
        return;
      }
      filterStoreRef.current.getState().close();
      accept(issue);
    },
    [accept, issueSearch],
  );

  const handleDismiss = useCallback(() => {
    close();
  }, [close]);

  const refreshChoicesRef = useRef(refreshChoices);
  refreshChoicesRef.current = refreshChoices;
  const handleActivateRef = useRef(handleActivate);
  handleActivateRef.current = handleActivate;
  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;

  useEffect(() => {
    if (!isOpen) {
      filterStoreRef.current.getState().close();
      issueSearch.reset();
      issueSearch.cancel();
      return;
    }
    filterStoreRef.current.getState().open({
      initialFilterQuery: "",
      onFilterQueryChanged: (filterQuery) => {
        refreshChoicesRef.current(filterQuery);
      },
      onActivate: (choice) => {
        handleActivateRef.current(choice);
      },
      onDismiss: () => {
        handleDismissRef.current();
      },
    });
  }, [isOpen, issueSearch]);

  useEffect(() => {
    if (!isOpen) return;
    refreshChoices(filterStoreRef.current.getState().filterQuery);
  }, [isOpen, excludeFolderNames, contentWidthForTable, refreshChoices]);

  useEffect(() => {
    if (isOpen) return;
    if (usePopupStore.getState().latestPopup !== PopupNames.IssueSearchingDialog) {
      return;
    }
    usePopupStore.getState().popPopup();
  }, [isOpen]);

  if (!isOpen || !isLatestPopup) return null;

  return (
    <FilterTextDialog
      store={filterStoreRef.current}
      isActive={isOpen && isLatestPopup}
      title={title}
      placeholder={intl.formatMessage(messages.placeholder)}
      noMatchesLabel={intl.formatMessage(messages.noMatchesLabel)}
      footerCancelLabel={intl.formatMessage(messages.footerCancelLabel)}
      footerConfirmLabel={confirmLabel}
    />
  );
}
