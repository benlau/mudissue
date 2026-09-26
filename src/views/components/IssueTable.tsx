import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useInput, Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useCreateIssueDialogStore } from "../../store/CreateIssueDialogStore.ts";
import { switchRecentProjectPaletteCommand } from "../PaletteCommands/SwitchRecentProjectPaletteCommand.ts";
import {
  PaletteCommandRegistry,
  PaletteCommandRegistryScope,
} from "../PaletteCommands/PaletteCommandRegistry.ts";
import { usePopupStore } from "../../store/PopupStore.ts";
import { usePaletteCommandStore } from "../../store/PaletteCommandStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { clamp } from "../../types/maths.ts";
import {
  SearchingDialog,
  useSearchingDialogHandle,
} from "./SearchingDialog.tsx";
import { ToolBar, type ToolbarConfigItem } from "./ToolBar.tsx";
import { useTerminalSize, useTerminalName } from "../hooks/useTerminal.ts";
import { useQuit } from "../hooks/useQuit.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import type { TableColumnDef } from "../../types/TableLayout.ts";
import { AnsiEscapeCode } from "../../types/ansi.ts";
import { DefaultTheme } from "../../types/Theme.ts";
import { useEditFile } from "../../contexts/AppContext.tsx";
import { EditIssueMarkdownFileHelper } from "../../helpers/EditIssueMarkdownFileHelper.ts";
import { IssueFolderStorage } from "../../async/storage/IssueFolderStorage.ts";
import { CustomScriptPaletteHelper } from "../../helpers/CustomScriptPaletteHelper.ts";
const ID_WIDTH = 12;
const STATUS_WIDTH = 12;
const PRIORITY_WIDTH = 10;
const MIN_TITLE_WIDTH = 10;
const MIN_TOOLBAR_WIDTH = 10;
const SEARCH_ESC_KEY = "Esc";

const issueTableToolbarMessages = defineMessages({
  newLabel: {
    id: "views.issueTable.toolbar.new.label",
    defaultMessage: "New",
  },
  newDescription: {
    id: "views.issueTable.toolbar.new.description",
    defaultMessage: "Create a new issue",
  },
  searchLabel: {
    id: "views.issueTable.toolbar.search.label",
    defaultMessage: "Search",
  },
  searchDescription: {
    id: "views.issueTable.toolbar.search.description",
    defaultMessage: "Filter issues by text search",
  },
  selectionLabel: {
    id: "views.issueTable.toolbar.selection.label",
    defaultMessage: "Selection",
  },
  selectionDescription: {
    id: "views.issueTable.toolbar.selection.description",
    defaultMessage: "Toggle range selection on table rows",
  },
  editLabel: {
    id: "views.issueTable.toolbar.edit.label",
    defaultMessage: "Edit",
  },
  editDescription: {
    id: "views.issueTable.toolbar.edit.description",
    defaultMessage: "Edit the selected issue in the text editor",
  },
  externalEditLabel: {
    id: "views.issueTable.toolbar.externalEdit.label",
    defaultMessage: "External Edit",
  },
  externalEditDescription: {
    id: "views.issueTable.toolbar.externalEdit.description",
    defaultMessage: "Edit the selected issue file in an external editor",
  },
  recentProjectsLabel: {
    id: "views.issueTable.toolbar.recentProjects.label",
    defaultMessage: "Recent projects",
  },
  recentProjectsDescription: {
    id: "views.issueTable.toolbar.recentProjects.description",
    defaultMessage: "Switch to another recently opened repository",
  },
  helpLabel: {
    id: "views.issueTable.toolbar.help.label",
    defaultMessage: "Help",
  },
  helpDescription: {
    id: "views.issueTable.toolbar.help.description",
    defaultMessage: "Show this keyboard-shortcut overview",
  },
  commandToolbarLabel: {
    id: "views.issueTable.toolbar.command.label",
    defaultMessage: "Command",
  },
  commandToolbarDescription: {
    id: "views.issueTable.toolbar.command.description",
    defaultMessage: "Run a command",
  },
  emptyState: {
    id: "views.issueTable.emptyState",
    defaultMessage:
      'No issues created yet.\nPress "+" to create a new issue or press\nCtrl+R to switch to another project',
  },
  searchEmpty: {
    id: "views.issueTable.searchEmpty",
    defaultMessage: "No issues were found",
  },
  searchBackLabel: {
    id: "views.issueTable.search.back.label",
    defaultMessage: "Back",
  },
});

