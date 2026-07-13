import * as path from "path";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Box, Text, useInput } from "ink";
import { defineMessages, useIntl, type IntlShape } from "react-intl";
import { useStore } from "zustand";
import { FileService } from "../../services/FileService.ts";
import { IssueLinkHelper } from "../../helpers/IssueLinkHelper.ts";
import { IssueMarkdownFileStorage } from "../../utils/storage/IssueMarkdownFileStorage.ts";
import { TrackerRepoStorage } from "../../utils/storage/TrackerRepoStorage.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../../store/GlobalConfigStore.ts";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";
import {
  type MarkdownViewerSetContentOptions,
  type MarkdownViewerHandleStore,
} from "../../store/MarkdownViewerHandleStore.ts";
import { useTextEditDialogStore } from "../../store/TextEditDialogStore.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import { usePopupStore } from "../../store/PopupStore.ts";
import { LineOperationFormatter } from "../../foundation/formatter/LineOperationFormatter.ts";
import { TextLayouter } from "../../foundation/layouter/TextLayouter.ts";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";
import { KeyMatcher } from "../../foundation/matchers/KeyMatcher.ts";
import { MarkdownLineOperationParser } from "../../foundation/parser/MarkdownLineOperationParser.ts";
import { MarkdownParser } from "../../foundation/parser/MarkdownParser.ts";
import { LinkageTypesAccessor } from "../../types/linkage.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type {
  LineOperation,
  LineOperationInfo,
} from "../../types/LineOperation.ts";
import { isErrorResponse } from "../../types/Response.ts";
import { DefaultTheme } from "../../types/Theme.ts";
import { clamp } from "../../types/maths.ts";
import { setSelectedIssuePriorityPaletteCommand } from "../PaletteCommands/SetSelectedIssuePriorityPaletteCommand.ts";
import { setSelectedIssueStatusPaletteCommand } from "../PaletteCommands/SetSelectedIssueStatusPaletteCommand.ts";
import { useFileWatcher } from "../hooks/useFileWatcher.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "./PickItemDialog.tsx";

export type { MarkdownViewerSetContentOptions, MarkdownViewerHandleStore };

export const LINE_BEGIN_PADDING = LineOperationFormatter.PREFIX_WIDTH;

export function rescaleScrollOffset(
  prevOffset: number,
  prevTotalLines: number,
  newTotalLines: number,
  pageSize: number,
): number {
  if (prevTotalLines <= 0) return 0;
  const proportional = Math.round(
    (prevOffset / prevTotalLines) * newTotalLines,
  );
  const maxStart = Math.max(0, newTotalLines - pageSize);
  return clamp(proportional, 0, maxStart);
}

export function ensureScrollShowsSelection(
  scrollOffset: number,
  selectedIndex: number,
  pageSize: number,
  maxLineIndex: number,
): number {
  const idx = clamp(selectedIndex, 0, maxLineIndex);
  if (idx < scrollOffset) return idx;
  if (idx >= scrollOffset + pageSize) {
    return Math.max(0, idx - pageSize + 1);
  }
  return scrollOffset;
}

export type MarkdownViewerChangedPayload = {
  path: string;
  lines: string[];
  displayTitle: string;
  frontmatterTitle?: string;
  status?: string;
  priority?: string;
  updatedAt: Date;
};

export type MarkdownViewerProps = {
  path: string;
  width: number;
  height: number;
  handle: MarkdownViewerHandleStore;
  issueFolder?: IssueFolder;
  isDisabled?: boolean;
  onChanged?: (payload: MarkdownViewerChangedPayload) => void;
  onLogicalLineIndexChanged?: (logicalLineIndex: number) => void;
};

