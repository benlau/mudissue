import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { useInput, Box, Text } from "ink";
import { LineListPickerView } from "./LineListPickerView.tsx";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";
import { useDialogLayout } from "../hooks/useDialogLayout.ts";
import { useTerminalSize } from "../hooks/useTerminal.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import type { TableColumnDef } from "../../types/TableLayout.ts";
import { AnsiEscapeCode } from "../../types/ansi.ts";
import { TableLayouter } from "../../foundation/layouter/TableLayouter.ts";
import { DefaultTheme } from "../../types/Theme.ts";

const PICK_ITEM_DIALOG_MIN_WIDTH = 52;
const PICK_ITEM_DIALOG_MAX_WIDTH = 86;
const PICK_ITEM_DIALOG_MAX_VIEWPORT_ROWS = 20;
const PICK_ITEM_DEFAULT_TITLE = "Select item";
const PICK_ITEM_DIALOG_HORIZONTAL_BORDER_WIDTH = 2;
const PICK_ITEM_DIALOG_VERTICAL_BORDER_HEIGHT = 2;
const PICK_ITEM_DIALOG_MIN_VISIBLE_ROWS_OFFSET = 3;
const PICK_ITEM_DIALOG_POSITION_LABEL_RESERVED_WIDTH = 4;
const PICK_ITEM_DIALOG_COLUMN_GAP_WIDTH = 1;

type PickItemDialogDisplay = string | string[];

export type PickItemDialogOptions = {
  title?: string;
  columns?: TableColumnDef[];
  footerLabel?: string;
  minWidth?: number;
  maxWidth?: number;
  /** Index into the item list (not the Cancel footer row) to highlight on open. */
  initialSelectedIndex?: number;
};

export enum PickItemDialogResponseType {
  Accepted,
  Cancelled,
}

export interface PickItemDialogResponse<T> {
  type: PickItemDialogResponseType;
  acceptedValue?: T;
}

type PickItemDialogStoreState = {
  isDialogOpen: boolean;
  items: unknown[];
  getDisplay: (item: unknown) => PickItemDialogDisplay;
  title: string;
  columns: TableColumnDef[];
  footerLabel: string;
  minWidth: number;
  maxWidth: number;
  geom: PickItemDialogGeom;
  displayRows: string[];
  initialSelectedIndex: number;
  pendingResolve:
    | ((response: PickItemDialogResponse<unknown>) => void)
    | null;
  open: <T,>(
    itemList: T[],
    getDisplayFn: (item: T) => PickItemDialogDisplay,
    options?: PickItemDialogOptions,
  ) => Promise<PickItemDialogResponse<T>>;
  close: () => void;
  confirm: (index: number) => void;
  layout: (width: number) => void;
};

type PickItemDialogGeom = {
  dialogWidth: number;
  contentWidth: number;
  columnWidths: number[];
  tableWidth: number;
};

const initialPickItemSlice = {
  isDialogOpen: false,
  items: [] as unknown[],
  getDisplay: String as (item: unknown) => PickItemDialogDisplay,
  title: PICK_ITEM_DEFAULT_TITLE,
  columns: [] as TableColumnDef[],
  footerLabel: "Cancel<Esc>",
  minWidth: PICK_ITEM_DIALOG_MIN_WIDTH,
  maxWidth: PICK_ITEM_DIALOG_MAX_WIDTH,
  geom: {
    dialogWidth: 0,
    contentWidth: 0,
    columnWidths: [] as number[],
    tableWidth: 0,
  },
  displayRows: [] as string[],
  initialSelectedIndex: 0,
  pendingResolve: null as PickItemDialogStoreState["pendingResolve"],
};

function getDisplayCells(
  item: unknown,
  getDisplay: (item: unknown) => PickItemDialogDisplay,
): string[] {
  const display = getDisplay(item);
  if (Array.isArray(display)) {
    return display.map((x) => String(x ?? ""));
  }
  return [String(display ?? "")];
}

function normalizeLayoutColumns(
  columns: TableColumnDef[],
  displayRows: string[][],
): TableColumnDef[] {
  const columnCount = Math.max(
    1,
    columns.length,
    ...displayRows.map((row) => row.length),
  );
  return Array.from({ length: columnCount }, (_, index) => columns[index] ?? {});
}

function getTableWidth(columnWidths: number[]): number {
  const columnsWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const gapsWidth =
    Math.max(0, columnWidths.length - 1) * PICK_ITEM_DIALOG_COLUMN_GAP_WIDTH;
  return columnsWidth + gapsWidth;
}

