import { useCallback, useMemo } from "react";

export type PaletteFilterModeKind = "toolbar" | "command" | "issue";

export type PaletteFilterMode = {
  mode: PaletteFilterModeKind;
  searchQuery: string;
};

function resolvePaletteFilterMode(filterQuery: string): PaletteFilterMode {
  if (filterQuery.startsWith("?")) {
    return { mode: "toolbar", searchQuery: filterQuery.slice(1) };
  }
  if (filterQuery.startsWith(":")) {
    return { mode: "command", searchQuery: filterQuery.slice(1) };
  }
  return { mode: "issue", searchQuery: filterQuery };
}

export function usePaletteCommandMode(
  filterQuery: string,
): PaletteFilterMode & {
  forFilterQuery: (query: string) => PaletteFilterMode;
} {
  const forFilterQuery = useCallback(
    (query: string): PaletteFilterMode => resolvePaletteFilterMode(query),
    [],
  );

  return useMemo(
    () => ({
      ...forFilterQuery(filterQuery),
      forFilterQuery,
    }),
    [filterQuery, forFilterQuery],
  );
}
