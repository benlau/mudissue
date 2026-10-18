import type { IssueFolderRow } from "../../types/Issue.ts";

const BRANCH_PREFIX = "├─ ";
const LAST_PREFIX = "└─ ";
const CONTINUE_PREFIX = "│  ";
const BLANK_PREFIX = "  ";

export class IssueSubissueTreeFormatter {
  static formatTitlePrefix(
    issues: readonly IssueFolderRow[],
    index: number,
  ): string {
    const depth = issues[index]?.depth ?? 0;
    if (depth <= 0) {
      return "";
    }
    let prefix = "";
    for (let level = 1; level < depth; level++) {
      const ancestorIndex = IssueSubissueTreeFormatter.findAncestorIndex(
        issues,
        index,
        level,
      );
      prefix +=
        ancestorIndex >= 0 &&
        IssueSubissueTreeFormatter.hasLaterSibling(issues, ancestorIndex, level)
          ? CONTINUE_PREFIX
          : BLANK_PREFIX;
    }
    prefix += IssueSubissueTreeFormatter.hasLaterSibling(issues, index, depth)
      ? BRANCH_PREFIX
      : LAST_PREFIX;
    return prefix;
  }

  private static findAncestorIndex(
    issues: readonly IssueFolderRow[],
    index: number,
    depth: number,
  ): number {
    for (let cursor = index; cursor >= 0; cursor--) {
      const rowDepth = issues[cursor]?.depth ?? 0;
      if (rowDepth === depth) {
        return cursor;
      }
      if (rowDepth < depth) {
        return -1;
      }
    }
    return -1;
  }

  private static hasLaterSibling(
    issues: readonly IssueFolderRow[],
    index: number,
    depth: number,
  ): boolean {
    for (let cursor = index + 1; cursor < issues.length; cursor++) {
      const rowDepth = issues[cursor]?.depth ?? 0;
      if (rowDepth < depth) {
        return false;
      }
      if (rowDepth === depth) {
        return true;
      }
    }
    return false;
  }
}