function formatFooterLabel(footerLabel: string, width: number): string {
  return footerLabel.slice(0, width).padEnd(width, " ");
}

export function getPositionLabel(
  selectedIndex: number,
  itemCount: number,
): string {
  if (itemCount === 0) return "0/0";
  if (selectedIndex >= itemCount) return "";
  return `${selectedIndex + 1}/${itemCount}`;
}

export const usePickItemDialogStore = create<PickItemDialogStoreState>(
  (set, get) => ({
    ...initialPickItemSlice,

    open: <T,>(
      itemList: T[],
      getDisplayFn: (item: T) => PickItemDialogDisplay,
      options?: PickItemDialogOptions,
    ): Promise<PickItemDialogResponse<T>> => {
      return new Promise((resolve) => {
        usePopupStore.getState().pushPopup(PopupNames.PickItemDialog);
        const title = options?.title?.trim() || PICK_ITEM_DEFAULT_TITLE;
        const columns = options?.columns ?? [];
        const footerLabel = options?.footerLabel ?? initialPickItemSlice.footerLabel;
        const optionMinWidth = options?.minWidth ?? PICK_ITEM_DIALOG_MIN_WIDTH;
        const optionMaxWidth = options?.maxWidth ?? PICK_ITEM_DIALOG_MAX_WIDTH;
        const minWidth = Math.max(1, optionMinWidth);
        const maxWidth = Math.max(minWidth, optionMaxWidth);
        const items = itemList as unknown[];
        const requestedIndex = options?.initialSelectedIndex ?? 0;
        const initialSelectedIndex =
          items.length === 0
            ? 0
            : Math.max(0, Math.min(requestedIndex, items.length - 1));
        set({
          items,
          getDisplay: getDisplayFn as (item: unknown) => PickItemDialogDisplay,
          title,
          columns,
          footerLabel,
          minWidth,
          maxWidth,
          geom: initialPickItemSlice.geom,
          displayRows: [],
          initialSelectedIndex,
          isDialogOpen: true,
          pendingResolve:
            resolve as (response: PickItemDialogResponse<unknown>) => void,
        });
      });
    },

    close: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        isDialogOpen: false,
        pendingResolve: null,
        displayRows: [],
        geom: initialPickItemSlice.geom,
      });
      pendingResolve?.({ type: PickItemDialogResponseType.Cancelled });
    },

    confirm: (index: number) => {
      const { isDialogOpen, items, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        isDialogOpen: false,
        pendingResolve: null,
        displayRows: [],
        geom: initialPickItemSlice.geom,
      });
      if (index < 0 || index >= items.length) {
        pendingResolve?.({ type: PickItemDialogResponseType.Cancelled });
        return;
      }
      const value = items[index];
      pendingResolve?.({
        type: PickItemDialogResponseType.Accepted,
        acceptedValue: value,
      });
    },

    layout: (availableWidth: number) => {
      const { items, getDisplay, columns, footerLabel, minWidth, maxWidth } =
        get();
      const safeAvailableWidth = Math.max(0, Math.floor(availableWidth));
      const dialogMinWidth = Math.max(1, Math.min(safeAvailableWidth, minWidth));
      const tableWidthRange = new TableLayouter(columns).getMinMaxWidth();
      const expectedDialogWidth = Math.max(
        dialogMinWidth,
        tableWidthRange.minWidth + PICK_ITEM_DIALOG_HORIZONTAL_BORDER_WIDTH,
      );
      const dialogWidth = Math.max(
        dialogMinWidth,
        Math.min(maxWidth, expectedDialogWidth, safeAvailableWidth),
      );
      const contentWidth = Math.max(
        1,
        dialogWidth - PICK_ITEM_DIALOG_HORIZONTAL_BORDER_WIDTH,
      );
      const displayCells = items.map((item) =>
        getDisplayCells(item, getDisplay),
      );
      const layoutColumns = normalizeLayoutColumns(columns, displayCells);
      const layouter = new TableLayouter(layoutColumns);
      const columnWidths = layouter.layout(contentWidth);

      const displayRows = [
        ...displayCells.map((cells) => layouter.makeRow(cells)),
        formatFooterLabel(footerLabel, contentWidth),
      ];
      set({
        displayRows,
        geom: {
          dialogWidth,
          contentWidth,
          columnWidths,
          tableWidth: getTableWidth(columnWidths),
        },
      });
    },
  }),
);

