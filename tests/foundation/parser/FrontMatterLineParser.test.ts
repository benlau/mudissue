import { describe, expect, it } from "@jest/globals";
import { FrontMatterLineParser } from "../../../src/foundation/parser/FrontMatterLineParser.ts";

describe("FrontMatterLineParser", () => {
  it("returns null for plain markdown with no frontmatter", () => {
    expect(FrontMatterLineParser.parse("# Heading\n\nBody line\n")).toBeNull();
  });

  it("returns null for empty frontmatter between delimiters", () => {
    expect(FrontMatterLineParser.parse("---\n---\n# Body\n")).toBeNull();
  });

  it("returns null when content has preamble before the opening delimiter", () => {
    expect(
      FrontMatterLineParser.parse("preamble\n---\ntitle: hi\n---\n# Body\n"),
    ).toBeNull();
  });

  it("returns null when the closing delimiter is missing", () => {
    expect(FrontMatterLineParser.parse("---\ntitle: hi\n# Body\n")).toBeNull();
  });

  it("returns null when the first line is not an opening delimiter", () => {
    expect(
      FrontMatterLineParser.parse("# Heading\n---\ntitle: hi\n---\n"),
    ).toBeNull();
  });

  it("returns null when gray-matter cannot parse the frontmatter YAML", () => {
    expect(
      FrontMatterLineParser.parse("---\ntitle: value:\n---\n# Body\n"),
    ).toBeNull();
  });

  it("returns frontmatter and per-field line ranges for a typical issue file", () => {
    expect(
      FrontMatterLineParser.parse(`---
title: Demo issue
status: open
priority: high
---
# Heading

Body line
`),
    ).toEqual({
      lineRange: { start: 0, end: 4 },
      fields: {
        title: { lineRange: { start: 1, end: 1 }, value: "Demo issue" },
        status: { lineRange: { start: 2, end: 2 }, value: "open" },
        priority: { lineRange: { start: 3, end: 3 }, value: "high" },
      },
    });
  });

  it("extends a field range through list-item continuation lines until the next key", () => {
    expect(
      FrontMatterLineParser.parse(`---
title: Demo issue
tags:
  - bug
  - feature
status: open
---
# Body
`),
    ).toEqual({
      lineRange: { start: 0, end: 6 },
      fields: {
        title: { lineRange: { start: 1, end: 1 }, value: "Demo issue" },
        tags: {
          lineRange: { start: 2, end: 4 },
          value: ["bug", "feature"],
        },
        status: { lineRange: { start: 5, end: 5 }, value: "open" },
      },
    });
  });

  it("normalizes CRLF line endings before computing line ranges", () => {
    expect(
      FrontMatterLineParser.parse(
        "---\r\ntitle: Demo issue\r\nstatus: open\r\n---\r\n# Body\r\n",
      ),
    ).toEqual({
      lineRange: { start: 0, end: 3 },
      fields: {
        title: { lineRange: { start: 1, end: 1 }, value: "Demo issue" },
        status: { lineRange: { start: 2, end: 2 }, value: "open" },
      },
    });
  });

  it("parses boolean frontmatter values as real booleans on fields", () => {
    expect(
      FrontMatterLineParser.parse(`---
title: Demo issue
TaskRequirement: false
ImplementPlan: true
flag: "true"
---
# Body
`),
    ).toEqual({
      lineRange: { start: 0, end: 5 },
      fields: {
        title: { lineRange: { start: 1, end: 1 }, value: "Demo issue" },
        TaskRequirement: {
          lineRange: { start: 2, end: 2 },
          value: false,
        },
        ImplementPlan: { lineRange: { start: 3, end: 3 }, value: true },
        flag: { lineRange: { start: 4, end: 4 }, value: "true" },
      },
    });
  });
});

describe("FrontMatterLineParser.toggleBooleanAtLine", () => {
  it("flips a boolean frontmatter field from false to true", () => {
    expect(
      FrontMatterLineParser.toggleBooleanAtLine(
        ["---", "Commit: false", "---", "# Body"],
        1,
      ),
    ).toEqual(["---", "Commit: true", "---", "# Body"]);
  });

  it("flips a boolean frontmatter field from true to false", () => {
    expect(
      FrontMatterLineParser.toggleBooleanAtLine(
        ["---", "Commit: true", "---", "# Body"],
        1,
      ),
    ).toEqual(["---", "Commit: false", "---", "# Body"]);
  });

  it("returns null for a boolean-looking line outside frontmatter", () => {
    expect(
      FrontMatterLineParser.toggleBooleanAtLine(
        ["---", "title: Demo", "---", "Commit: false"],
        3,
      ),
    ).toBeNull();
  });

  it("returns null for a quoted string true/false field", () => {
    expect(
      FrontMatterLineParser.toggleBooleanAtLine(
        ["---", 'flag: "true"', "---", "# Body"],
        1,
      ),
    ).toBeNull();
  });

  it("returns null for a non-boolean frontmatter field", () => {
    expect(
      FrontMatterLineParser.toggleBooleanAtLine(
        ["---", "status: open", "---", "# Body"],
        1,
      ),
    ).toBeNull();
  });
});
