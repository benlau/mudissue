import type { IssueFolderRow } from "../../types/Issue.ts";

const BRANCH_PREFIX = "├─ ";
const LAST_PREFIX = "└─ ";

export class IssueSubissueTreeFormatter {
  static formatTitlePrefix(
    issues: readonly IssueFolderRow[],
    index: number,
  ): string {
    const depth = issues[index]?.depth ?? 0;
    if (depth <= 0) {
      return "";
    }
    const nextDepth = issues[index + 1]?.depth ?? 0;
    if (issues[index + 1] != null && nextDepth >= depth) {
      return BRANCH_PREFIX;
    }
    return LAST_PREFIX;
  }
}
