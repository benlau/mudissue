/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { usePaletteCommandMode } from "../../../src/views/hooks/usePaletteCommandMode.ts";

describe("usePaletteCommandMode", () => {
  it("treats a leading colon as command mode", () => {
    const { result: colonResult } = renderHook(() => usePaletteCommandMode(":"));
    expect(colonResult.current.mode).toBe("command");
    expect(colonResult.current.searchQuery).toBe("");

    const { result: prefixedResult } = renderHook(() =>
      usePaletteCommandMode(":new"),
    );
    expect(prefixedResult.current.mode).toBe("command");
    expect(prefixedResult.current.searchQuery).toBe("new");

    const { result: issueResult } = renderHook(() =>
      usePaletteCommandMode("issue"),
    );
    expect(issueResult.current.mode).toBe("issue");
    expect(issueResult.current.searchQuery).toBe("issue");

    const { result: emptyResult } = renderHook(() => usePaletteCommandMode(""));
    expect(emptyResult.current.mode).toBe("issue");
    expect(emptyResult.current.searchQuery).toBe("");
  });

  it("treats a leading question mark as toolbar mode", () => {
    const { result: toolbarResult } = renderHook(() =>
      usePaletteCommandMode("?"),
    );
    expect(toolbarResult.current.mode).toBe("toolbar");
    expect(toolbarResult.current.searchQuery).toBe("");

    const { result: prefixedResult } = renderHook(() =>
      usePaletteCommandMode("?search"),
    );
    expect(prefixedResult.current.mode).toBe("toolbar");
    expect(prefixedResult.current.searchQuery).toBe("search");
  });

  it("resolves mode for arbitrary filter queries", () => {
    const { result } = renderHook(() => usePaletteCommandMode(":"));

    expect(result.current.forFilterQuery(":find")).toEqual({
      mode: "command",
      searchQuery: "find",
    });
    expect(result.current.forFilterQuery("?find")).toEqual({
      mode: "toolbar",
      searchQuery: "find",
    });
    expect(result.current.forFilterQuery("alpha")).toEqual({
      mode: "issue",
      searchQuery: "alpha",
    });
  });
});