const messages = defineMessages({
  unlinkConfirmTitle: {
    id: "views.markdownViewer.unlink.confirmTitle",
    defaultMessage: "Remove link?",
  },
  unlinkConfirmMessage: {
    id: "views.markdownViewer.unlink.confirmMessage",
    defaultMessage:
      "Remove {linkType} link to {issueSelector}? This updates both issues.",
  },
  unlinkConfirmLabel: {
    id: "views.markdownViewer.unlink.confirmLabel",
    defaultMessage: "Unlink",
  },
  jumpLabel: {
    id: "views.markdownViewer.jump.label",
    defaultMessage: "Jump to the issue",
  },
  unlinkLabel: {
    id: "views.markdownViewer.unlink.label",
    defaultMessage: "Unlink the issue",
  },
  jumpNotFoundToast: {
    id: "views.markdownViewer.jump.notFound",
    defaultMessage: "Issue not found: {issueSelector}",
  },
  unlinkDstNotFoundToast: {
    id: "views.markdownViewer.unlink.dstNotFound",
    defaultMessage:
      "Removed link; destination issue was not found: {issueSelector}",
  },
  pickJumpLinkTitle: {
    id: "views.markdownViewer.jump.pickLinkTitle",
    defaultMessage: "Jump to issue",
  },
  pickOperationTitle: {
    id: "views.markdownViewer.pickOperation.title",
    defaultMessage: "Choose operation",
  },
  checkboxLabel: {
    id: "views.markdownViewer.checkbox.label",
    defaultMessage: "Toggle checkbox",
  },
  statusLabel: {
    id: "views.markdownViewer.status.label",
    defaultMessage: "Set status",
  },
  priorityLabel: {
    id: "views.markdownViewer.priority.label",
    defaultMessage: "Set priority",
  },
});

function extractFirstHeading(lines: string[]): string | undefined {
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      return line.replace(/^#+\s*/, "").trim();
    }
  }
  return undefined;
}

function buildDisplayTitle(
  frontmatterTitle: string | undefined,
  lines: string[],
  filePath: string,
): string {
  return (
    frontmatterTitle ??
    extractFirstHeading(lines) ??
    path.basename(filePath)
  );
}

function displayIndexForLogicalLine(
  textLayouter: TextLayouter,
  logicalLineIndex: number,
  displaySubRow: number,
  maxDisplayIndex: number,
): number {
  const displayRows = textLayouter.getDisplayRowsForLogicalLine(logicalLineIndex);
  if (displayRows.length === 0) {
    return clamp(logicalLineIndex, 0, maxDisplayIndex);
  }
  const subRow = clamp(displaySubRow, 0, displayRows.length - 1);
  return clamp(displayRows[subRow]!, 0, maxDisplayIndex);
}

const CHECKBOX_SYMBOL = "X";
const CHECKBOX_KEY = "x";
const FIELD_SYMBOL = "=";
const FIELD_KEY = "=";
const JUMP_SYMBOL = "j";
const JUMP_KEY = "j";
const UNLINK_SYMBOL = "-";
const UNLINK_KEY = "-";

type GetLineOperationsContext = {
  toggleCheckboxAtLine: (logicalLineIndex: number) => Promise<void>;
  issueFolder?: IssueFolder;
  filePath: string;
  intl: IntlShape;
};

async function openLineOperationPicker(
  ops: LineOperation[],
  intl: IntlShape,
): Promise<void> {
  const response = await usePickItemDialogStore
    .getState()
    .open(ops, (op) => op.label, {
      title: intl.formatMessage(messages.pickOperationTitle),
    });
  if (
    response.type !== PickItemDialogResponseType.Accepted ||
    response.acceptedValue == null
  ) {
    return;
  }
  await response.acceptedValue.action();
}

function issueSelectorsFromLine(
  line: string,
  fallback?: string,
): string[] {
  const targets = MarkdownParser.extractWikiLinkTargets(line).filter(
    (target) => IssueSelectorMatcher.isValidateFolderName(target),
  );
  if (targets.length > 0) {
    return targets;
  }
  if (fallback != null && fallback !== "") {
    return [fallback];
  }
  return [];
}

async function resolveAndJump(
  issueSelector: string,
  intl: IntlShape,
): Promise<void> {
  const issues = await useCurrentTrackerRepoStore
    .getState()
    .findIssue(issueSelector);
  if (issues.length === 0) {
    await useToastStore.getState().info(
      intl.formatMessage(messages.jumpNotFoundToast, {
        issueSelector,
      }),
    );
    return;
  }
  useAppStore.getState().pushIssueViewer(issues[0]!);
}

async function jumpFromSelectors(
  selectors: string[],
  intl: IntlShape,
): Promise<void> {
  if (selectors.length === 0) {
    return;
  }
  let issueSelector = selectors[0]!;
  if (selectors.length > 1) {
    const response = await usePickItemDialogStore
      .getState()
      .open(selectors, (selector) => selector, {
        title: intl.formatMessage(messages.pickJumpLinkTitle),
      });
    if (
      response.type !== PickItemDialogResponseType.Accepted ||
      response.acceptedValue == null
    ) {
      return;
    }
    issueSelector = response.acceptedValue;
  }
  await resolveAndJump(issueSelector, intl);
}

