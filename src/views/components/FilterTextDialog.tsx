import { useEffect, useMemo } from "react";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand/react";
import { Box, Text, useInput } from "ink";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";
import { InteractiveTextInput } from "./InteractiveTextInput.tsx";
import { ToolBar, type ToolbarConfigItem } from "./ToolBar.tsx";
import { useDialogLayout, type DialogLayoutInput } from "../hooks/useDialogLayout.ts";
import { useTerminalSize } from "../hooks/useTerminal.ts";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { clamp } from "../../types/maths.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";

const FILTER_TEXT_DIALOG_MIN_WIDTH = 62;
const FILTER_TEXT_DIALOG_INPUT_RIGHT_MARGIN = 1;
const FILTER_TEXT_DIALOG_HORIZONTAL_BORDER_WIDTH = 2;
const FILTER_TEXT_DIALOG_VERTICAL_BORDER_HEIGHT = 2;
const FILTER_TEXT_DIALOG_BODY_MARGIN_TOP = 1;
const FILTER_TEXT_DIALOG_FOOTER_MARGIN_TOP = 1;
const FILTER_TEXT_DIALOG_FIXED_ROWS_EXCEPT_LIST =
  FILTER_TEXT_DIALOG_VERTICAL_BORDER_HEIGHT +
  FILTER_TEXT_DIALOG_BODY_MARGIN_TOP +
  1 /* input */ +
  FILTER_TEXT_DIALOG_FOOTER_MARGIN_TOP +
  1 /* footer */;
const FILTER_TEXT_DIALOG_BORDERED_CHROME_ROWS =
  FILTER_TEXT_DIALOG_VERTICAL_BORDER_HEIGHT +
  FILTER_TEXT_DIALOG_BODY_MARGIN_TOP +
  1 /* input */ +
  1 /* footer */;

export type Choice = {
  key: string;
  text: string;
};

export type FilterTextDialogOpenOptions = {
  initialFilterQuery?: string;
  onFilterQueryChanged: (filterQuery: string) => void;
  onActivate?: (choice: Choice) => void;
  onDismiss?: () => void;
};

type FilterTextDialogCallbackSlice = {
  onFilterQueryChanged: ((filterQuery: string) => void) | null;
  onActivate: ((choice: Choice) => void) | null;
  onDismiss: (() => void) | null;
};

export type FilterTextDialogStoreState = {
  isOpen: boolean;
  filterQuery: string;
  choices: Choice[];
  selectedKey: string | null;
  listScrollOffset: number;
  dialogInputKey: number;
  open: (options: FilterTextDialogOpenOptions) => void;
  close: () => void;
  dismissEscape: () => void;
  setFilterQuery: (query: string) => void;
  setChoiceList: (choices: Choice[]) => void;
  setListScrollOffset: (offset: number) => void;
  moveSelection: (delta: number) => void;
  activateSelected: () => void;
  getSelectedIndex: () => number;
} & FilterTextDialogCallbackSlice;

export type FilterTextDialogStore = StoreApi<FilterTextDialogStoreState>;

function filterTextDialogPreferredWidth(screen: { cols: number }): number {
  return Math.max(
    FILTER_TEXT_DIALOG_MIN_WIDTH,
    Math.floor(screen.cols * 0.8),
  );
}

function ensureListScrollShowsSelection(
  scrollOffset: number,
  selectedIndex: number,
  pageSize: number,
  maxLineIndex: number,
): number {
  if (maxLineIndex < 0) return 0;
  const idx = clamp(selectedIndex, 0, maxLineIndex);
  if (idx < scrollOffset) return idx;
  if (idx >= scrollOffset + pageSize) {
    return Math.max(0, idx - pageSize + 1);
  }
  return scrollOffset;
}

function choiceKeysFingerprint(choices: Choice[]): string {
  return choices.map((choice) => choice.key).join("|");
}

function closedContentSlice(): Pick<
  FilterTextDialogStoreState,
  | "isOpen"
  | "filterQuery"
  | "choices"
  | "selectedKey"
  | "listScrollOffset"
  | "dialogInputKey"
