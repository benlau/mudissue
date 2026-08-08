import { clamp } from "../../types/maths.ts";
import { TextLayouter } from "./TextLayouter.ts";

export type DisplayRowSegment = {
  logicalLineIndex: number;
  startCharIndex: number;
  text: string;
};

export type VisibleRow = {
  left: string;
  cursorChar: string;
  right: string;
  isCursorRow: boolean;
};

export type MultilineCursorLayoutResult = {
  visibleRows: VisibleRow[];
  scrollRowOffset: number;
};

export type MultilineCursorTextLayouterInput = {
  lines?: string[];
  lineIndex?: number;
  cursorIndex?: number;
  width: number;
  height: number;
  scrollRowOffset?: number;
};

/** Display-only suffix appended per logical line for wrapping; never saved in getText(). */
const CURSOR_SUFFIX = " ";

export class MultilineCursorTextLayouter {
  private lines: string[];
  private lineIndex: number;
  private cursorIndex: number;
  private width: number;
  private height: number;
  private scrollRowOffset: number;
  private readonly textLayouter = new TextLayouter();

  constructor(input: MultilineCursorTextLayouterInput) {
    this.lines =
      input.lines !== undefined && input.lines.length > 0
        ? [...input.lines]
        : [""];
    this.lineIndex = input.lineIndex ?? 0;
    this.cursorIndex = input.cursorIndex ?? 0;
    this.width = input.width;
    this.height = input.height;
    this.scrollRowOffset = input.scrollRowOffset ?? 0;
    this.clampCursor();
  }

  getLines(): string[] {
    return this.lines;
  }

  getText(): string {
    return this.lines.join("\n");
  }

  getLineIndex(): number {
    return this.lineIndex;
  }

  getCursorIndex(): number {
    return this.cursorIndex;
  }

  getScrollRowOffset(): number {
    return this.scrollRowOffset;
  }

  setWidth(width: number): void {
    this.width = width;
  }

  setHeight(height: number): void {
    this.height = height;
  }

  replaceLines(
    lines: string[],
    lineIndex: number,
    cursorIndex: number,
  ): MultilineCursorTextLayouter {
    this.lines = lines.length > 0 ? [...lines] : [""];
    this.lineIndex = lineIndex;
    this.cursorIndex = cursorIndex;
    this.clampCursor();
    this.reconcileScrollToCursor();
    return this;
  }

  moveCursorLeft(): MultilineCursorTextLayouter {
    if (this.cursorIndex > 0) {
      this.cursorIndex -= 1;
    } else if (this.lineIndex > 0) {
      this.lineIndex -= 1;
      this.cursorIndex = this.currentLine().length;
    }
    this.reconcileScrollToCursor();
    return this;
  }

  moveCursorRight(): MultilineCursorTextLayouter {
    const line = this.currentLine();
    if (this.cursorIndex < line.length) {
      this.cursorIndex += 1;
    } else if (this.lineIndex < this.lines.length - 1) {
      this.lineIndex += 1;
      this.cursorIndex = 0;
    }
    this.reconcileScrollToCursor();
    return this;
  }

  moveCursorUp(): MultilineCursorTextLayouter {
    this.moveCursorVertical(-1);
    return this;
  }

  moveCursorDown(): MultilineCursorTextLayouter {
    this.moveCursorVertical(1);
    return this;
  }

  moveToLineBegin(): MultilineCursorTextLayouter {
    this.cursorIndex = 0;
    this.reconcileScrollToCursor();
    return this;
  }

  moveToLineEnd(): MultilineCursorTextLayouter {
    this.cursorIndex = this.currentLine().length;
    this.reconcileScrollToCursor();
    return this;
  }

  moveCursorPageUp(pageSize: number): MultilineCursorTextLayouter {
    const displayRows = this.buildDisplayRows();
    const { displayRow } = this.mapCursorToDisplayRow(displayRows);
    const page = Math.max(1, pageSize);
    const targetRow = displayRow < page ? 0 : displayRow - page;
    this.moveCursorToDisplayRow(displayRows, displayRow, targetRow);
    return this;
  }

