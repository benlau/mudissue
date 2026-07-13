import stringWidth from "string-width";
import { clamp } from "../../types/maths.ts";

export type TextLayoutResult = {
  newCursorRowIndex: number;
  formattedContent: string[];
};

export class TextLayouter {
  private content: string[] = [];
  private formattedContent: string[] = [];
  private logicalLineIndices: number[] = [];
  private lastWidth: number | undefined;

  setContent(content: string[]): void {
    this.content = content.map((line) => line.replace(/\t/g, "  "));
    this.formattedContent = [...this.content];
    this.logicalLineIndices = this.content.map((_, i) => i);
    this.lastWidth = undefined;
  }

  getFormattedContent(): string[] {
    return this.formattedContent;
  }

  getLogicalLineIndex(displayRowIndex: number): number {
    if (this.logicalLineIndices.length === 0) return 0;
    const idx = clamp(
      displayRowIndex,
      0,
      Math.max(0, this.logicalLineIndices.length - 1),
    );
    return this.logicalLineIndices[idx] ?? 0;
  }

  getDisplayRowsForLogicalLine(logicalLineIndex: number): number[] {
    const rows: number[] = [];
    for (let i = 0; i < this.logicalLineIndices.length; i++) {
      if (this.logicalLineIndices[i] === logicalLineIndex) {
        rows.push(i);
      }
    }
    return rows;
  }

  layout(newWidth: number, cursorRowIndex: number): TextLayoutResult {
    if (this.lastWidth === newWidth) {
      return {
        newCursorRowIndex: this.clampCursorRowIndex(cursorRowIndex),
        formattedContent: this.formattedContent,
      };
    }

    const previousTotalLines = this.formattedContent.length;
    const wrapped = this.wrapLinesToWidth(this.content, newWidth);
    this.formattedContent = wrapped.displayLines;
    this.logicalLineIndices = wrapped.logicalLineIndices;
    this.lastWidth = newWidth;

    return {
      newCursorRowIndex: this.rescaleCursorRowIndex(
        cursorRowIndex,
        previousTotalLines,
        this.formattedContent.length,
      ),
      formattedContent: this.formattedContent,
    };
  }

  private wrapLinesToWidth(
    lines: string[],
    contentWidth: number,
  ): { displayLines: string[]; logicalLineIndices: number[] } {
    const displayLines: string[] = [];
    const logicalLineIndices: number[] = [];
    for (let li = 0; li < lines.length; li++) {
      const wrapped = this.wrapLine(lines[li]!, contentWidth);
      for (const segment of wrapped) {
        displayLines.push(segment);
        logicalLineIndices.push(li);
      }
    }
    return { displayLines, logicalLineIndices };
  }

  private wrapLine(line: string, contentWidth: number): string[] {
    if (contentWidth <= 0) return [line];
    if (line.length === 0) return [""];

    const result: string[] = [];
    let remaining = line;
    while (remaining.length > 0) {
      if (stringWidth(remaining) <= contentWidth) {
        result.push(remaining);
        break;
      }

      let end = 0;
      for (let i = 1; i <= remaining.length; i++) {
        const sub = remaining.slice(0, i);
        if (stringWidth(sub) > contentWidth) break;
        end = i;
      }

      if (end === 0) end = 1;
      result.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }

    return result;
  }

  private rescaleCursorRowIndex(
    cursorRowIndex: number,
    previousTotalLines: number,
    newTotalLines: number,
  ): number {
    if (previousTotalLines <= 0) return 0;

    const proportional = Math.round(
      (cursorRowIndex / previousTotalLines) * newTotalLines,
    );
    return this.clampRowIndex(proportional, newTotalLines);
  }

  private clampCursorRowIndex(cursorRowIndex: number): number {
    return this.clampRowIndex(cursorRowIndex, this.formattedContent.length);
  }

  private clampRowIndex(rowIndex: number, totalLines: number): number {
    return clamp(rowIndex, 0, Math.max(0, totalLines - 1));
  }
}
