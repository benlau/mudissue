import stringWidth from "string-width";

const ELLIPSIS_CHAR = "…";
const ELLIPSIS_WIDTH = stringWidth(ELLIPSIS_CHAR);

export class BasicLayouter {
  static readonly ELLIPSIS = ELLIPSIS_CHAR;

  /**
   * Truncate a filesystem path segment to at most `maxLen` characters from the start.
   * Do not use ellipsis here: {@link BasicLayouter.ELLIPSIS} is for display truncation only. Agents
   * and tooling treat `…` in paths as an abbreviated placeholder, not a literal folder
   * name, which breaks path resolution. End truncation keeps a copy-pasteable prefix.
   */
  static truncatePathSegment(value: string, maxLen: number): string {
    if (maxLen <= 0) return "";
    return value.slice(0, maxLen);
  }

  /** Truncate to at most `maxLen` characters, replacing removed middle with {@link BasicLayouter.ELLIPSIS}. */
  static truncateMiddle(value: string, maxLen: number): string {
    if (maxLen <= 0) return "";
    if (value.length <= maxLen) return value;
    if (maxLen <= BasicLayouter.ELLIPSIS.length) {
      return maxLen >= BasicLayouter.ELLIPSIS.length
        ? BasicLayouter.ELLIPSIS
        : value.slice(0, maxLen);
    }
    const remaining = maxLen - BasicLayouter.ELLIPSIS.length;
    const headLen = Math.ceil(remaining / 2);
    const tailLen = Math.floor(remaining / 2);
    return `${value.slice(0, headLen)}${BasicLayouter.ELLIPSIS}${value.slice(-tailLen)}`;
  }

  /** Truncate so total display width is at most `width`, with an ellipsis at the end. */
  static stringWidthTruncateEnd(value: string, width: number): string {
    if (width <= 0) return "";
    if (stringWidth(value) <= width) return value;
    if (width < ELLIPSIS_WIDTH) return "";
    if (width === ELLIPSIS_WIDTH) return BasicLayouter.ELLIPSIS;

    const result: string[] = [];
    let usedWidth = ELLIPSIS_WIDTH;
    for (const char of Array.from(value)) {
      const charWidth = stringWidth(char);
      if (usedWidth + charWidth > width) break;
      result.push(char);
      usedWidth += charWidth;
    }
    return `${result.join("")}${BasicLayouter.ELLIPSIS}`;
  }

  /** Truncate so total display width is at most `width`, with an ellipsis at the start. */
  static stringWidthTruncateBegin(value: string, width: number): string {
    if (width <= 0) return "";
    if (stringWidth(value) <= width) return value;
    if (width < ELLIPSIS_WIDTH) return "";
    if (width === ELLIPSIS_WIDTH) return BasicLayouter.ELLIPSIS;

    const result: string[] = [];
    let usedWidth = ELLIPSIS_WIDTH;
    for (const char of Array.from(value).reverse()) {
      const charWidth = stringWidth(char);
      if (usedWidth + charWidth > width) break;
      result.push(char);
      usedWidth += charWidth;
    }
    return `${BasicLayouter.ELLIPSIS}${result.reverse().join("")}`;
  }

  /** Pad with spaces so display width is at least `width` (padding uses ASCII spaces; width from string-width). */
  static stringWidthPadEnd(value: string, width: number): string {
    const paddingWidth = width - stringWidth(value);
    if (paddingWidth <= 0) return value;
    return value.padEnd(value.length + paddingWidth, " ");
  }
}
