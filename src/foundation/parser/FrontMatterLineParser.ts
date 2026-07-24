import matter from "gray-matter";
import type { LineRange } from "../../types/LineRange.ts";

export type FrontMatterFieldLineInfo = {
  lineRange: LineRange;
  value: any;
};

export type FrontMatterLineParseResult = {
  lineRange: LineRange;
  fields: Record<string, FrontMatterFieldLineInfo>;
};

const FRONTMATTER_DELIMITER = /^---$/;
const TOP_LEVEL_KEY_LINE = /^([A-Za-z0-9_-]+):/;
const BOOLEAN_SCALAR_LINE = /^([A-Za-z0-9_-]+:\s*)(true|false)(\s*)$/;

function isLineInRange(lineIndex: number, range: LineRange): boolean {
  return lineIndex >= range.start && lineIndex <= range.end;
}

function flipBooleanScalarLine(line: string): string | null {
  const match = BOOLEAN_SCALAR_LINE.exec(line);
  if (match == null) {
    return null;
  }
  const prefix = match[1]!;
  const value = match[2]!;
  const suffix = match[3]!;
  const nextValue = value === "true" ? "false" : "true";
  return `${prefix}${nextValue}${suffix}`;
}

export class FrontMatterLineParser {
  static parse(content: string): FrontMatterLineParseResult | null {
    const normalized = content.replace(/\r\n/g, "\n");

    let parsedKeys: string[];
    let data: Record<string, unknown>;
    try {
      const parsed = matter(normalized);
      data = (parsed.data ?? {}) as Record<string, unknown>;
      parsedKeys = Object.keys(data);
      if (parsedKeys.length === 0) {
        return null;
      }
    } catch {
      return null;
    }

    const lines = normalized.split("\n");
    if (!FRONTMATTER_DELIMITER.test(lines[0] ?? "")) {
      return null;
    }

    let closingDelimiterIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (FRONTMATTER_DELIMITER.test(lines[i] ?? "")) {
        closingDelimiterIndex = i;
        break;
      }
    }
    if (closingDelimiterIndex === -1) {
      return null;
    }

    const parsedKeySet = new Set(parsedKeys);
    const fieldRanges: Record<string, LineRange> = {};
    let currentKey: string | null = null;
    let currentStart = -1;

    const finalizeCurrentKey = (endLine: number) => {
      if (currentKey !== null && currentStart >= 0) {
        fieldRanges[currentKey] = { start: currentStart, end: endLine };
      }
    };

    for (let i = 1; i < closingDelimiterIndex; i++) {
      const line = lines[i] ?? "";
      const keyMatch = TOP_LEVEL_KEY_LINE.exec(line);
      const matchedKey = keyMatch?.[1];

      if (matchedKey !== undefined && parsedKeySet.has(matchedKey)) {
        finalizeCurrentKey(i - 1);
        currentKey = matchedKey;
        currentStart = i;
      } else if (currentKey !== null) {
        fieldRanges[currentKey] = { start: currentStart, end: i };
      }
    }

    if (currentKey !== null && currentStart >= 0) {
      fieldRanges[currentKey] = {
        start: currentStart,
        end: closingDelimiterIndex - 1,
      };
    }

    const fields: Record<string, FrontMatterFieldLineInfo> = {};
    for (const [key, lineRange] of Object.entries(fieldRanges)) {
      fields[key] = {
        lineRange,
        value: data[key],
      };
    }

    return {
      lineRange: { start: 0, end: closingDelimiterIndex },
      fields,
    };
  }

  /**
   * Toggle a boolean frontmatter field at the given logical line.
   * Returns null when the line is not a frontmatter boolean field.
   */
  static toggleBooleanAtLine(
    lines: string[],
    logicalLineIndex: number,
  ): string[] | null {
    const frontmatter = FrontMatterLineParser.parse(lines.join("\n"));
    if (frontmatter == null) {
      return null;
    }

    const field = Object.values(frontmatter.fields).find(
      (entry) =>
        (entry.value === true || entry.value === false) &&
        isLineInRange(logicalLineIndex, entry.lineRange),
    );
    if (field == null) {
      return null;
    }

    const line = lines[logicalLineIndex];
    if (line === undefined) {
      return null;
    }

    const nextLine = flipBooleanScalarLine(line);
    if (nextLine == null) {
      return null;
    }

    const nextLines = [...lines];
    nextLines[logicalLineIndex] = nextLine;
    return nextLines;
  }
}
