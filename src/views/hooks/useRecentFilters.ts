import { useState, useCallback } from "react";
import { z } from "zod";
import type { RegistryService } from "../../services/RegistryService.ts";
import { MUDISSUE_STATE_URL, MAX_RECENT_FILTERS } from "../../constants.ts";
import { MudissueStateKey } from "../../types/registry.ts";

const RecentFilterListSchema = z.array(z.string());

function parseRecentFilters(value: string | undefined): string[] {
  if (value === undefined || value === "") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = RecentFilterListSchema.safeParse(parsed);
    if (!result.success) return [];
    return result.data;
  } catch {
    return [];
  }
}

export function useRecentFilters(registryService: RegistryService): {
  recentFilters: string[];
  reload: () => Promise<string[]>;
  addFilter: (value: string) => Promise<void>;
} {
  const [recentFilters, setRecentFilters] = useState<string[]>([]);

  const reload = useCallback(async (): Promise<string[]> => {
    try {
      const row = await registryService.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentFiltersKey,
      );
      const list = parseRecentFilters(row?.value);
      setRecentFilters(list);
      return list;
    } catch {
      setRecentFilters([]);
      return [];
    }
  }, [registryService]);

  const addFilter = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed === "") return;
      try {
        const next = [
          trimmed,
          ...recentFilters.filter((f) => f !== trimmed),
        ].slice(0, MAX_RECENT_FILTERS);
        await registryService.set(
          MudissueStateKey.RecentFiltersKey,
          JSON.stringify(next),
          MUDISSUE_STATE_URL,
          "system",
        );
        setRecentFilters(next);
      } catch {
        // fail silently
      }
    },
    [registryService, recentFilters],
  );
  return { recentFilters, reload, addFilter };
}