  moveCursorPageDown(pageSize: number): MultilineCursorTextLayouter {
    const displayRows = this.buildDisplayRows();
    const { displayRow } = this.mapCursorToDisplayRow(displayRows);
    const page = Math.max(1, pageSize);
    const maxRow = Math.max(0, displayRows.length - 1);
    const remaining = maxRow - displayRow;
    const targetRow = remaining < page ? maxRow : displayRow + page;
    this.moveCursorToDisplayRow(displayRows, displayRow, targetRow);
    return this;
  }

  scrollPageUp(pageSize: number): MultilineCursorTextLayouter {
    const displayRows = this.buildDisplayRows();
    const page = Math.max(1, pageSize);
    this.scrollRowOffset = Math.max(0, this.scrollRowOffset - page);
    this.scrollRowOffset = clamp(
      this.scrollRowOffset,
      0,
      Math.max(0, displayRows.length - this.height),
    );
    return this;
  }

  scrollPageDown(pageSize: number): MultilineCursorTextLayouter {
    const displayRows = this.buildDisplayRows();
    const page = Math.max(1, pageSize);
    const maxOffset = Math.max(0, displayRows.length - this.height);
    this.scrollRowOffset = Math.min(maxOffset, this.scrollRowOffset + page);
    return this;
  }

  insertTextAtCursor(text: string): MultilineCursorTextLayouter {
    if (text === "") return this;
    text = text.replace(/\r\n?/g, "\n");
    const parts = text.split("\n");
    if (parts.length === 1) {
      const line = this.currentLine();
      this.lines[this.lineIndex] =
        line.slice(0, this.cursorIndex) + text + line.slice(this.cursorIndex);
      this.cursorIndex += text.length;
      this.reconcileScrollToCursor();
      return this;
    }

    const line = this.currentLine();
    const before = line.slice(0, this.cursorIndex);
    const after = line.slice(this.cursorIndex);
    const nextLines = [...this.lines];
    nextLines[this.lineIndex] = before + (parts[0] ?? "");
    const middle = parts.slice(1, -1);
    const lastPart = parts[parts.length - 1] ?? "";
    nextLines.splice(this.lineIndex + 1, 0, ...middle, lastPart + after);
    this.lines = nextLines;
    this.lineIndex += parts.length - 1;
    this.cursorIndex = lastPart.length;
    this.clampCursor();
    this.reconcileScrollToCursor();
    return this;
  }

  deleteBeforeCursor(): MultilineCursorTextLayouter | null {
    if (this.cursorIndex > 0) {
      const line = this.currentLine();
      this.lines[this.lineIndex] =
        line.slice(0, this.cursorIndex - 1) + line.slice(this.cursorIndex);
      this.cursorIndex -= 1;
      this.reconcileScrollToCursor();
      return this;
    }
    if (this.lineIndex === 0) return null;
    const prevLen = this.lines[this.lineIndex - 1]!.length;
    this.lines[this.lineIndex - 1] =
      this.lines[this.lineIndex - 1]! + this.currentLine();
    this.lines.splice(this.lineIndex, 1);
    this.lineIndex -= 1;
    this.cursorIndex = prevLen;
    this.reconcileScrollToCursor();
    return this;
  }

  deleteAfterCursor(): MultilineCursorTextLayouter | null {
    const line = this.currentLine();
    if (this.cursorIndex < line.length) {
      this.lines[this.lineIndex] =
        line.slice(0, this.cursorIndex) + line.slice(this.cursorIndex + 1);
      this.reconcileScrollToCursor();
      return this;
    }
    if (this.lineIndex >= this.lines.length - 1) return null;
    this.lines[this.lineIndex] = line + this.lines[this.lineIndex + 1]!;
    this.lines.splice(this.lineIndex + 1, 1);
    this.reconcileScrollToCursor();
    return this;
  }

  insertNewline(): MultilineCursorTextLayouter {
    const line = this.currentLine();
    const before = line.slice(0, this.cursorIndex);
    const after = line.slice(this.cursorIndex);
    this.lines[this.lineIndex] = before;
    this.lines.splice(this.lineIndex + 1, 0, after);
    this.lineIndex += 1;
    this.cursorIndex = 0;
    this.clampCursor();
    this.reconcileScrollToCursor();
    return this;
  }