export function PickItemDialog() {
  const isDialogOpen = usePickItemDialogStore((s) => s.isDialogOpen);
  const items = usePickItemDialogStore((s) => s.items);
  const getDisplay = usePickItemDialogStore((s) => s.getDisplay);
  const title = usePickItemDialogStore((s) => s.title);
  const [positionLabel, setPositionLabel] = useState("");
  const geom = usePickItemDialogStore((s) => s.geom);
  const minWidth = usePickItemDialogStore((s) => s.minWidth);
  const displayRows = usePickItemDialogStore((s) => s.displayRows);
  const initialSelectedIndex = usePickItemDialogStore(
    (s) => s.initialSelectedIndex,
  );
  const layout = usePickItemDialogStore((s) => s.layout);
  const close = usePickItemDialogStore((s) => s.close);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.PickItemDialog;

  const terminalSize = useTerminalSize();
  const maxViewportRows = Math.max(
    0,
    Math.min(
      PICK_ITEM_DIALOG_MAX_VIEWPORT_ROWS,
      terminalSize.rows - PICK_ITEM_DIALOG_MIN_VISIBLE_ROWS_OFFSET,
    ),
  );
  const listHeight =
    displayRows.length === 0
      ? 0
      : Math.min(displayRows.length, maxViewportRows);
  const dialogHeight = listHeight + PICK_ITEM_DIALOG_VERTICAL_BORDER_HEIGHT;
  const borderedDialogWidth = Math.max(1, geom.dialogWidth);
  const { width, height, left, top } = useDialogLayout({
    minWidth: minWidth + EMPTY_AREA_EXTRA,
    maxWidth: borderedDialogWidth + EMPTY_AREA_EXTRA,
    minHeight: dialogHeight + EMPTY_AREA_EXTRA,
    maxHeight: dialogHeight + EMPTY_AREA_EXTRA,
  });

  useEffect(() => {
    if (!isDialogOpen) return;
    layout(terminalSize.cols);
  }, [getDisplay, isDialogOpen, items, layout, terminalSize.cols]);

  useEffect(() => {
    if (isDialogOpen) {
      setPositionLabel("");
    }
  }, [isDialogOpen]);

  const onLineListSelectedIndexChange = useCallback((idx: number) => {
    const { items: stItems } = usePickItemDialogStore.getState();
    setPositionLabel(getPositionLabel(idx, stItems.length));
  }, []);

  const onLineListSelected = useCallback((idx: number) => {
    const state = usePickItemDialogStore.getState();
    const { items: stItems } = state;
    if (idx === stItems.length) {
      state.close();
    } else {
      state.confirm(idx);
    }
  }, []);

  useInput(
    (input, key) => {
      if (!isDialogOpen || !isLatestPopup) return;
      if (key.escape || input === AnsiEscapeCode.ESC) {
        close();
      }
    },
    { isActive: isDialogOpen && isLatestPopup },
  );

  const bottomLabelLeft = Math.max(
    1,
    borderedDialogWidth -
      PICK_ITEM_DIALOG_POSITION_LABEL_RESERVED_WIDTH -
      positionLabel.length,
  );

  if (!isDialogOpen) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={left}
      marginTop={top}
      flexDirection="column"
      width={width}
      height={height}
    >
        <Box
          flexDirection="column"
          marginLeft={EMPTY_AREA_SIDE_MARGIN}
          marginTop={EMPTY_AREA_SIDE_MARGIN}
          width={borderedDialogWidth}
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
          <Box flexDirection="column" height={listHeight}>
            {displayRows.length > 0 ? (
              <LineListPickerView
                key={`${initialSelectedIndex}-${items.length}`}
                lines={displayRows}
                width={geom.contentWidth}
                height={listHeight}
                initialSelectedIndex={initialSelectedIndex}
                onSelectedIndexChange={onLineListSelectedIndexChange}
                onSelected={onLineListSelected}
                isDisabled={!isLatestPopup}
              />
            ) : null}
          </Box>
          {positionLabel.length > 0 ? (
            <Box
              position="absolute"
              marginTop={dialogHeight - PICK_ITEM_DIALOG_VERTICAL_BORDER_HEIGHT}
              marginLeft={bottomLabelLeft}
            >
              <Text>{positionLabel}</Text>
            </Box>
          ) : null}
        </Box>
    </EmptyArea>
  );
}