function parseLineOperationInfos(
  lines: string[],
  linkTypeFieldNames?: string[],
): LineOperationInfo[] {
  return MarkdownLineOperationParser.detect(lines, {
    linkTypeFieldNames,
  });
}

function getFrontmatterBoundaryDisplayRows(
  infos: LineOperationInfo[],
  getDisplayRows: (logicalLineIndex: number) => number[],
): Set<number> {
  const rows = new Set<number>();
  for (const item of infos) {
    if (item.kind !== "frontmatter_boundary") {
      continue;
    }
    for (const logicalLineIndex of item.logicalLineIndexes) {
      for (const displayRow of getDisplayRows(logicalLineIndex)) {
        rows.add(displayRow);
      }
    }
  }
  return rows;
}

function getLineOperations(
  lines: string[],
  infos: LineOperationInfo[],
  getDisplayRows: (logicalLineIndex: number) => number[],
  context: GetLineOperationsContext,
): LineOperation[] {
  const operations: LineOperation[] = [];

  for (const item of infos) {
    if (item.kind === "frontmatter_boundary") {
      continue;
    }

    const displayRows = item.logicalLineIndexes.flatMap((i) =>
      getDisplayRows(i),
    );

    if (item.kind === "wikilink") {
      const selectors = item.issueSelectors ?? [];
      operations.push({
        kind: "jump",
        displayRows,
        info: item,
        symbol: JUMP_SYMBOL,
        key: JUMP_KEY,
        label: context.intl.formatMessage(messages.jumpLabel),
        action: async () => {
          await jumpFromSelectors(selectors, context.intl);
        },
      });
      continue;
    }

    if (item.kind === "linkage") {
      if (context.issueFolder == null) {
        continue;
      }
      const { linkageType, issueSelector } = item;
      if (linkageType == null || issueSelector == null) {
        continue;
      }
      const issueFolder = context.issueFolder;
      const logicalLineIndex = item.logicalLineIndexes[0]!;
      const line = lines[logicalLineIndex] ?? "";
      const jumpSelectors = issueSelectorsFromLine(line, issueSelector);
      operations.push({
        kind: "jump",
        displayRows,
        info: item,
        symbol: JUMP_SYMBOL,
        key: JUMP_KEY,
        label: context.intl.formatMessage(messages.jumpLabel),
        action: async () => {
          await jumpFromSelectors(jumpSelectors, context.intl);
        },
      });
      operations.push({
        kind: "unlink",
        displayRows,
        info: item,
        symbol: UNLINK_SYMBOL,
        key: UNLINK_KEY,
        label: context.intl.formatMessage(messages.unlinkLabel),
        action: async () => {
          const confirmResult = await useConfirmationDialogStore
            .getState()
            .open({
              title: context.intl.formatMessage(messages.unlinkConfirmTitle),
              message: context.intl.formatMessage(
                messages.unlinkConfirmMessage,
                {
                  issueSelector,
                  linkType: linkageType,
                },
              ),
              confirmLabel: context.intl.formatMessage(
                messages.unlinkConfirmLabel,
              ),
              variant: "destructive",
            });
          if (confirmResult.type !== "accepted") {
            return;
          }

          try {
            const result = await IssueLinkHelper.unlink(
              issueFolder.folderName,
              linkageType,
              issueSelector,
            );
            useFileWatcherStore.getState().requestReload(context.filePath);
            if (result.dstNotFound) {
              await useToastStore.getState().info(
                context.intl.formatMessage(messages.unlinkDstNotFoundToast, {
                  issueSelector,
                }),
              );
            }
          } catch (err) {
            if (isErrorResponse(err)) {
              await useAlertDialogStore.getState().open(err.error.message);
              return;
            }
            throw err;
          }
        },
      });
      continue;
    }

    if (item.kind === "checkbox") {
      const logicalLineIndex = item.logicalLineIndexes[0]!;
      operations.push({
        kind: "checkbox",
        displayRows,
        info: item,
        symbol: CHECKBOX_SYMBOL,
        key: CHECKBOX_KEY,
        label: context.intl.formatMessage(messages.checkboxLabel),
        action: async () => {
          await context.toggleCheckboxAtLine(logicalLineIndex);
        },
      });
      continue;
    }

    if (item.kind === "status") {
      operations.push({
        kind: "status",
        displayRows,
        info: item,
        symbol: FIELD_SYMBOL,
        key: FIELD_KEY,
        label: context.intl.formatMessage(messages.statusLabel),
        action: async () => {
          await setSelectedIssueStatusPaletteCommand.callback();
        },
      });
      continue;
    }

    if (item.kind === "priority") {
      operations.push({
        kind: "priority",
        displayRows,
        info: item,
        symbol: FIELD_SYMBOL,
        key: FIELD_KEY,
        label: context.intl.formatMessage(messages.priorityLabel),
        action: async () => {
          await setSelectedIssuePriorityPaletteCommand.callback();
        },
      });
    }
  }

  return operations;
}

