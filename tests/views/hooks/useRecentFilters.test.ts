/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { act, render } from "@testing-library/react";
import { createElement, useCallback, useEffect } from "react";
import { useRecentFilters } from "../../../src/views/hooks/useRecentFilters.ts";
import type { RegistryService } from "../../../src/services/RegistryService.ts";
import { MUDISSUE_STATE_URL, MAX_RECENT_FILTERS } from "../../../src/constants.ts";
import { MudissueStateKey } from "../../../src/types/registry.ts";

describe("useRecentFilters", () => {
  let mockGet: jest.MockedFunction<RegistryService["get"]>;
  let mockSet: jest.MockedFunction<RegistryService["set"]>;
  let mockRegistry: RegistryService;

  beforeEach(() => {
    mockGet = jest.fn().mockResolvedValue(null);
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockRegistry = {
      get: mockGet,
      set: mockSet,
    } as unknown as RegistryService;
  });

  it("reload returns [] when registry has no value", async () => {
    mockGet.mockResolvedValue(null);
    let list: string[] = [];
    function Consumer() {
      const { reload } = useRecentFilters(mockRegistry);
      const load = useCallback(async () => {
        list = await reload();
      }, [reload]);
      useEffect(() => {
        void load();
      }, [load]);
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r));
    });
    expect(list).toEqual([]);
    expect(mockGet).toHaveBeenCalledWith(
      MUDISSUE_STATE_URL,
      "system",
      MudissueStateKey.RecentFiltersKey,
    );
  });

  it("reload parses JSON and returns string array", async () => {
    mockGet.mockResolvedValue({
      url: MUDISSUE_STATE_URL,
      value: JSON.stringify(["a", "b"]),
    });
    let list: string[] = [];
    function Consumer() {
      const { reload } = useRecentFilters(mockRegistry);
      const load = useCallback(async () => {
        list = await reload();
      }, [reload]);
      useEffect(() => {
        void load();
      }, [load]);
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(list).toEqual(["a", "b"]);
  });

  it("reload returns [] for invalid JSON", async () => {
    mockGet.mockResolvedValue({
      url: MUDISSUE_STATE_URL,
      value: "not json",
    });
    let list: string[] = [];
    function Consumer() {
      const { reload } = useRecentFilters(mockRegistry);
      const load = useCallback(async () => {
        list = await reload();
      }, [reload]);
      useEffect(() => {
        void load();
      }, [load]);
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(list).toEqual([]);
  });

  it("addFilter deduplicates and caps at MAX_RECENT_FILTERS", async () => {
    mockGet.mockResolvedValue(null);
    let addFilterFn: (value: string) => Promise<void> = async () => {};
    function Consumer() {
      const { addFilter } = useRecentFilters(mockRegistry);
      addFilterFn = addFilter;
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    await act(async () => {
      await addFilterFn("first");
    });
    expect(mockSet).toHaveBeenCalledWith(
      MudissueStateKey.RecentFiltersKey,
      JSON.stringify(["first"]),
      MUDISSUE_STATE_URL,
      "system",
    );
    await act(async () => {
      await addFilterFn("second");
    });
    expect(mockSet).toHaveBeenLastCalledWith(
      MudissueStateKey.RecentFiltersKey,
      JSON.stringify(["second", "first"]),
      MUDISSUE_STATE_URL,
      "system",
    );
    await act(async () => {
      await addFilterFn("second");
    });
    expect(mockSet).toHaveBeenLastCalledWith(
      MudissueStateKey.RecentFiltersKey,
      JSON.stringify(["second", "first"]),
      MUDISSUE_STATE_URL,
      "system",
    );
  });

  it("addFilter does nothing for empty or whitespace string", async () => {
    mockGet.mockResolvedValue(null);
    let addFilterFn: (value: string) => Promise<void> = async () => {};
    function Consumer() {
      const { addFilter } = useRecentFilters(mockRegistry);
      addFilterFn = addFilter;
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    mockSet.mockClear();
    await act(async () => {
      await addFilterFn("");
    });
    await act(async () => {
      await addFilterFn("   ");
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("addFilter caps list at MAX_RECENT_FILTERS", async () => {
    mockGet.mockResolvedValue(null);
    let addFilterFn: (value: string) => Promise<void> = async () => {};
    function Consumer() {
      const { addFilter } = useRecentFilters(mockRegistry);
      addFilterFn = addFilter;
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    for (let i = 0; i <= MAX_RECENT_FILTERS; i++) {
      await act(async () => {
        await addFilterFn(`filter-${i}`);
      });
    }
    const lastSetCall = mockSet.mock.calls[mockSet.mock.calls.length - 1];
    const stored = JSON.parse(lastSetCall[1] as string) as string[];
    expect(stored.length).toBe(MAX_RECENT_FILTERS);
  });
});