const ISSUE_TABLE_COLUMNS: TableColumnDef[] = [
  { minWidth: ID_WIDTH, maxWidth: ID_WIDTH, grow: 0 },
  { minWidth: MIN_TITLE_WIDTH, grow: 1 },
  { minWidth: STATUS_WIDTH, maxWidth: STATUS_WIDTH, grow: 0 },
  { minWidth: PRIORITY_WIDTH, maxWidth: PRIORITY_WIDTH, grow: 0 },
];

function truncate(str: string, width: number): string {
  const s = String(str);
  if (s.length <= width) return s;
  return s.slice(0, Math.max(0, width - 1)) + "…";
}

function formatIssueTableTitle(title: string): string {
  return title.replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "");
}

export const DEFAULT_LARGE_TERMINAL_HEIGHT_THRESHOLD = 20;

export type IssueTableProps = {
  largeTerminalHeightThreshold?: number;
};

export function IssueTable({
  largeTerminalHeightThreshold = DEFAULT_LARGE_TERMINAL_HEIGHT_THRESHOLD,
}: IssueTableProps = {}) {
  const intl = useIntl();
  const { quitIfConfirmed } = useQuit();
  const mainIssueLists = useAppStore((s) => s.mainIssueLists);
  const pinnedIssueIds = useAppStore((s) => s.pinnedIssueIds);
  const filter = useAppStore((s) => s.filter);
  const isLoadingIssueList = useAppStore((s) => s.isLoadingIssueList);
  const searchIssues = useAppStore((s) => s.searchIssues);
  const openIssue = useAppStore((s) => s.openIssue);
  const selectedIssueId = useAppStore((s) => s.selectedIssueId);
  const setSelectedIssueId = useAppStore((s) => s.setSelectedIssueId);
  const tableRangeSelectionAnchorIssueId = useAppStore(
    (s) => s.tableRangeSelectionAnchorIssueId,
  );
  const toggleTableRangeSelection = useAppStore(
    (s) => s.toggleTableRangeSelection,
  );
  const clearTableRangeSelection = useAppStore(
    (s) => s.clearTableRangeSelection,
  );

  const issues = useMemo(() => mainIssueLists ?? [], [mainIssueLists]);
  const pinnedIssueIdSet = useMemo(
    () => new Set(pinnedIssueIds),
    [pinnedIssueIds],
  );
  const selectedIndex = useMemo(() => {
    if (issues.length === 0) return 0;
    if (selectedIssueId == null) return 0;
    const idx = issues.findIndex(
      (issue) => issue.issueId === selectedIssueId,
    );
    return idx >= 0 ? idx : 0;
  }, [issues, selectedIssueId]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const currentTrackerRepo = useCurrentTrackerRepoStore(
    (s) => s.currentTrackerRepo,
  );
  const [resolvedStatusSet, setResolvedStatusSet] = useState<
    ReadonlySet<string>
  >(new Set());

  useEffect(() => {
    void useCurrentTrackerRepoStore.getState().ensureCurrentTrackerRepoFound();
  }, []);

  useEffect(() => {
    if (currentTrackerRepo == null) {
      setResolvedStatusSet(new Set());
      return;
    }
    void useCurrentTrackerRepoStore
      .getState()
      .getResolvedStatusList(currentTrackerRepo)
      .then((list) => setResolvedStatusSet(new Set(list)));
  }, [currentTrackerRepo]);

  const repoName = currentTrackerRepo?.name ?? "mudissue";
  useTerminalName(repoName);
  const { cols, rows } = useTerminalSize();
  const openCreateIssueDialog = useCreateIssueDialogStore((s) => s.open);
  const editFile = useEditFile();
  const [isEditingFile, setIsEditingFile] = useState(false);

  const hasPopup = usePopupStore((s) => s.hasPopup);
  const searchingDialog = useSearchingDialogHandle();

  const isSearchingMode = filter != null && filter.trim() !== "";
  const showProjectNameHeader =
    !isSearchingMode && rows >= largeTerminalHeightThreshold;
  const chromeRows = isSearchingMode
    ? 3
    : (showProjectNameHeader ? 1 : 0) + 2;
  const pageSize = Math.max(1, rows - chromeRows);
  const innerCols = cols;
  const tableLayouterRef = useRef<TableLayouter | null>(null);
  if (tableLayouterRef.current == null) {
    tableLayouterRef.current = new TableLayouter(ISSUE_TABLE_COLUMNS);
  }
  const tableLayouter = tableLayouterRef.current;
  tableLayouter.layout(innerCols);
  const maxIndex = Math.max(0, issues.length - 1);
  const clampedIndex = clamp(selectedIndex, 0, maxIndex);
  const rangeBounds = useMemo(() => {
    if (tableRangeSelectionAnchorIssueId == null || issues.length === 0) {
      return null;
    }
    const anchorIdx = issues.findIndex(
      (issue) => issue.issueId === tableRangeSelectionAnchorIssueId,
    );
    if (anchorIdx < 0) {
      return null;
    }
    const lo = Math.min(anchorIdx, clampedIndex);
    const hi = Math.max(anchorIdx, clampedIndex);
    return { lo, hi };
  }, [
    issues,
    tableRangeSelectionAnchorIssueId,
    clampedIndex,
  ]);
  const isEmpty = issues.length === 0;
  const isSearchEmpty = isSearchingMode && isEmpty;

  const setIndex = useCallback(
    (next: number) => {
      const idx = clamp(next, 0, maxIndex);
      setSelectedIssueId(issues[idx]?.issueId ?? null);
    },
    [issues, maxIndex, setSelectedIssueId],
  );

  useEffect(() => {
    if (issues.length === 0) {
      if (selectedIssueId != null) {
        setSelectedIssueId(null);
      }
      if (tableRangeSelectionAnchorIssueId != null) {
        clearTableRangeSelection();
      }
      return;
    }
    const valid =
      selectedIssueId != null &&
      issues.some((issue) => issue.issueId === selectedIssueId);
    if (!valid) {
      setSelectedIssueId(issues[0]?.issueId ?? null);
    }
    if (
      tableRangeSelectionAnchorIssueId != null &&
      !issues.some(
        (issue) => issue.issueId === tableRangeSelectionAnchorIssueId,
      )
    ) {
      clearTableRangeSelection();
    }
  }, [
    issues,
    selectedIssueId,
    setSelectedIssueId,
    tableRangeSelectionAnchorIssueId,
    clearTableRangeSelection,
  ]);

  useEffect(() => {
    setScrollOffset((prev) => {
      if (maxIndex < 0) return 0;
      const idx = clamp(selectedIndex, 0, maxIndex);
      if (idx < prev) return idx;
      if (idx >= prev + pageSize) {
        return Math.max(0, idx - pageSize + 1);
      }
      return prev;
    });
  }, [selectedIndex, pageSize, maxIndex]);

  const handleSearch = useCallback(async () => {
    const response = await searchingDialog.methods.open({
      initialValue: filter ?? "",
    });
    if (response.type === "Accepted") {
      const value = response.value ?? null;
      await searchIssues(value);
    }
  }, [filter, searchIssues, searchingDialog.methods]);

  const handleEditSelectedIssue = useCallback(async () => {
    if (issues.length === 0) return;
    const issue = issues[clampedIndex];
    if (!issue) return;
    await EditIssueMarkdownFileHelper.edit(issue);
  }, [clampedIndex, issues]);

  const handlePickEditorForSelectedIssue = useCallback(async () => {
    if (issues.length === 0 || isEditingFile) return;
    const issue = issues[clampedIndex];
    if (!issue) return;
    const issueFilePath = await new IssueFolderStorage(issue).findIssueFile();
    if (!issueFilePath) return;
    setIsEditingFile(true);
    try {
      await editFile(issueFilePath, { pickEditor: true });
    } finally {
      setIsEditingFile(false);
    }
  }, [clampedIndex, editFile, isEditingFile, issues]);

  const customScriptPaletteHelper = useMemo(
    () => new CustomScriptPaletteHelper(),
    [],
  );

  const buildIssueTablePaletteCommands = useCallback((): PaletteCommand[] => {
    const scripts =
      useCurrentTrackerRepoStore.getState().currentTrackerRepo?.config.scripts;
    return [
      ...PaletteCommandRegistry.getPaletteCommands(
        PaletteCommandRegistryScope.IssueTable,
      ),
      ...customScriptPaletteHelper.buildPaletteCommands(scripts ?? []),
    ];
  }, [customScriptPaletteHelper]);

  const openIssueTablePalette = useCallback(
    (options?: {
      initialFilterQuery?: string;
      toolbarItems?: ToolbarConfigItem[];
    }) => {
      usePaletteCommandStore.getState().open({
        commands: buildIssueTablePaletteCommands(),
        toolbarItems: options?.toolbarItems,
        initialFilterQuery: options?.initialFilterQuery ?? ":",
      });
    },
    [buildIssueTablePaletteCommands],
  );

  useEffect(() => {
    usePaletteCommandStore
      .getState()
      .replaceCommands(buildIssueTablePaletteCommands());
  }, [buildIssueTablePaletteCommands, currentTrackerRepo]);

  const toolbarItems = useMemo<ToolbarConfigItem[]>(() => {
    const list: ToolbarConfigItem[] = [
      {
        label: intl.formatMessage(issueTableToolbarMessages.newLabel),
        key: "+",
        description: intl.formatMessage(
          issueTableToolbarMessages.newDescription,
        ),
        callback: () => {
          openCreateIssueDialog();
        },
      },
      {
        label: intl.formatMessage(issueTableToolbarMessages.searchLabel),
        key: "/",
        description: intl.formatMessage(
          issueTableToolbarMessages.searchDescription,
        ),
        callback: () => void handleSearch(),
      },
      {
        label: intl.formatMessage(issueTableToolbarMessages.selectionLabel),
        key: "v",
        description: intl.formatMessage(
          issueTableToolbarMessages.selectionDescription,
        ),
        callback: () => {
          toggleTableRangeSelection();
        },
      },
      {
        label: intl.formatMessage(issueTableToolbarMessages.editLabel),
        key: "e",
        description: intl.formatMessage(
          issueTableToolbarMessages.editDescription,
        ),
        callback: () => {
          void handleEditSelectedIssue();
        },
      },
      {
        label: intl.formatMessage(issueTableToolbarMessages.externalEditLabel),
        key: "c+e",
        description: intl.formatMessage(
          issueTableToolbarMessages.externalEditDescription,
        ),
        isDisabled: issues.length === 0,
        callback: () => {
          void handlePickEditorForSelectedIssue();
        },
      },
      {
        label: intl.formatMessage(
          issueTableToolbarMessages.recentProjectsLabel,
        ),
        key: "c+r",
        description: intl.formatMessage(
          issueTableToolbarMessages.recentProjectsDescription,
        ),
        callback: () =>
          void switchRecentProjectPaletteCommand.callback(),
      },
    ];
    list.push({
      label: intl.formatMessage(
        issueTableToolbarMessages.commandToolbarLabel,
      ),
      key: ":",
      showInHelpDialog: false,
      description: intl.formatMessage(
        issueTableToolbarMessages.commandToolbarDescription,
      ),
      callback: () => {
        openIssueTablePalette({
          toolbarItems: list.slice(),
          initialFilterQuery: ":",
        });
      },
    });
    list.push({
      label: intl.formatMessage(issueTableToolbarMessages.helpLabel),
      key: "?",
      showInHelpDialog: false,
      description: intl.formatMessage(
        issueTableToolbarMessages.helpDescription,
      ),
      callback: () => {
        openIssueTablePalette({
          toolbarItems: list.slice(),
          initialFilterQuery: "?",
        });
      },
    });
    return list;
  }, [
    intl,
    handleSearch,
    openIssueTablePalette,
    handleEditSelectedIssue,
    handlePickEditorForSelectedIssue,
    issues.length,
    openCreateIssueDialog,
    toggleTableRangeSelection,
  ]);

  const visible = useMemo(
    () => issues.slice(scrollOffset, scrollOffset + pageSize),
    [issues, scrollOffset, pageSize]
  );

  useInput((input, key) => {
    if (isEditingFile) return;
    if (hasPopup) return;

    const isEscape = key.escape || input === AnsiEscapeCode.ESC;
    if (isEscape) {
      if (filter != null && filter.trim() !== "") {
        void searchIssues(null);
        return;
      }
      void quitIfConfirmed();
      return;
    }
    if (issues.length === 0) return;
    if (key.upArrow) {
      setIndex(clampedIndex - 1);
      return;
    }
    if (key.downArrow) {
      setIndex(clampedIndex + 1);
      return;
    }
    if (key.pageDown) {
      setIndex(clampedIndex + pageSize);
      return true;
    }
    if (key.pageUp) {
      setIndex(clampedIndex - pageSize);
      return true;
    }
    if (key.home) {
      setIndex(0);
      return true;
    }
    if (key.end) {
      setIndex(maxIndex);
      return true;
    }
    const isEnter =
      key.return || input === "\r" || input === "\n";
    if (isEnter) {
      const issue = issues[clampedIndex];
      if (issue) {
        openIssue(issue);
      }
      return;
    }
  });

  if (isLoadingIssueList) {
    return (
      <Box>
        <Text>Loading…</Text>
      </Box>
    );
  }

  const searchEscLabel = `${intl.formatMessage(issueTableToolbarMessages.searchBackLabel)}<${SEARCH_ESC_KEY}>`;
  const searchTitleSeparator = " | ";
  const searchFilterPrefix = " > ";
  const searchFilterSuffix = "";
  const searchFilterWidth = Math.max(
    0,
    cols -
      searchEscLabel.length -
      searchTitleSeparator.length -
      repoName.length -
      searchFilterPrefix.length -
      searchFilterSuffix.length,
  );
  const searchFilterDisplay = `${searchFilterPrefix}${truncate(filter ?? "", searchFilterWidth)}${searchFilterSuffix}`;

  const toolbarWidth = Math.max(
    MIN_TOOLBAR_WIDTH,
    innerCols,
  );

  return (
    <Box position="relative" flexDirection="column" width={cols} height={rows}>
      {isSearchingMode ? (
        <Box flexDirection="row" width={cols}>
          <Text>
            <Text color={DefaultTheme.accents.green}>{searchEscLabel}</Text>
            {searchTitleSeparator}
            <Text color={DefaultTheme.accents.orange}>{repoName}</Text>
            {searchFilterDisplay}
          </Text>
        </Box>
      ) : showProjectNameHeader ? (
        <Box justifyContent="center" width={cols}>
          <Text color={DefaultTheme.accents.orange}>{repoName}</Text>
        </Box>
      ) : null}
      <Box flexDirection="column" flexGrow={1}>
        {!isEmpty ? (
          <Box>
            <Text bold color={DefaultTheme.accents.cyan}>
              {tableLayouter.makeRow([
                "ID",
                "TITLE",
                "STATUS",
                "PRIORITY",
              ])}
            </Text>
          </Box>
        ) : null}
        <Box
          flexGrow={1}
          flexDirection="column"
          justifyContent={isEmpty ? "center" : "flex-start"}
          alignItems={isEmpty ? "center" : "stretch"}
          width={innerCols}
        >
          {isSearchEmpty ? (
            <Text>
              {intl.formatMessage(issueTableToolbarMessages.searchEmpty)}
            </Text>
          ) : isEmpty ? (
            <Box flexDirection="column" alignItems="center">
              {intl
                .formatMessage(issueTableToolbarMessages.emptyState)
                .split("\n")
                .map((line, index) => (
                  <Text key={index}>{line}</Text>
                ))}
            </Box>
          ) : (
            visible.map((issue, i) => {
              const globalIndex = scrollOffset + i;
              const isHighlighted =
                rangeBounds != null
                  ? globalIndex >= rangeBounds.lo &&
                    globalIndex <= rangeBounds.hi
                  : globalIndex === clampedIndex;
              const isResolved = resolvedStatusSet.has(
                issue.metadata?.status ?? "",
              );
              return (
                <Box key={issue.issueId}>
                  <Text
                    inverse={isHighlighted}
                    dimColor={isResolved && !isHighlighted}
                  >
                    {tableLayouter.makeRow([
                      pinnedIssueIdSet.has(issue.issueId)
                        ? `*${issue.label}`
                        : issue.label,
                      formatIssueTableTitle(
                        issue.metadata?.title ?? issue.issueId,
                      ),
                      issue.metadata?.status ?? "",
                      issue.metadata?.priority ?? "",
                    ])}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
        <Box>
          <ToolBar
            width={toolbarWidth}
            items={toolbarItems}
            isDisabled={isEditingFile || hasPopup}
          />
        </Box>
      </Box>
        <SearchingDialog {...searchingDialog.props} />
    </Box>
  );
}