export function MarkdownViewer({
  path: filePath,
  width,
  height,
  handle,
  issueFolder,
  isDisabled = false,
  onChanged,
  onLogicalLineIndexChanged,
}: MarkdownViewerProps) {
  const intl = useIntl();
  const hasPopup = usePopupStore((s) => s.hasPopup);
  const isTextEditOpenForFile = useTextEditDialogStore(
    (s) => s.isDialogOpen && s.filePath === filePath,
  );
  const fileService = FileService.getInstance();

  const [scrollOffset, setScrollOffset] = useState(0);
  const [linkTypeFieldNames, setLinkTypeFieldNames] = useState<string[]>([]);

  const content = useStore(handle, (s) => s.content);
  const lines = useMemo(
    () => (content.length > 0 ? content.split("\n") : [""]),
    [content],
  );
  const selectedLogicalLineIndex = useStore(
    handle,
    (s) => s.selectedLogicalLineIndex,
  );
  const selectedDisplaySubRow = useStore(
    handle,
    (s) => s.selectedDisplaySubRow,
  );
  const selectionAnchorLogicalLineIndex = useStore(
    handle,
    (s) => s.selectionAnchorLogicalLineIndex,
  );

  const cancelledRef = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const metadataRef = useRef<{
    displayTitle: string;
    frontmatterTitle?: string;
    status?: string;
    priority?: string;
  }>({ displayTitle: "" });
  const onLogicalLineIndexChangedRef = useRef(onLogicalLineIndexChanged);
  onLogicalLineIndexChangedRef.current = onLogicalLineIndexChanged;

  const emitChanged = useCallback(
    (nextLines: string[], updatedAt: Date) => {
      onChangedRef.current?.({
        path: filePath,
        lines: nextLines,
        displayTitle: metadataRef.current.displayTitle,
        frontmatterTitle: metadataRef.current.frontmatterTitle,
        status: metadataRef.current.status,
        priority: metadataRef.current.priority,
        updatedAt,
      });
    },
    [filePath],
  );

  const applyContent = useCallback(
    (raw: string, logicalLineIndex?: number) => {
      if (cancelledRef.current) return;
      handle.getState().setContent({
        content: raw,
        ...(logicalLineIndex !== undefined ? { logicalLineIndex } : {}),
      });
    },
    [handle],
  );

  const loadFile = useCallback(async () => {
    const raw = (await fileService.readFile(filePath, "utf-8")) as string;
    if (cancelledRef.current) return;

    const normalizedRaw = raw.replace(/\r\n/g, "\n");
    const currentText = handle.getState().content;
    if (normalizedRaw === currentText && currentText.length > 0) {
      return;
    }

    applyContent(raw);
  }, [applyContent, filePath, fileService, handle]);

  useEffect(() => {
    handle.getState().setFilePath(filePath);
  }, [handle, filePath]);

  useEffect(() => {
    handle.getState().setOnLinesChanged((nextLines) => {
      handle.getState().updateContent(nextLines.join("\n"));
    });
    handle.getState().setOnSaved((mtime) => {
      const nextLines =
        handle.getState().content.length > 0
          ? handle.getState().content.split("\n")
          : [""];
      emitChanged(nextLines, mtime);
    });
  }, [emitChanged, filePath, handle]);

  useEffect(() => {
    if (content === "") {
      return;
    }

    let cancelled = false;
    void (async () => {
      const rawLines = content.length > 0 ? content.split("\n") : [""];
      const mdStorage = new IssueMarkdownFileStorage(filePath);
      await mdStorage.load();
      if (cancelled || cancelledRef.current) return;

      const { frontmatter } = mdStorage.getParsed();
      const dataTitle =
        typeof frontmatter?.title === "string" ? frontmatter.title : undefined;
      const frontmatterTitle =
        typeof frontmatter?.title === "string" && frontmatter.title.trim() !== ""
          ? frontmatter.title.trim()
          : undefined;

      metadataRef.current = {
        displayTitle: buildDisplayTitle(dataTitle, rawLines, filePath),
        frontmatterTitle,
        status: mdStorage.getStatus(),
        priority: mdStorage.getPriority(),
      };

      const stat = await fileService.stat(filePath);
      if (cancelled || cancelledRef.current) return;
      emitChanged(rawLines, stat.mtime);
    })();

    return () => {
      cancelled = true;
    };
  }, [content, emitChanged, filePath, fileService]);

  const fileWatcherEnabled = !isDisabled && !isTextEditOpenForFile;

  useFileWatcher(filePath, {
    onReload: () => {
      void loadFile();
    },
    enabled: fileWatcherEnabled,
  });

  useEffect(() => {
    cancelledRef.current = false;
    handle.getState().resetCursor();
    setScrollOffset(0);
    void loadFile();
    return () => {
      cancelledRef.current = true;
      void handle.getState().save();
    };
  }, [filePath, loadFile, handle]);

  useEffect(() => {
    if (issueFolder == null) {
      setLinkTypeFieldNames([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
      if (cancelled) return;

      const globalConfig = await useGlobalConfigStore
        .getState()
        .ensureGlobalConfig();
      if (cancelled) return;

      const repoStorage = new TrackerRepoStorage(repo, globalConfig);
      const names = LinkageTypesAccessor.fromPairs(
        repoStorage.getLinkTypes(),
      ).getAllFieldNames();
      setLinkTypeFieldNames(names);
    })();

    return () => {
      cancelled = true;
    };
  }, [issueFolder]);

  const pageSize = Math.max(1, height);
  const wrapWidth = Math.max(1, width - LINE_BEGIN_PADDING);
  const textLayouter = useMemo(() => new TextLayouter(), []);
  const textLayouterContentRef = useRef<string[] | undefined>(undefined);
  if (textLayouterContentRef.current !== lines) {
    textLayouter.setContent(lines);
    textLayouterContentRef.current = lines;
  }
  const { formattedContent: displayLines } = textLayouter.layout(
    wrapWidth,
    0,
  );

  const maxIndex = Math.max(0, displayLines.length - 1);
  const maxLogicalIndex = Math.max(0, lines.length - 1);
  const clampedLogicalLineIndex = clamp(
    selectedLogicalLineIndex,
    0,
    maxLogicalIndex,
  );
  const clampedIndex = displayIndexForLogicalLine(
    textLayouter,
    clampedLogicalLineIndex,
    selectedDisplaySubRow,
    maxIndex,
  );

  useLayoutEffect(() => {
    setScrollOffset((prev) =>
      ensureScrollShowsSelection(prev, clampedIndex, pageSize, maxIndex),
    );
  }, [clampedIndex, maxIndex, pageSize]);

  useEffect(() => {
    onLogicalLineIndexChangedRef.current?.(clampedLogicalLineIndex);
  }, [clampedLogicalLineIndex]);

  useEffect(() => {
    if (handle.getState().currentDisplayIndex !== clampedIndex) {
      handle
        .getState()
        .setCursor(
          clampedLogicalLineIndex,
          selectedDisplaySubRow,
          clampedIndex,
        );
    }
  }, [
    handle,
    clampedIndex,
    clampedLogicalLineIndex,
    selectedDisplaySubRow,
  ]);

  const getDisplayRows = (logicalLineIndex: number) =>
    textLayouter.getDisplayRowsForLogicalLine(logicalLineIndex);

  const lineOperationInfos = parseLineOperationInfos(
    lines,
    linkTypeFieldNames,
  );
  const lineOperations = getLineOperations(
    lines,
    lineOperationInfos,
    getDisplayRows,
    {
      toggleCheckboxAtLine: (logicalLineIndex) =>
        handle.getState().toggleCheckboxAtLine(logicalLineIndex),
      issueFolder,
      filePath,
      intl,
    },
  );
  const frontmatterBoundaryDisplayRows = getFrontmatterBoundaryDisplayRows(
    lineOperationInfos,
    getDisplayRows,
  );

  const selectedLogicalRange =
    selectionAnchorLogicalLineIndex == null
      ? null
      : {
          start: Math.min(
            selectionAnchorLogicalLineIndex,
            clampedLogicalLineIndex,
          ),
          end: Math.max(
            selectionAnchorLogicalLineIndex,
            clampedLogicalLineIndex,
          ),
        };

  const setIndex = useCallback(
    (next: number) => {
      const displayIdx = clamp(next, 0, maxIndex);
      const logicalIdx = textLayouter.getLogicalLineIndex(displayIdx);
      const displayRows = textLayouter.getDisplayRowsForLogicalLine(logicalIdx);
      const subRow = Math.max(0, displayRows.indexOf(displayIdx));
      handle.getState().setCursor(logicalIdx, subRow, displayIdx);
      setScrollOffset((prev) =>
        ensureScrollShowsSelection(prev, displayIdx, pageSize, maxIndex),
      );
    },
    [maxIndex, pageSize, textLayouter, handle],
  );

  useInput(
    (input, key) => {
      if (displayLines.length === 0) return;

      if (input === "v" || input === "V") {
        handle.getState().toggleSelectionMode();
        return;
      }

      const opsForRow = LineOperationFormatter.getOperationsForRow(
        lineOperations,
        clampedIndex,
      );
      if (opsForRow.length > 0) {
        const matchedOp = opsForRow.find((op) =>
          KeyMatcher.match(op.key, input, key),
        );
        if (matchedOp != null) {
          void matchedOp.action();
          return;
        }

        const spacePressed = KeyMatcher.match("Space", input, key);
        const multiOpKeyPressed = KeyMatcher.match(
          LineOperationFormatter.MULTI_OP_KEY,
          input,
          key,
        );

        if (opsForRow.length === 1 && spacePressed) {
          void opsForRow[0]!.action();
          return;
        }

        if (opsForRow.length === 2 && spacePressed) {
          void openLineOperationPicker(opsForRow, intl);
          return;
        }

        if (
          opsForRow.length > 2 &&
          (spacePressed || multiOpKeyPressed)
        ) {
          void openLineOperationPicker(opsForRow, intl);
          return;
        }
      }

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
        return;
      }
      if (key.pageUp) {
        setIndex(clampedIndex - pageSize);
        return;
      }
      if (key.home) {
        setIndex(0);
        return;
      }
      if (key.end) {
        setIndex(maxIndex);
        return;
      }
    },
    { isActive: !hasPopup && !isDisabled },
  );

  const visible = displayLines.slice(scrollOffset, scrollOffset + pageSize);
  const paddedVisible =
    visible.length >= pageSize
      ? visible
      : [...visible, ...Array(pageSize - visible.length).fill("")];

  return (
    <>
      {paddedVisible.map((line, i) => {
        const globalIndex = scrollOffset + i;
        const isCursor = globalIndex === clampedIndex;
        const logicalForRow = textLayouter.getLogicalLineIndex(globalIndex);
        const isInSelection =
          selectedLogicalRange != null &&
          logicalForRow >= selectedLogicalRange.start &&
          logicalForRow <= selectedLogicalRange.end;
        const isHighlighted = isCursor || isInSelection;
        const opsForRow = LineOperationFormatter.getOperationsForRow(
          lineOperations,
          globalIndex,
        );
        const contentWidth = width - LINE_BEGIN_PADDING;
        const visibleLine =
          line.length >= contentWidth ? line.slice(0, contentWidth) : line;
        const linePad = " ".repeat(
          Math.max(0, contentWidth - visibleLine.length),
        );
        const isFrontmatterBoundary =
          frontmatterBoundaryDisplayRows.has(globalIndex);
        const lineText =
          isFrontmatterBoundary && !isCursor ? (
            <>
              <Text color={DefaultTheme.accents.green}>{visibleLine}</Text>
              {linePad}
            </>
          ) : (
            visibleLine + linePad
          );

        if (isCursor && opsForRow.length > 0) {
          const gutterPrefix =
            LineOperationFormatter.formatGutterPrefix(opsForRow);
          return (
            <Box key={`${globalIndex}`} width={width} height={1}>
              <Text inverse>
                <Text inverse color={DefaultTheme.accents.cyan}>
                  {gutterPrefix}
                </Text>
                {lineText}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={`${globalIndex}`} width={width} height={1}>
            <Text inverse={isHighlighted}>
              {" ".repeat(LINE_BEGIN_PADDING)}
              {lineText}
            </Text>
          </Box>
        );
      })}
    </>
  );
}
