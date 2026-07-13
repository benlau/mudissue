import { ObsidianKanbanAccessor } from "../../src/types/ObsidianKanban.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { DEFAULT_PRIORITY_LIST } from "../../src/types/priority.ts";
import { TemplateGenerator } from "../../src/utils/generators/TemplateGenerator.ts";

import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

function issueFolder(
  issueId: string,
  folderName: string,
  overrides: Parameters<typeof buildIssueFolder>[1] = {},
): IssueFolder {
  return buildIssueFolder(issueId, {
    folderName,
    path: `/workspace/issues/${folderName}`,
    ...overrides,
  });
}

function renderBoard(
  input: Parameters<typeof ObsidianKanbanAccessor.createFromIssueFolders>[0],
): string {
  const board = ObsidianKanbanAccessor.createFromIssueFolders(input);
  const generator = new TemplateGenerator();
  return generator.getTemplate("obsidian-kanban", board.get())!;
}

describe("ObsidianKanbanAccessor.createFromIssueFolders", () => {
  const statusList = ["inbox", "in_progress", "closed"];
  const priorityList = DEFAULT_PRIORITY_LIST;

  it("when issues span configured statuses, places each card in the matching column in status_list order", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [
        issueFolder("0001", "0001", { status: "inbox", priority: "medium" }),
        issueFolder("0002", "0002", { status: "inbox", priority: "low" }),
        issueFolder("0003", "0003", {
          status: "in_progress",
          priority: "high",
        }),
      ],
      statusList,
      priorityList,
      resolveIssueFileStem: (folder) => folder.issueId,
    }).get();

    expect(board.columns.map((column) => column.title)).toEqual([
      "inbox",
      "in_progress",
      "closed",
    ]);
    expect(board.columns[0]?.cards.map((card) => card.wikiLink)).toEqual([
      "[[0001]]",
      "[[0002]]",
    ]);
    expect(board.columns[1]?.cards.map((card) => card.wikiLink)).toEqual([
      "[[0003]]",
    ]);
    expect(board.columns[2]?.cards).toEqual([]);
  });

  it("when multiple issues share a column, sorts cards by priority with urgent first", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [
        issueFolder("0001", "0001", { status: "inbox", priority: "low" }),
        issueFolder("0002", "0002", { status: "inbox", priority: "urgent" }),
        issueFolder("0003", "0003", { status: "inbox", priority: "medium" }),
      ],
      statusList,
      priorityList,
      resolveIssueFileStem: (folder) => folder.issueId,
    }).get();

    expect(board.columns[0]?.cards.map((card) => card.wikiLink)).toEqual([
      "[[0002]]",
      "[[0003]]",
      "[[0001]]",
    ]);
  });

  it("when an issue status is missing from status_list, appends an Others column at the end", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [
        issueFolder("0001", "0001", { status: "inbox" }),
        issueFolder("0002", "0002", { status: "mystery" }),
      ],
      statusList,
      priorityList,
      resolveIssueFileStem: (folder) => folder.issueId,
    }).get();

    expect(board.columns.map((column) => column.title)).toEqual([
      "inbox",
      "in_progress",
      "closed",
      "Others",
    ]);
    expect(board.columns[3]?.cards.map((card) => card.wikiLink)).toEqual([
      "[[0002]]",
    ]);
  });

  it("when every issue status is configured, omits the Others column", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [
        issueFolder("0001", "0001", { status: "inbox" }),
        issueFolder("0002", "0002", { status: "closed" }),
      ],
      statusList,
      priorityList,
      resolveIssueFileStem: (folder) => folder.issueId,
    }).get();

    expect(board.columns.some((column) => column.title === "Others")).toBe(
      false,
    );
  });

  it("when the issue file stem differs from the folder name, links cards by issue filename", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [
        issueFolder("MI001", "MI001-summary", { status: "inbox" }),
      ],
      statusList: ["inbox"],
      priorityList,
      resolveIssueFileStem: () => "MI001",
    }).get();

    expect(board.columns[0]?.cards[0]?.wikiLink).toBe("[[MI001]]");
  });

  it("when issue_file_pattern is fixed, links cards by issue filename instead of folder name", () => {
    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: [issueFolder("0001", "0001-summary", { status: "inbox" })],
      statusList: ["inbox"],
      priorityList,
      resolveIssueFileStem: () => "issue",
    }).get();

    expect(board.columns[0]?.cards[0]?.wikiLink).toBe("[[issue]]");
  });

  it("when rendered through the obsidian-kanban template, produces Obsidian Kanban markdown", () => {
    const rendered = renderBoard({
      issues: [
        issueFolder("0001", "0001", { status: "inbox" }),
        issueFolder("0002", "0002", { status: "inbox" }),
        issueFolder("0003", "0003", { status: "in_progress" }),
      ],
      statusList: ["inbox", "in_progress"],
      priorityList,
      resolveIssueFileStem: (folder) => folder.issueId,
    });

    expect(rendered).toEqual(
      [
        "---",
        "kanban-plugin: board",
        "---",
        "",
        "",
        "## inbox",
        "",
        "",
        "- [ ] [[0001]]",
        "",
        "- [ ] [[0002]]",
        "",
        "",
        "",
        "## in_progress",
        "",
        "",
        "- [ ] [[0003]]",
        "",
        "",
        "",
        "%% kanban:settings",
        "```",
        '{"kanban-plugin":"board","list-collapse":[false,false]}',
        "```",
        "%%",
        "",
      ].join("\n"),
    );
  });
});

describe("ObsidianKanbanAccessor.formatCardWikiLink", () => {
  it("wraps the issue file stem in wikilink brackets", () => {
    const link = ObsidianKanbanAccessor.formatCardWikiLink("MI001-summary");

    expect(link).toBe("[[MI001-summary]]");
  });
});
