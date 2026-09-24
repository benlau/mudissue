import { describe, expect, it } from "@jest/globals";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { SelectIssueTableHelper } from "../../src/helpers/SelectIssueTableHelper.ts";

const sampleIssue: IssueFolder = {
  issueId: "MI001-example",
  label: "MI001",
  path: "/repo/issues/MI001-example",
  metadata: {
    title: "Hello\nworld",
    status: "open",
    priority: "high",
    frontmatter: {
      title: "Hello\nworld",
      status: "open",
      priority: "high",
      assignee: "alice",
      tags: ["a", "b"],
    },
  },
};

describe("SelectIssueTableHelper", () => {
  it("defaults property columns to status and priority when omitted or empty", () => {
    expect(SelectIssueTableHelper.parsePropertyColumns(undefined)).toEqual([
      "status",
      "priority",
    ]);
    expect(SelectIssueTableHelper.parsePropertyColumns("")).toEqual([
      "status",
      "priority",
    ]);
    expect(SelectIssueTableHelper.parsePropertyColumns("  ,  ")).toEqual([
      "status",
      "priority",
    ]);
    expect(new SelectIssueTableHelper().getColumnKeys()).toEqual([
      "id",
      "title",
      "status",
      "priority",
    ]);
  });

  it("parses comma-separated property keys and prefixes id and title", () => {
    expect(
      SelectIssueTableHelper.parsePropertyColumns("assignee, due_date"),
    ).toEqual(["assignee", "due_date"]);
    expect(new SelectIssueTableHelper("assignee").getColumnKeys()).toEqual([
      "id",
      "title",
      "assignee",
    ]);
  });

  it("resolves fixed and property cell values from issue metadata", () => {
    const helper = new SelectIssueTableHelper("assignee,tags");
    expect(helper.getCellValue(sampleIssue, "id")).toEqual("MI001");
    expect(helper.getCellValue(sampleIssue, "title")).toEqual("Helloworld");
    expect(helper.getCellValue(sampleIssue, "status")).toEqual("open");
    expect(helper.getCellValue(sampleIssue, "priority")).toEqual("high");
    expect(helper.getCellValue(sampleIssue, "assignee")).toEqual("alice");
    expect(helper.getCellValue(sampleIssue, "tags")).toEqual("a, b");
    expect(helper.getCellValue(sampleIssue, "missing")).toEqual("");
    expect(helper.getRowCells(sampleIssue)).toEqual([
      "MI001",
      "Helloworld",
      "alice",
      "a, b",
    ]);
  });

  it("builds layout defs and uppercase headers for columns", () => {
    const helper = new SelectIssueTableHelper("assignee");
    expect(helper.getColumnDefs()).toEqual([
      { minWidth: 12, maxWidth: 12, grow: 0 },
      { minWidth: 10, grow: 1 },
      { minWidth: 12, maxWidth: 12, grow: 0 },
    ]);
    expect(helper.getHeaderCells()).toEqual(["ID", "TITLE", "ASSIGNEE"]);
  });
});
