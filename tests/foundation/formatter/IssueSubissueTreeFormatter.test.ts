import type { IssueFolderRow } from "../../../src/types/Issue.ts";
import { IssueSubissueTreeFormatter } from "../../../src/foundation/formatter/IssueSubissueTreeFormatter.ts";
import { accessIssueFolderRow } from "../../../src/types/Issue.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

function row(issueId: string, depth: number): IssueFolderRow {
  return accessIssueFolderRow(buildIssueFolder(issueId), depth).get();
}

describe("IssueSubissueTreeFormatter", () => {
  it("leaves depth 0 rows without a tree prefix", () => {
    const issues = [row("MI0001", 0), row("MI0002", 1)];

    expect(IssueSubissueTreeFormatter.formatTitlePrefix(issues, 0)).toBe("");
  });

  it("uses a branch prefix when the next row stays at the same depth", () => {
    const issues = [row("MI0001", 0), row("MI0002", 1), row("MI0003", 1)];

    expect(IssueSubissueTreeFormatter.formatTitlePrefix(issues, 1)).toBe("├─ ");
  });

  it("uses a last-child prefix when the next row returns to a shallower depth", () => {
    const issues = [row("MI0001", 0), row("MI0002", 1), row("MI0003", 0)];

    expect(IssueSubissueTreeFormatter.formatTitlePrefix(issues, 1)).toBe("└─ ");
  });

  it("uses a last-child prefix when the row is the end of the list", () => {
    const issues = [row("MI0001", 0), row("MI0002", 1)];

    expect(IssueSubissueTreeFormatter.formatTitlePrefix(issues, 1)).toBe("└─ ");
  });
});