  /** Kills from cursor to EOL (or removes an empty line). Returns the killed text. */
  killLineFromCursor(): string {
    const line = this.currentLine();
    if (line.length === 0) {
      if (this.lines.length <= 1) {
        return "";
      }
      if (this.lineIndex < this.lines.length - 1) {
        this.lines.splice(this.lineIndex, 1);
        this.cursorIndex = 0;
      } else {
        this.lines.splice(this.lineIndex, 1);
        this.lineIndex -= 1;
        this.cursorIndex = this.currentLine().length;
      }
      this.clampCursor();
      this.reconcileScrollToCursor();
      return "\n";
    }
    const killed = line.slice(this.cursorIndex);
    this.lines[this.lineIndex] = line.slice(0, this.cursorIndex);
    this.reconcileScrollToCursor();
    return killed;
  }

  layout(): MultilineCursorLayoutResult {
    const displayRows = this.buildDisplayRows();
    const cursorPos = this.mapCursorToDisplayRow(displayRows);
    const viewportHeight = Math.max(1, this.height);
    const maxOffset = Math.max(0, displayRows.length - viewportHeight);
    this.scrollRowOffset = clamp(this.scrollRowOffset, 0, maxOffset);
    this.scrollRowOffset = this.ensureCursorRowVisible(
      displayRows,
      cursorPos.displayRow,
      this.scrollRowOffset,
      viewportHeight,
    );

    const visibleRows: VisibleRow[] = [];
    for (
      let row = this.scrollRowOffset;
      row < this.scrollRowOffset + viewportHeight;
      row++
    ) {
      const seg = displayRows[row];
      if (seg === undefined) {
        visibleRows.push({
          left: "",
          cursorChar: " ",
          right: "",
          isCursorRow: false,
        });
        continue;
      }
      const isCursorRow =
        seg.logicalLineIndex === this.lineIndex && row === cursorPos.displayRow;
      visibleRows.push(this.renderVisibleRow(seg, isCursorRow));
    }

    return {
      visibleRows,
      scrollRowOffset: this.scrollRowOffset,
    };
  }

  buildDisplayRows(): DisplayRowSegment[] {
    const rows: DisplayRowSegment[] = [];
    for (let li = 0; li < this.lines.length; li++) {
      const line = this.lines[li] ?? "";
      const displayLine = line + CURSOR_SUFFIX;
      this.textLayouter.setContent([displayLine]);
      const wrapped = this.textLayouter.layout(this.width, 0).formattedContent;
      let charOffset = 0;
      for (const text of wrapped) {
        rows.push({
          logicalLineIndex: li,
          startCharIndex: charOffset,
          text,
        });
        charOffset += text.length;
      }
    }
    if (rows.length === 0) {
      rows.push({
        logicalLineIndex: 0,
        startCharIndex: 0,
        text: CURSOR_SUFFIX,
      });
    }
    return rows;
  }

  private currentLine(): string {
    return this.lines[this.lineIndex] ?? "";
  }

  private clampCursor(): void {
    this.lineIndex = clamp(
      this.lineIndex,
      0,
      Math.max(0, this.lines.length - 1),
    );
    this.cursorIndex = clamp(this.cursorIndex, 0, this.currentLine().length);
  }

  private reconcileScrollToCursor(): void {
    const displayRows = this.buildDisplayRows();
    const cursorPos = this.mapCursorToDisplayRow(displayRows);
    const viewportHeight = Math.max(1, this.height);
    const maxOffset = Math.max(0, displayRows.length - viewportHeight);
    this.scrollRowOffset = clamp(this.scrollRowOffset, 0, maxOffset);
    this.scrollRowOffset = this.ensureCursorRowVisible(
      displayRows,
      cursorPos.displayRow,
      this.scrollRowOffset,
      viewportHeight,
    );
  }

