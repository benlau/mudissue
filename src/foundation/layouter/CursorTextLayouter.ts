import stringWidth from "string-width";
import { clamp } from "../../types/maths.ts";

export type CursorTextLayouterInput = {
  width: number;
  text: string;
  cursorIndex: number;
  scrollOffset: number;
};

export type CursorTextLayoutResult = {
  beforeCursorText: string;
  atCursorText: string;
  afterCursorText: string;
  scrollOffset: number;
  cursorIndex: number;
};

export class CursorTextLayouter {
  private width: number;
  private text: string;
  private cursorIndex: number;
  private scrollOffset: number;

  constructor(input: CursorTextLayouterInput) {
    this.width = input.width;
    this.text = input.text;
    this.cursorIndex = input.cursorIndex;
    this.scrollOffset = input.scrollOffset;
  }

  layout(): CursorTextLayoutResult {
    const result = this.computeCursorTextLayout();
    this.cursorIndex = result.cursorIndex;
    this.scrollOffset = result.scrollOffset;
    return result;
  }

  moveCursorOffset(delta: number): CursorTextLayoutResult {
    this.cursorIndex = clamp(this.cursorIndex + delta, 0, this.text.length);
    return this.layout();
  }

  moveToBegin(): CursorTextLayoutResult {
    this.cursorIndex = 0;
    return this.layout();
  }

  moveToEnd(): CursorTextLayoutResult {
    this.cursorIndex = this.text.length;
    return this.layout();
  }

  insertTextAtCursor(insertedText: string): CursorTextLayoutResult {
    this.text =
      this.text.slice(0, this.cursorIndex) +
      insertedText +
      this.text.slice(this.cursorIndex);
    this.cursorIndex += insertedText.length;
    return this.layout();
  }

  deleteBeforeCursor(): CursorTextLayoutResult | null {
    if (this.cursorIndex === 0) return null;
    const nextText =
      this.text.slice(0, this.cursorIndex - 1) +
      this.text.slice(this.cursorIndex);
    return this.replaceText(nextText, this.cursorIndex - 1);
  }

  replaceText(
    text: string,
    cursorIndex: number,
    scrollOffset?: number,
  ): CursorTextLayoutResult {
    this.text = text;
    this.cursorIndex = cursorIndex;
    if (scrollOffset !== undefined) {
      this.scrollOffset = scrollOffset;
    }
    return this.layout();
  }

  setWidth(width: number): void {
    this.width = width;
  }

  getText(): string {
    return this.text;
  }

  getCursorIndex(): number {
    return this.cursorIndex;
  }

  getScrollOffset(): number {
    return this.scrollOffset;
  }

  private computeCursorTextLayout(): CursorTextLayoutResult {
    const cursor = clamp(this.cursorIndex, 0, this.text.length);
    let offset = clamp(this.scrollOffset, 0, this.text.length);
    if (cursor < offset) offset = cursor;

    if (this.width <= 0) {
      const atCursorText = cursor < this.text.length ? this.text[cursor]! : " ";
      return {
        beforeCursorText: this.text.slice(0, cursor),
        atCursorText,
        afterCursorText:
          cursor < this.text.length ? this.text.slice(cursor + 1) : "",
        scrollOffset: offset,
        cursorIndex: cursor,
      };
    }

    let beforeCursorText = this.text.slice(offset, cursor);
    const atCursorText = cursor < this.text.length ? this.text[cursor]! : " ";
    let afterCursorText = this.text.slice(cursor + 1);

    let usedWidth =
      stringWidth(beforeCursorText) +
      stringWidth(atCursorText) +
      stringWidth(afterCursorText);
    while (usedWidth > this.width) {
      if (afterCursorText.length > 0) {
        afterCursorText = afterCursorText.slice(0, -1);
      } else if (offset < cursor) {
        offset += 1;
        beforeCursorText = this.text.slice(offset, cursor);
      } else {
        break;
      }
      usedWidth =
        stringWidth(beforeCursorText) +
        stringWidth(atCursorText) +
        stringWidth(afterCursorText);
    }

    if (cursor === this.text.length && this.width > 0) {
      const cursorWidth = stringWidth(atCursorText);
      const maxBeforeWidth = Math.max(0, this.width - cursorWidth);
      while (
        stringWidth(beforeCursorText) > maxBeforeWidth &&
        offset < cursor
      ) {
        offset += 1;
        beforeCursorText = this.text.slice(offset, cursor);
      }
    }

    return {
      beforeCursorText,
      atCursorText,
      afterCursorText,
      scrollOffset: offset,
      cursorIndex: cursor,
    };
  }
}
