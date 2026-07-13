import { DateFormatter } from "./DateFormatter.ts";

const INDENT = "  ";
const QUOTE_PREFIX = `${INDENT}> `;
const BLANK_QUOTE_LINE = `${INDENT}>`;

/**
 * Formats a comment block appended to an issue markdown body.
 * Every line is indented with two spaces before the blockquote marker.
 */
export class IssueCommentFormatter {
  static formatBlock(
    author: string,
    content: string,
    at: Date = new Date(),
  ): string {
    const timestamp = DateFormatter.format(at, "comment_timestamp");
    const header = `${INDENT}> **${author}** @ *${timestamp}*`;
    const contentLines = content
      .split("\n")
      .map((line) =>
        line.length === 0 ? BLANK_QUOTE_LINE : `${QUOTE_PREFIX}${line}`,
      );
    return [header, BLANK_QUOTE_LINE, ...contentLines].join("\n");
  }
}