  private moveCursorVertical(delta: number): void {
    const displayRows = this.buildDisplayRows();
    const { displayRow } = this.mapCursorToDisplayRow(displayRows);
    const targetRow = clamp(
      displayRow + delta,
      0,
      Math.max(0, displayRows.length - 1),
    );
    this.moveCursorToDisplayRow(displayRows, displayRow, targetRow);
  }

  private moveCursorToDisplayRow(
    displayRows: DisplayRowSegment[],
    sourceDisplayRow: number,
    targetDisplayRow: number,
  ): void {
    const { displayCol } = this.mapCursorToDisplayRow(displayRows);
    const seg = displayRows[targetDisplayRow]!;
    const sourceSeg = displayRows[sourceDisplayRow]!;
    let targetCol = clamp(displayCol, 0, seg.text.length);
    if (
      targetDisplayRow === sourceDisplayRow + 1 &&
      seg.logicalLineIndex === sourceSeg.logicalLineIndex &&
      seg.startCharIndex === sourceSeg.startCharIndex + sourceSeg.text.length &&
      displayCol >= sourceSeg.text.length - 1 &&
      seg.text.length > 0
    ) {
      targetCol = 0;
    }
    this.lineIndex = seg.logicalLineIndex;
    this.cursorIndex = seg.startCharIndex + targetCol;
    this.clampCursor();
    this.reconcileScrollToCursor();
  }

  private mapCursorToDisplayRow(displayRows: DisplayRowSegment[]): {
    displayRow: number;
    displayCol: number;
  } {
    for (let i = 0; i < displayRows.length; i++) {
      const seg = displayRows[i]!;
      if (seg.logicalLineIndex !== this.lineIndex) continue;

      const endChar = seg.startCharIndex + seg.text.length;
      if (
        this.cursorIndex >= seg.startCharIndex &&
        this.cursorIndex < endChar
      ) {
        return {
          displayRow: i,
          displayCol: this.cursorIndex - seg.startCharIndex,
        };
      }
      if (this.cursorIndex === endChar) {
        const next = displayRows[i + 1];
        if (
          next !== undefined &&
          next.logicalLineIndex === this.lineIndex &&
          next.startCharIndex === endChar
        ) {
          continue;
        }
        return {
          displayRow: i,
          displayCol: seg.text.length,
        };
      }
    }

    for (let i = displayRows.length - 1; i >= 0; i--) {
      const seg = displayRows[i]!;
      if (seg.logicalLineIndex === this.lineIndex) {
        return {
          displayRow: i,
          displayCol: seg.text.length,
        };
      }
    }

    return { displayRow: 0, displayCol: 0 };
  }

  private ensureCursorRowVisible(
    displayRows: DisplayRowSegment[],
    cursorDisplayRow: number,
    scrollRowOffset: number,
    viewportHeight: number,
  ): number {
    if (displayRows.length === 0) return 0;
    if (cursorDisplayRow < scrollRowOffset) {
      return cursorDisplayRow;
    }
    if (cursorDisplayRow >= scrollRowOffset + viewportHeight) {
      return Math.max(0, cursorDisplayRow - viewportHeight + 1);
    }
    return scrollRowOffset;
  }

  private renderVisibleRow(
    seg: DisplayRowSegment,
    isCursorRow: boolean,
  ): VisibleRow {
    if (!isCursorRow) {
      return {
        left: seg.text,
        cursorChar: "",
        right: "",
        isCursorRow: false,
      };
    }

    const colInSeg = this.cursorIndex - seg.startCharIndex;
    const left = seg.text.slice(0, colInSeg);
    let cursorChar =
      colInSeg < seg.text.length
        ? seg.text[colInSeg]!
        : seg.text.length === 0
          ? "█"
          : " ";
    // Block cursor on empty logical lines; trailing space elsewhere.
    if (
      this.currentLine().length === 0 &&
      this.cursorIndex === 0 &&
      colInSeg === 0
    ) {
      cursorChar = "█";
    }
    const right =
      colInSeg < seg.text.length ? seg.text.slice(colInSeg + 1) : "";

    return { left, cursorChar, right, isCursorRow: true };
  }
}
