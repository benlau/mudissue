import matter from "gray-matter";
import type { LineRange } from "../../types/LineRange.ts";

export type FrontMatterLineParseResult = {
  lineRange: LineRange;
  fields: Record<string, LineRange>;
};

const FRONTMATTER_DELIMITER = /^---$/;
const TOP_LEVEL_KEY_LINE = /^([A-Za-z0-9_-]+):/;

export class FrontMatterLineParser {
  static parse(content: string): FrontMatterLineParseResult | null {
    const normalized = content.replace(/\r\n/g, "\n");

    let parsedKeys: string[];
    try {
      const parsed = matter(normalized);
      parsedKeys = Object.keys(parsed.data ?? {});
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
    const fields: Record<string, LineRange> = {};
    let currentKey: string | null = null;
    let currentStart = -1;

    const finalizeCurrentKey = (endLine: number) => {
      if (currentKey !== null && currentStart >= 0) {
        fields[currentKey] = { start: currentStart, end: endLine };
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
        fields[currentKey] = { start: currentStart, end: i };
      }
    }

    if (currentKey !== null && currentStart >= 0) {
      fields[currentKey] = {
        start: currentStart,
        end: closingDelimiterIndex - 1,
      };
    }

    return {
      lineRange: { start: 0, end: closingDelimiterIndex },
      fields,
    };
  }
}
