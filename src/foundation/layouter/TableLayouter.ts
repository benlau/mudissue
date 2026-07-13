import stringWidth from "string-width";
import type {
  EllipsisDirection,
  TableColumnDef,
  TableWidthRange,
} from "../../types/TableLayout.ts";
import { BasicLayouter } from "./BasicLayouter.ts";

const COLUMN_GAP = " ";
const COLUMN_GAP_WIDTH = 1;
const DEFAULT_MIN_WIDTH = 0;
const DEFAULT_GROW = 1;
const UNBOUNDED_MAX_WIDTH = Number.MAX_SAFE_INTEGER;

type NormalizedTableColumnDef = {
  minWidth: number;
  maxWidth: number;
  grow: number;
  ellipsisDirection: EllipsisDirection;
};

export class TableLayouter {
  private readonly columns: NormalizedTableColumnDef[];
  private columnWidths: number[];
  private cachedAvailableWidth: number | null = null;
  private cachedColumnWidths: number[] | null = null;

  constructor(columns: TableColumnDef[]) {
    this.columns = columns.map((column) => {
      const minWidth = normalizeWidth(column.minWidth, DEFAULT_MIN_WIDTH);
      const requestedMaxWidth =
        column.maxWidth == null
          ? UNBOUNDED_MAX_WIDTH
          : normalizeWidth(column.maxWidth, UNBOUNDED_MAX_WIDTH);
      return {
        minWidth,
        maxWidth: Math.max(minWidth, requestedMaxWidth),
        grow: normalizeGrow(column.grow),
        ellipsisDirection: column.ellipsisDirection ?? "right",
      };
    });
    this.columnWidths = this.columns.map((column) => column.minWidth);
  }

  getMinMaxWidth(): TableWidthRange {
    const gapWidth = this.getGapWidth();
    const minWidth = safeAdd(
      this.columns.reduce((sum, column) => safeAdd(sum, column.minWidth), 0),
      gapWidth,
    );
    const maxWidth = safeAdd(
      this.columns.reduce((sum, column) => safeAdd(sum, column.maxWidth), 0),
      gapWidth,
    );
    return { minWidth, maxWidth };
  }

  layout(availableWidth: number): number[] {
    const normalizedAvailableWidth = normalizeWidth(availableWidth, 0);
    if (
      this.cachedAvailableWidth === normalizedAvailableWidth &&
      this.cachedColumnWidths != null
    ) {
      return this.cachedColumnWidths;
    }

    const availableColumnWidth = Math.max(
      0,
      normalizedAvailableWidth - this.getGapWidth(),
    );
    const widths = this.columns.map((column) => column.minWidth);
    const minColumnWidth = widths.reduce((sum, width) => sum + width, 0);

    if (availableColumnWidth <= minColumnWidth) {
      this.columnWidths = widths;
      return this.cacheLayoutResult(normalizedAvailableWidth);
    }

    let remaining = availableColumnWidth - minColumnWidth;
    while (remaining > 0) {
      const growableColumns = this.columns
        .map((column, index) => ({ column, index }))
        .filter(
          ({ column, index }) =>
            column.grow > 0 && widths[index]! < column.maxWidth,
        );

      if (growableColumns.length === 0) break;

      const totalGrow = growableColumns.reduce(
        (sum, { column }) => sum + column.grow,
        0,
      );
      let allocatedThisRound = 0;

      for (const { column, index } of growableColumns) {
        const remainingCapacity = column.maxWidth - widths[index]!;
        const proportionalShare = Math.floor(
          (remaining * column.grow) / totalGrow,
        );
        const share = Math.min(
          remainingCapacity,
          Math.max(1, proportionalShare),
        );
        widths[index] = widths[index]! + share;
        allocatedThisRound += share;
        if (allocatedThisRound >= remaining) break;
      }

      remaining -= allocatedThisRound;
      if (allocatedThisRound === 0) break;
    }

    this.columnWidths = widths;
    return this.cacheLayoutResult(normalizedAvailableWidth);
  }

  makeRow(columnValues: string[]): string {
    return this.columnWidths
      .map((width, index) =>
        formatCell(
          String(columnValues[index] ?? ""),
          width,
          this.columns[index]?.ellipsisDirection ?? "right",
        ),
      )
      .join(COLUMN_GAP);
  }

  private getGapWidth(): number {
    return Math.max(0, this.columns.length - 1) * COLUMN_GAP_WIDTH;
  }

  private cacheLayoutResult(availableWidth: number): number[] {
    this.cachedAvailableWidth = availableWidth;
    this.cachedColumnWidths = this.columnWidths;
    return this.cachedColumnWidths;
  }
}

function normalizeWidth(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizeGrow(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_GROW;
  return Math.max(0, value);
}

function safeAdd(left: number, right: number): number {
  return Math.min(UNBOUNDED_MAX_WIDTH, left + right);
}

function formatCell(
  value: string,
  width: number,
  ellipsisDirection: EllipsisDirection,
): string {
  if (width <= 0) return "";

  const visibleValue =
    stringWidth(value) <= width
      ? value
      : truncateValue(value, width, ellipsisDirection);
  return BasicLayouter.stringWidthPadEnd(visibleValue, width);
}

function truncateValue(
  value: string,
  width: number,
  ellipsisDirection: EllipsisDirection,
): string {
  return ellipsisDirection === "left"
    ? BasicLayouter.stringWidthTruncateBegin(value, width)
    : BasicLayouter.stringWidthTruncateEnd(value, width);
}