> & FilterTextDialogCallbackSlice {
  return {
    isOpen: false,
    filterQuery: "",
    choices: [],
    selectedKey: null,
    listScrollOffset: 0,
    dialogInputKey: 0,
    onFilterQueryChanged: null,
    onActivate: null,
    onDismiss: null,
  };
}

export function createFilterTextDialogStore(): FilterTextDialogStore {
  return createStore<FilterTextDialogStoreState>((set, get) => ({
    ...closedContentSlice(),

    getSelectedIndex: () => {
      const { choices, selectedKey } = get();
      if (selectedKey == null) return -1;
      return choices.findIndex((choice) => choice.key === selectedKey);
    },

    open: (options) => {
      const filterQuery = options.initialFilterQuery ?? "";
      set({
        isOpen: true,
        filterQuery,
        choices: [],
        selectedKey: null,
        listScrollOffset: 0,
        dialogInputKey: get().dialogInputKey + 1,
        onFilterQueryChanged: options.onFilterQueryChanged,
        onActivate: options.onActivate ?? null,
        onDismiss: options.onDismiss ?? null,
      });
      options.onFilterQueryChanged(filterQuery);
    },

    close: () => {
      if (!get().isOpen) return;
      set(closedContentSlice());
    },

    dismissEscape: () => {
      if (!get().isOpen) return;
      get().onDismiss?.();
      set(closedContentSlice());
    },

    setFilterQuery: (filterQuery) => {
      set({ filterQuery });
      get().onFilterQueryChanged?.(filterQuery);
    },

    setListScrollOffset: (listScrollOffset) => {
      set({ listScrollOffset });
    },

    setChoiceList: (choices) => {
      set((state) => {
        const sameKeys =
          choiceKeysFingerprint(state.choices) ===
          choiceKeysFingerprint(choices);
        if (sameKeys) {
          return { choices };
        }
        return {
          choices,
          selectedKey: choices[0]?.key ?? null,
          listScrollOffset: 0,
        };
      });
    },

    moveSelection: (delta) => {
      if (delta === 0) return;
      const { choices, selectedKey } = get();
      if (choices.length === 0) return;
      const currentIndex =
        selectedKey == null
          ? 0
          : choices.findIndex((choice) => choice.key === selectedKey);
      const baseIndex = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = clamp(baseIndex + delta, 0, choices.length - 1);
      set({ selectedKey: choices[nextIndex]?.key ?? null });
    },

    activateSelected: () => {
      const { choices, selectedKey, onActivate } = get();
      if (choices.length === 0 || selectedKey == null) return;
      const choice = choices.find((item) => item.key === selectedKey);
      if (choice == null) return;
      onActivate?.(choice);
    },
  }));
}

export type FilterTextDialogProps = {
  store: FilterTextDialogStore;
  isActive: boolean;
  title: string;
  placeholder: string;
  noMatchesLabel: string;
  footerCancelLabel: string;
  footerConfirmLabel: string;
  isChoiceDisabled?: (key: string) => boolean;
  /** Bordered dialog dimensions; EmptyArea margin is applied internally. */
  layoutInput?: DialogLayoutInput;
};

