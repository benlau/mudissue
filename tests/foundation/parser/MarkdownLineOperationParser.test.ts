import { describe, expect, it } from "@jest/globals";
import { MarkdownLineOperationParser } from "../../../src/foundation/parser/MarkdownLineOperationParser.ts";

const ISSUE_LINES = [
  "---",
  "title: Demo issue",
  "status: open",
  "priority: high",
  "---",
  "# Heading",
  "",
  "Body line",
];

describe("MarkdownLineOperationParser", () => {
  it("detects checkbox lines as LineOperationInfo", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "# Heading",
        "",
        "- [ ] Task one",
        "- [x] Task two",
      ]),
    ).toEqual([
      { kind: "checkbox", logicalLineIndexes: [2] },
      { kind: "checkbox", logicalLineIndexes: [3] },
    ]);
  });

  it("returns an empty array when no checkbox lines exist", () => {
    expect(
      MarkdownLineOperationParser.detect(["# Heading", "Body line"]),
    ).toEqual([]);
  });

  it("detects frontmatter boundary lines when frontmatter is valid", () => {
    expect(MarkdownLineOperationParser.detect(ISSUE_LINES)).toContainEqual({
      kind: "frontmatter_boundary",
      logicalLineIndexes: [0, 4],
    });
  });

  it("does not detect frontmatter boundary when frontmatter is missing", () => {
    expect(
      MarkdownLineOperationParser.detect(["# Heading", "Body line"]),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "frontmatter_boundary" }),
      ]),
    );
  });

  it("does not detect frontmatter boundary when YAML is invalid", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "---",
        "title: value:",
        "---",
        "# Body",
      ]),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "frontmatter_boundary" }),
      ]),
    );
  });

  it("detects status and priority on a typical issue file", () => {
    const detected = MarkdownLineOperationParser.detect(ISSUE_LINES);
    expect(detected).toContainEqual({ kind: "status", logicalLineIndexes: [2] });
    expect(detected).toContainEqual({
      kind: "priority",
      logicalLineIndexes: [3],
    });
  });

  it("does not detect checkbox lines inside frontmatter", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "---",
        "title: Demo",
        "note: |",
        "  - [ ] inside frontmatter",
        "---",
        "- [ ] outside frontmatter",
      ]),
    ).toEqual([
      { kind: "frontmatter_boundary", logicalLineIndexes: [0, 4] },
      { kind: "checkbox", logicalLineIndexes: [5] },
    ]);
  });

  it("extends field line indexes through YAML continuation lines", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "---",
        "title: Demo",
        "priority:",
        "  - high",
        "  - urgent",
        "---",
        "# Body",
      ]),
    ).toContainEqual({
      kind: "priority",
      logicalLineIndexes: [2, 3, 4],
    });
  });

  it("detects linkage operations for list-style link fields", () => {
    const lines = [
      "---",
      "title: Demo",
      "related:",
      "  - [[MI0365-toggle-checkbox-inside-markdownviewer]]",
      "  - [[MI0368-markdownviewer-edit-refresh-should-perser]]",
      "---",
      "# Body",
    ];

    expect(
      MarkdownLineOperationParser.detect(lines, {
        linkTypeFieldNames: ["related"],
      }),
    ).toEqual(
      expect.arrayContaining([
        {
          kind: "linkage",
          logicalLineIndexes: [3],
          linkageType: "related",
          issueSelector: "MI0365-toggle-checkbox-inside-markdownviewer",
        },
        {
          kind: "linkage",
          logicalLineIndexes: [4],
          linkageType: "related",
          issueSelector: "MI0368-markdownviewer-edit-refresh-should-perser",
        },
      ]),
    );
  });

  it("detects linkage operations for scalar link fields", () => {
    const lines = [
      "---",
      "title: Demo",
      "parent: [[MI002-child]]",
      "---",
      "# Body",
    ];

    expect(
      MarkdownLineOperationParser.detect(lines, {
        linkTypeFieldNames: ["parent"],
      }),
    ).toContainEqual({
      kind: "linkage",
      logicalLineIndexes: [2],
      linkageType: "parent",
      issueSelector: "MI002-child",
    });
  });

  it("ignores link fields not listed in linkTypeFieldNames", () => {
    const lines = [
      "---",
      "title: Demo",
      "related:",
      "  - [[MI0365-toggle-checkbox-inside-markdownviewer]]",
      "---",
      "# Body",
    ];

    expect(
      MarkdownLineOperationParser.detect(lines, {
        linkTypeFieldNames: ["blocking"],
      }),
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "linkage" })]),
    );
  });

  it("skips linkage field lines without wiki links", () => {
    const lines = [
      "---",
      "title: Demo",
      "related:",
      "---",
      "# Body",
    ];

    expect(
      MarkdownLineOperationParser.detect(lines, {
        linkTypeFieldNames: ["related"],
      }),
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "linkage" })]),
    );
  });

  it("detects a single body wiki-link as a wikilink operation", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "# Heading",
        "See [[MI001-summary]] for details",
      ]),
    ).toEqual([
      {
        kind: "wikilink",
        logicalLineIndexes: [1],
        issueSelectors: ["MI001-summary"],
      },
    ]);
  });

  it("detects multiple body wiki-links on one line as a single wikilink operation", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "See [[MI001-foo]] and [[MI002-bar]]",
      ]),
    ).toEqual([
      {
        kind: "wikilink",
        logicalLineIndexes: [0],
        issueSelectors: ["MI001-foo", "MI002-bar"],
      },
    ]);
  });

  it("ignores body wiki links that are not issue selectors", () => {
    expect(
      MarkdownLineOperationParser.detect([
        "See [[plain-note]] and [[MI001-summary]]",
      ]),
    ).toEqual([
      {
        kind: "wikilink",
        logicalLineIndexes: [0],
        issueSelectors: ["MI001-summary"],
      },
    ]);
  });

  it("detects attachment operations from the attachments frontmatter field", () => {
    const lines = [
      "---",
      "title: Demo",
      "attachments:",
      "  - [[notes]]",
      "  - [[screenshot.png]]",
      "---",
      "# Body",
      "See [[notes]] in body",
    ];

    expect(MarkdownLineOperationParser.detect(lines)).toEqual(
      expect.arrayContaining([
        {
          kind: "attachment",
          logicalLineIndexes: [3],
          attachmentRef: "notes",
        },
        {
          kind: "attachment",
          logicalLineIndexes: [4],
          attachmentRef: "screenshot.png",
        },
      ]),
    );
    expect(MarkdownLineOperationParser.detect(lines)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "attachment",
          logicalLineIndexes: [7],
        }),
      ]),
    );
  });

  it("skips attachments field lines without wiki links", () => {
    const lines = [
      "---",
      "title: Demo",
      "attachments:",
      "---",
      "# Body",
    ];

    expect(MarkdownLineOperationParser.detect(lines)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "attachment" }),
      ]),
    );
  });

  it("does not detect wiki links inside frontmatter as wikilink operations", () => {
    const lines = [
      "---",
      "title: Demo",
      "related:",
      "  - [[MI0365-toggle-checkbox-inside-markdownviewer]]",
      "---",
      "# Body",
    ];

    const detected = MarkdownLineOperationParser.detect(lines, {
      linkTypeFieldNames: ["related"],
    });
    expect(detected).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "wikilink" })]),
    );
    expect(detected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "linkage",
          logicalLineIndexes: [3],
          linkageType: "related",
          issueSelector: "MI0365-toggle-checkbox-inside-markdownviewer",
        }),
      ]),
    );
  });
});
