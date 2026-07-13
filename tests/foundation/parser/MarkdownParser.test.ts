import { describe, expect, it } from "@jest/globals";
import { MarkdownParser } from "../../../src/foundation/parser/MarkdownParser.ts";

describe("MarkdownParser.parseCheckboxLine", () => {
  it("returns unchecked for an open task list item", () => {
    expect(MarkdownParser.parseCheckboxLine("- [ ] Task")).toEqual({
      checked: false,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("returns checked for lowercase x", () => {
    expect(MarkdownParser.parseCheckboxLine("- [x] Done")).toEqual({
      checked: true,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("returns checked for uppercase X", () => {
    expect(MarkdownParser.parseCheckboxLine("- [X] Done")).toEqual({
      checked: true,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("supports asterisk list markers", () => {
    expect(MarkdownParser.parseCheckboxLine("* [ ] Bullet")).toEqual({
      checked: false,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("supports ordered list markers", () => {
    expect(MarkdownParser.parseCheckboxLine("1. [ ] Ordered")).toEqual({
      checked: false,
      checkboxStart: 3,
      checkboxEnd: 6,
    });
  });

  it("supports indented list items", () => {
    expect(MarkdownParser.parseCheckboxLine("  - [ ] Indented")).toEqual({
      checked: false,
      checkboxStart: 4,
      checkboxEnd: 7,
    });
  });

  it("returns null for headings", () => {
    expect(MarkdownParser.parseCheckboxLine("# Not a checkbox")).toBeNull();
  });

  it("returns null for plain list items", () => {
    expect(MarkdownParser.parseCheckboxLine("- plain list")).toBeNull();
  });
});

describe("MarkdownParser.toggleCheckboxLine", () => {
  it("checks an unchecked item", () => {
    expect(MarkdownParser.toggleCheckboxLine("- [ ] Task")).toBe("- [x] Task");
  });

  it("unchecks a checked item with lowercase x", () => {
    expect(MarkdownParser.toggleCheckboxLine("- [x] Done")).toBe("- [ ] Done");
  });

  it("unchecks a checked item with uppercase X", () => {
    expect(MarkdownParser.toggleCheckboxLine("- [X] Done")).toBe("- [ ] Done");
  });

  it("toggles asterisk list items", () => {
    expect(MarkdownParser.toggleCheckboxLine("* [ ] Bullet")).toBe(
      "* [x] Bullet",
    );
  });

  it("toggles ordered list items", () => {
    expect(MarkdownParser.toggleCheckboxLine("1. [ ] Ordered")).toBe(
      "1. [x] Ordered",
    );
  });

  it("toggles indented list items", () => {
    expect(MarkdownParser.toggleCheckboxLine("  - [ ] Indented")).toBe(
      "  - [x] Indented",
    );
  });

  it("returns null for non-checkbox lines", () => {
    expect(MarkdownParser.toggleCheckboxLine("# Not a checkbox")).toBeNull();
    expect(MarkdownParser.toggleCheckboxLine("- plain list")).toBeNull();
  });
});

describe("MarkdownParser.extractWikiLinkTargets", () => {
  it("extracts a single wiki-link target", () => {
    expect(
      MarkdownParser.extractWikiLinkTargets(
        "See [[MI001-summary]] for details",
      ),
    ).toEqual(["MI001-summary"]);
  });

  it("extracts multiple wiki-link targets in order", () => {
    expect(
      MarkdownParser.extractWikiLinkTargets(
        "See [[MI001-foo]] and [[MI002-bar]]",
      ),
    ).toEqual(["MI001-foo", "MI002-bar"]);
  });

  it("dedupes repeated targets while preserving first-seen order", () => {
    expect(
      MarkdownParser.extractWikiLinkTargets(
        "[[MI001-foo]] then [[MI002-bar]] then [[MI001-foo]]",
      ),
    ).toEqual(["MI001-foo", "MI002-bar"]);
  });

  it("returns an empty array when the line has no wiki links", () => {
    expect(MarkdownParser.extractWikiLinkTargets("No links here")).toEqual([]);
  });
});
