import { describe, expect, it } from "@jest/globals";
import {
  accessPaletteCommand,
  accessPaletteCommandList,
} from "../../src/types/PaletteCommand.ts";

describe("accessPaletteCommand", () => {
  it("matchesNormalizedQuery finds key label and description substrings", () => {
    const cmd = accessPaletteCommand({
      label: "Search",
      key: "search",
      shortcutKey: "/",
      description: "Filter issues",
      callback: async () => {},
    });
    expect(cmd.matchesNormalizedQuery("search")).toBe(true);
    expect(cmd.matchesNormalizedQuery("/")).toBe(true);
    expect(cmd.matchesNormalizedQuery("filter")).toBe(true);
    expect(cmd.matchesNormalizedQuery("nomatch")).toBe(false);
    expect(cmd.matchesNormalizedQuery("")).toBe(true);
  });
});

describe("accessPaletteCommandList", () => {
  const rows = [
    { label: "Alpha", key: "a", callback: async () => {} },
    {
      label: "Beta",
      key: "b",
      description: "second",
      callback: async () => {},
    },
  ];

  it("filterMatchingQuery returns all when query blank", () => {
    expect(
      accessPaletteCommandList(rows).filterMatchingQuery("  "),
    ).toHaveLength(2);
  });

  it("filterMatchingQuery subsets by fields", () => {
    expect(
      accessPaletteCommandList(rows).filterMatchingQuery("beta"),
    ).toHaveLength(1);
    expect(
      accessPaletteCommandList(rows).filterMatchingQuery("second")[0]?.key,
    ).toBe("b");
  });

  it("hasUniqueKeys is false when keys are empty or duplicated", () => {
    expect(
      accessPaletteCommandList([
        { label: "A", key: "a", callback: async () => {} },
        { label: "B", key: "a", callback: async () => {} },
      ]).hasUniqueKeys(),
    ).toBe(false);
    expect(
      accessPaletteCommandList([
        { label: "A", key: "", callback: async () => {} },
      ]).hasUniqueKeys(),
    ).toBe(false);
    expect(accessPaletteCommandList(rows).hasUniqueKeys()).toBe(true);
  });

  it("withLastUsedKeyFirst moves matching command to front", () => {
    const reordered = accessPaletteCommandList(rows).withLastUsedKeyFirst("b");
    expect(reordered.map((c) => c.key)).toEqual(["b", "a"]);
  });

  it("withLastUsedKeyFirst is no-op when key missing null or already first", () => {
    const list = accessPaletteCommandList(rows);
    expect(list.withLastUsedKeyFirst(null).map((c) => c.key)).toEqual([
      "a",
      "b",
    ]);
    expect(list.withLastUsedKeyFirst("  ").map((c) => c.key)).toEqual([
      "a",
      "b",
    ]);
    expect(list.withLastUsedKeyFirst("missing").map((c) => c.key)).toEqual([
      "a",
      "b",
    ]);
    expect(list.withLastUsedKeyFirst("a").map((c) => c.key)).toEqual([
      "a",
      "b",
    ]);
  });
});
