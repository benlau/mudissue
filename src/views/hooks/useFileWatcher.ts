import { useEffect, useRef } from "react";
import { useFileWatcherStore } from "../../store/FileWatcherStore.ts";

export type UseFileWatcherOptions = {
  onReload: () => void;
  enabled?: boolean;
};

/**
 * Subscribe to issue-file reload signals via FileWatcherStore.
 *
 * FileWatcherStore owns FileService.watch. This hook registers interest in a
 * path and invokes onReload when generationByPath increases. Initial load and
 * cursor policy stay with the caller; generation only answers "reload now".
 */
export function useFileWatcher(
  filePath: string | undefined,
  options: UseFileWatcherOptions,
): void {
  const { onReload, enabled = true } = options;
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  const generation = useFileWatcherStore((state) =>
    filePath != null ? (state.generationByPath[filePath] ?? 0) : 0,
  );

  const prevGenerationRef = useRef(0);

  useEffect(() => {
    if (filePath == null) {
      prevGenerationRef.current = 0;
      return;
    }

    // React to store reload signals; skip mount at generation 0.
    if (generation > prevGenerationRef.current) {
      prevGenerationRef.current = generation;
      if (generation > 0) {
        onReloadRef.current();
      }
    }
  }, [filePath, generation]);

  useEffect(() => {
    // New file path: do not treat the previous path's generation as a signal.
    prevGenerationRef.current = 0;
  }, [filePath]);

  useEffect(() => {
    if (!enabled || filePath == null) {
      return;
    }

    useFileWatcherStore.getState().registerWatcher(filePath);

    return () => {
      useFileWatcherStore.getState().unregisterWatcher(filePath);
    };
  }, [enabled, filePath]);
}
