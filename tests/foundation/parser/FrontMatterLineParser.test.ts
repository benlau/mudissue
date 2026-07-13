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
        title: { start: 1, end: 1 },
        status: { start: 2, end: 2 },
        priority: { start: 3, end: 3 },
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
        title: { start: 1, end: 1 },
        tags: { start: 2, end: 4 },
        status: { start: 5, end: 5 },
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
        title: { start: 1, end: 1 },
        status: { start: 2, end: 2 },
      },
    });
  });
});
