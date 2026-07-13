import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand/react";
import { defineMessages, useIntl } from "react-intl";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { IssueSearchStoreKey } from "../../store/IssueSearchStore.ts";
import { usePaletteCommandStore } from "../../store/PaletteCommandStore.ts";
import { accessPaletteCommandList } from "../../types/PaletteCommand.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import {
  accessToolbarConfigList,
  type ToolbarConfigItem,
} from "../../types/Toolbar.ts";
import type { TableColumnDef } from "../../types/TableLayout.ts";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import {
  createFilterTextDialogStore,
  FilterTextDialog,
  type Choice,
} from "./FilterTextDialog.tsx";
import {
  bigDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { usePaletteCommandMode } from "../hooks/usePaletteCommandMode.ts";
import { useFilterTextIssueSearch } from "../hooks/useFilterTextIssueSearch.ts";

const PALETTE_HORIZONTAL_BORDER_WIDTH = 2;

const PALETTE_COLUMNS: TableColumnDef[] = [
  { minWidth: 24, maxWidth: 36, grow: 0 },
  { minWidth: 20, grow: 1 },
];

const TOOLBAR_HELP_COLUMNS: TableColumnDef[] = [
  { minWidth: 12, maxWidth: 16, grow: 0 },
  { minWidth: 20, maxWidth: 20, grow: 0 },
  { minWidth: 20, grow: 1 },
];

const ISSUE_SEARCH_COLUMNS: TableColumnDef[] = [
  { minWidth: 20, maxWidth: 36, grow: 0 },
  { minWidth: 20, grow: 1 },
];

const messages = defineMessages({
  paletteCommandTitle: {
    id: "views.uiCommandPalette.title.command",
    defaultMessage: "Palette Command",
  },
  shortcutTitle: {
    id: "views.uiCommandPalette.title.shortcut",
    defaultMessage: "Shortcut",
  },
  issueTitle: {
    id: "views.uiCommandPalette.title.issue",
    defaultMessage: "Issue",
  },
  commandPlaceholder: {
    id: "views.uiCommandPalette.input.commandPlaceholder",
    defaultMessage: ":command…",
  },
  toolbarPlaceholder: {
    id: "views.uiCommandPalette.input.toolbarPlaceholder",
    defaultMessage: "?shortcut…",
  },
  issuePlaceholder: {
    id: "views.uiCommandPalette.input.issuePlaceholder",
    defaultMessage: "search issues…",
  },
  footerCancelLabel: {
    id: "views.uiCommandPalette.footer.cancel",
    defaultMessage: "Cancel",
  },
  footerConfirmLabel: {
    id: "views.uiCommandPalette.footer.confirm",
    defaultMessage: "Confirm",
  },
  noCommandMatchesLabel: {
    id: "views.uiCommandPalette.noCommandMatches",
    defaultMessage: "No matching commands",
  },
  noToolbarMatchesLabel: {
    id: "views.uiCommandPalette.noToolbarMatches",
    defaultMessage: "No matching shortcuts",
  },
  noIssueMatchesLabel: {
    id: "views.uiCommandPalette.noIssueMatches",
    defaultMessage: "No matching issues",
  },
});

function buildPaletteChoices(
  commands: PaletteCommand[],
  filterQuery: string,
  contentWidth: number,
  lastUsedCommandKey: string | null,
  tableLayouter: TableLayouter,
): Choice[] {
  tableLayouter.layout(contentWidth);
  const filtered = accessPaletteCommandList(commands).filterMatchingQuery(
    filterQuery,
  );
  return filtered.map((item) => {
    const isLastUsed =
      lastUsedCommandKey != null && item.key === lastUsedCommandKey;
    const labelForDisplay = isLastUsed ? `*${item.label}` : item.label;
    const shortcutKey = item.shortcutKey?.trim() ?? "";
    const nameCell =
      shortcutKey === ""
        ? labelForDisplay
        : `${labelForDisplay}<${shortcutKey}>`;
    return {
      key: item.key,
      text: BasicLayouter.stringWidthTruncateEnd(
        tableLayouter.makeRow([nameCell, item.description ?? ""]),
        contentWidth,
      ),
    };
  });
}

function buildToolbarHelpChoices(
  toolbarItems: readonly ToolbarConfigItem[],
  filterQuery: string,
  contentWidth: number,
  tableLayouter: TableLayouter,
): Choice[] {
  tableLayouter.layout(contentWidth);
  const filtered = accessToolbarConfigList(toolbarItems).filterForHelp(
    filterQuery,
  );
  return filtered.map((item) => ({
    key: item.key,
    text: BasicLayouter.stringWidthTruncateEnd(
      tableLayouter.makeRow([
        item.key,
        item.label,
        item.description ?? "",
      ]),
      contentWidth,
    ),
  }));
}

export function PaletteCommandDialog() {
  const intl = useIntl();
  const { width } = useDialogLayout(bigDialogLayout);
  const filterStoreRef = useRef(createFilterTextDialogStore());
  const commandTableLayouter = useMemo(
    () => new TableLayouter(PALETTE_COLUMNS),
    [],
  );
  const toolbarTableLayouter = useMemo(
    () => new TableLayouter(TOOLBAR_HELP_COLUMNS),
    [],
  );
  const issueTableLayouter = useMemo(
    () => new TableLayouter(ISSUE_SEARCH_COLUMNS),
    [],
  );

  const isOpen = usePaletteCommandStore((s) => s.isOpen);
  const commands = usePaletteCommandStore((s) => s.commands);
  const toolbarItems = usePaletteCommandStore((s) => s.toolbarItems);
  const initialFilterQuery = usePaletteCommandStore(
    (s) => s.initialFilterQuery,
  );
  const dismissEscape = usePaletteCommandStore((s) => s.dismissEscape);
  const lastUsedCommandKey = usePaletteCommandStore((s) => s.lastUsedCommandKey);
  const filterQuery = useStore(filterStoreRef.current, (s) => s.filterQuery);
  const { mode, forFilterQuery } = usePaletteCommandMode(filterQuery);

  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.PaletteCommand;

  const contentWidthForTable = Math.max(
    8,
    width - PALETTE_HORIZONTAL_BORDER_WIDTH,
  );

  const issueSearch = useFilterTextIssueSearch({
    filterStore: filterStoreRef.current,
    contentWidthForTable,
    tableLayouter: issueTableLayouter,
    searchStoreKey: IssueSearchStoreKey.PaletteCommand,
    matchedIdFirst: true,
  });

  const refreshCommandChoices = useCallback(
    (query: string) => {
      const choices = buildPaletteChoices(
        usePaletteCommandStore.getState().commands,
        query,
        contentWidthForTable,
        usePaletteCommandStore.getState().lastUsedCommandKey,
        commandTableLayouter,
      );
      filterStoreRef.current.getState().setChoiceList(choices);
    },
    [contentWidthForTable, commandTableLayouter],
  );

  const refreshToolbarChoices = useCallback(
    (query: string) => {
      const choices = buildToolbarHelpChoices(
        usePaletteCommandStore.getState().toolbarItems,
        query,
        contentWidthForTable,
        toolbarTableLayouter,
      );
      filterStoreRef.current.getState().setChoiceList(choices);
    },
    [contentWidthForTable, toolbarTableLayouter],
  );

  const refreshChoices = useCallback(
    (nextFilterQuery: string) => {
      const paletteMode = forFilterQuery(nextFilterQuery);
      if (paletteMode.mode === "toolbar") {
        issueSearch.cancel();
        refreshToolbarChoices(paletteMode.searchQuery);
        return;
      }
      if (paletteMode.mode === "command") {
        issueSearch.cancel();
        refreshCommandChoices(paletteMode.searchQuery);
        return;
      }
      filterStoreRef.current.getState().setChoiceList([]);
      issueSearch.search(nextFilterQuery);
    },
    [forFilterQuery, issueSearch, refreshCommandChoices, refreshToolbarChoices],
  );

  const handleActivate = useCallback(
    (choice: Choice) => {
      const currentFilterQuery = filterStoreRef.current.getState().filterQuery;
      const paletteMode = forFilterQuery(currentFilterQuery);

      if (paletteMode.mode === "issue") {
        const issue = issueSearch.getIssue(choice.key);
        if (issue == null) {
          return;
        }
        filterStoreRef.current.getState().close();
        usePaletteCommandStore.getState().close();
        const appStore = useAppStore.getState();
        if (appStore.getCurrentPage().name === "ISSUE_VIEWER") {
          appStore.replaceIssueViewer(issue);
        } else {
          appStore.pushIssueViewer(issue);
        }
        return;
      }

      if (paletteMode.mode === "toolbar") {
        const filtered = accessToolbarConfigList(
          usePaletteCommandStore.getState().toolbarItems,
        ).filterForHelp(paletteMode.searchQuery);
        const item = filtered.find((toolbarItem) => toolbarItem.key === choice.key);
        if (item == null || item.isDisabled === true) return;
        filterStoreRef.current.getState().close();
        usePaletteCommandStore.getState().close();
        item.callback();
        return;
      }

      const { commands: currentCommands } = usePaletteCommandStore.getState();
      const filtered = accessPaletteCommandList(currentCommands).filterMatchingQuery(
        paletteMode.searchQuery,
      );
      const item = filtered.find((command) => command.key === choice.key);
      if (item == null || item.isDisabled === true) return;
      usePaletteCommandStore.setState({ lastUsedCommandKey: item.key });
      filterStoreRef.current.getState().close();
      usePaletteCommandStore.getState().close();
      void Promise.resolve(item.callback());
    },
    [forFilterQuery, issueSearch],
  );

  const handleDismiss = useCallback(() => {
    dismissEscape();
  }, [dismissEscape]);

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
      initialFilterQuery,
      onFilterQueryChanged: (nextFilterQuery) => {
        refreshChoicesRef.current(nextFilterQuery);
      },
      onActivate: (choice) => {
        handleActivateRef.current(choice);
      },
      onDismiss: () => {
        handleDismissRef.current();
      },
    });
  }, [isOpen, initialFilterQuery, issueSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const currentFilterQuery = filterStoreRef.current.getState().filterQuery;
    const paletteMode = forFilterQuery(currentFilterQuery);
    if (paletteMode.mode === "toolbar") {
      refreshToolbarChoices(paletteMode.searchQuery);
      return;
    }
    if (paletteMode.mode === "command") {
      refreshCommandChoices(paletteMode.searchQuery);
      return;
    }
    refreshChoices(currentFilterQuery);
  }, [
    isOpen,
    commands,
    toolbarItems,
    contentWidthForTable,
    lastUsedCommandKey,
    refreshChoices,
    refreshCommandChoices,
    refreshToolbarChoices,
    forFilterQuery,
  ]);

  useEffect(() => {
    if (isOpen) return;
    if (usePopupStore.getState().latestPopup !== PopupNames.PaletteCommand) {
      return;
    }
    usePopupStore.getState().popPopup();
  }, [isOpen]);

  if (!isOpen || !isLatestPopup) return null;

  const placeholderMessage =
    mode === "toolbar"
      ? messages.toolbarPlaceholder
      : mode === "command"
        ? messages.commandPlaceholder
        : messages.issuePlaceholder;

  const noMatchesMessage =
    mode === "toolbar"
      ? messages.noToolbarMatchesLabel
      : mode === "command"
        ? messages.noCommandMatchesLabel
        : messages.noIssueMatchesLabel;

  const titleMessage =
    mode === "toolbar"
      ? messages.shortcutTitle
      : mode === "command"
        ? messages.paletteCommandTitle
        : messages.issueTitle;

  return (
    <FilterTextDialog
      store={filterStoreRef.current}
      isActive={isOpen && isLatestPopup}
      title={intl.formatMessage(titleMessage)}
      placeholder={intl.formatMessage(placeholderMessage)}
      noMatchesLabel={intl.formatMessage(noMatchesMessage)}
      footerCancelLabel={intl.formatMessage(messages.footerCancelLabel)}
      footerConfirmLabel={intl.formatMessage(messages.footerConfirmLabel)}
      layoutInput={bigDialogLayout}
      isChoiceDisabled={
        mode === "command"
          ? (key) =>
              commands.find((command) => command.key === key)?.isDisabled === true
          : mode === "toolbar"
            ? (key) =>
                toolbarItems.find((item) => item.key === key)?.isDisabled === true
            : undefined
      }
    />
  );
}