export function FilterTextDialog({
  store,
  isActive,
  title,
  placeholder,
  noMatchesLabel,
  footerCancelLabel,
  footerConfirmLabel,
  isChoiceDisabled,
  layoutInput,
}: FilterTextDialogProps) {
  const size = useTerminalSize();

  const isOpen = useStore(store, (s) => s.isOpen);
  const filterQuery = useStore(store, (s) => s.filterQuery);
  const choices = useStore(store, (s) => s.choices);
  const selectedKey = useStore(store, (s) => s.selectedKey);
  const dialogInputKey = useStore(store, (s) => s.dialogInputKey);
  const dismissEscape = useStore(store, (s) => s.dismissEscape);
  const activateSelected = useStore(store, (s) => s.activateSelected);
  const moveSelection = useStore(store, (s) => s.moveSelection);
  const setFilterQuery = useStore(store, (s) => s.setFilterQuery);
  const listScrollOffset = useStore(store, (s) => s.listScrollOffset);
  const setListScrollOffset = useStore(store, (s) => s.setListScrollOffset);

  const selectedIndex = useMemo(() => {
    if (selectedKey == null) return -1;
    return choices.findIndex((choice) => choice.key === selectedKey);
  }, [choices, selectedKey]);

  const terminalRows =
    size.rows > 0
      ? size.rows
      : Math.max(FILTER_TEXT_DIALOG_FIXED_ROWS_EXCEPT_LIST + 4, 10);

  const maxVisibleListRows = Math.max(
    1,
    terminalRows -
      FILTER_TEXT_DIALOG_FIXED_ROWS_EXCEPT_LIST -
      2 /* slack for overlapping title */,
  );

  const listViewportRows = maxVisibleListRows;

  const fixedDialogHeight =
    FILTER_TEXT_DIALOG_VERTICAL_BORDER_HEIGHT +
    FILTER_TEXT_DIALOG_BODY_MARGIN_TOP +
    1 +
    listViewportRows +
    FILTER_TEXT_DIALOG_FOOTER_MARGIN_TOP +
    1;

  const dialogLayoutInput = useMemo(
    () =>
      layoutInput ?? {
        minWidth: FILTER_TEXT_DIALOG_MIN_WIDTH + EMPTY_AREA_EXTRA,
        maxWidth: (screen: { cols: number; rows: number }) =>
          filterTextDialogPreferredWidth(screen) + EMPTY_AREA_EXTRA,
        minHeight: fixedDialogHeight + EMPTY_AREA_EXTRA,
        maxHeight: fixedDialogHeight + EMPTY_AREA_EXTRA,
      },
    [fixedDialogHeight, layoutInput],
  );

  const usesBorderedLayout = layoutInput != null;

  const { width, height, left, top } = useDialogLayout(dialogLayoutInput);

  const borderedWidth = usesBorderedLayout ? width : width - EMPTY_AREA_EXTRA;
  const borderedHeight = usesBorderedLayout ? height : height - EMPTY_AREA_EXTRA;
  const dialogHeight = usesBorderedLayout ? borderedHeight : fixedDialogHeight;
  const listRows = usesBorderedLayout
    ? Math.max(1, borderedHeight - FILTER_TEXT_DIALOG_BORDERED_CHROME_ROWS)
    : listViewportRows;
  const emptyAreaWidth = usesBorderedLayout
    ? borderedWidth + EMPTY_AREA_EXTRA
    : width;
  const emptyAreaHeight = usesBorderedLayout
    ? dialogHeight + EMPTY_AREA_EXTRA
    : height;
  const emptyAreaLeft = usesBorderedLayout
    ? Math.max(0, left - EMPTY_AREA_SIDE_MARGIN)
    : left;
  const emptyAreaTop = usesBorderedLayout
    ? Math.max(0, top - EMPTY_AREA_SIDE_MARGIN)
    : top;
  const contentWidth = Math.max(
    8,
    borderedWidth - FILTER_TEXT_DIALOG_HORIZONTAL_BORDER_WIDTH,
  );

  const maxChoiceIndex =
    choices.length === 0 ? -1 : Math.max(0, choices.length - 1);

  useEffect(() => {
    const nextOffset = ensureListScrollShowsSelection(
      store.getState().listScrollOffset,
      selectedIndex,
      listRows,
      maxChoiceIndex,
    );
    if (nextOffset !== store.getState().listScrollOffset) {
      setListScrollOffset(nextOffset);
    }
  }, [
    selectedIndex,
    listRows,
    maxChoiceIndex,
    choices.length,
    listScrollOffset,
    setListScrollOffset,
    store,
  ]);

  const footerItems = useMemo<ToolbarConfigItem[]>(
    () => [
      {
        label: footerCancelLabel,
        key: "Esc",
        callback: () => {
          dismissEscape();
        },
      },
      {
        label: footerConfirmLabel,
        key: "Enter",
        callback: () => {
          activateSelected();
        },
        color: DialogConfirmColor,
      },
    ],
    [footerCancelLabel, footerConfirmLabel, dismissEscape, activateSelected],
  );

  useInput(
    (_input, key) => {
      if (!isActive) return;

      if (key.upArrow) {
        moveSelection(-1);
        return;
      }
      if (key.downArrow) {
        moveSelection(1);
        return;
      }
    },
    {
      isActive,
    },
  );

  const filterInputMaxCols = Math.max(
    4,
    contentWidth - FILTER_TEXT_DIALOG_INPUT_RIGHT_MARGIN,
  );

  const paintedRows = (() => {
    if (choices.length === 0) {
      const noRow = BasicLayouter.stringWidthTruncateEnd(noMatchesLabel, contentWidth);
      const lines: string[] = [noRow];
      for (let i = 1; i < listRows; i++) {
        lines.push("");
      }
      return lines;
    }
    const lines = choices
      .slice(listScrollOffset, listScrollOffset + listRows)
      .map((choice) => choice.text);
    while (lines.length < listRows) {
      lines.push("");
    }
    return lines;
  })();

  if (!isOpen || !isActive) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={emptyAreaLeft}
      marginTop={emptyAreaTop}
      flexDirection="column"
      width={emptyAreaWidth}
      height={emptyAreaHeight}
    >
      <Box
        flexDirection="column"
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={borderedWidth}
        height={dialogHeight}
        borderStyle="single"
        borderColor={DefaultTheme.accents.green}
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={0}
        paddingTop={0}
        paddingBottom={0}
      >
        <Box position="absolute" marginTop={-1} marginLeft={0}>
          <Text color={DefaultTheme.accents.orange}>{title}</Text>
        </Box>
        <Box
          flexDirection="column"
          marginTop={1}
          flexGrow={usesBorderedLayout ? 1 : undefined}
        >
          <Box flexDirection="row" marginBottom={0} width={contentWidth}>
            <InteractiveTextInput
              key={dialogInputKey}
              isActive={isActive}
              history={[]}
              initialValue={filterQuery}
              onChange={setFilterQuery}
              placeholder={placeholder}
              maxDisplayWidth={filterInputMaxCols}
            />
          </Box>
          <Box
            flexDirection="column"
            flexGrow={usesBorderedLayout ? 1 : undefined}
          >
            {paintedRows.map((rowStr, i) => {
            if (choices.length === 0) {
              return (
                <Box
                  key={`filter-empty-${String(i)}`}
                  height={1}
                  width={contentWidth}
                  flexShrink={0}
                >
                  <Text dimColor>{rowStr}</Text>
                </Box>
              );
            }
            const logicalIndex = listScrollOffset + i;
            const choice =
              logicalIndex < choices.length
                ? choices[logicalIndex]
                : undefined;
            const isDisabled =
              choice != null && isChoiceDisabled?.(choice.key) === true;
            const isSelected =
              choice !== undefined &&
              selectedIndex >= 0 &&
              logicalIndex === selectedIndex;
            const rowKey =
              choice != null
                ? `choice-${choice.key}-${String(logicalIndex)}`
                : `choice-slot-${String(i)}`;
            return (
              <Box
                key={rowKey}
                height={1}
                width={contentWidth}
                flexShrink={0}
              >
                <Text inverse={isSelected} dimColor={isDisabled && !isSelected}>
                  {rowStr}
                </Text>
              </Box>
            );
          })}
          </Box>
        </Box>
        <Box
          marginTop={
            usesBorderedLayout ? 0 : FILTER_TEXT_DIALOG_FOOTER_MARGIN_TOP
          }
          flexShrink={0}
          justifyContent="flex-end"
        >
          <ToolBar
            width={Math.max(8, contentWidth - 2)}
            items={footerItems}
            isDisabled={!isActive}
          />
        </Box>
      </Box>
    </EmptyArea>
  );
}
