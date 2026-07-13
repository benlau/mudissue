import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SAVE_DEBOUNCE_MS } from "../constants.ts";
import { FileService } from "../services/FileService.ts";

// Reload scheduling for watched issue files. generationByPath is the pub/sub
// channel: producers bump it; useFileWatcher consumers react via onReload.
// This store owns FileService.watch; setFileWatchEnabled pauses event handling
// during local writes without tearing down the registration.

const deferReloadTimers = new Map<
  string,
  ReturnType<typeof globalThis.setTimeout>
>();
const watchedPathRefCounts = new Map<string, number>();
const watchUnsubscribers = new Map<string, () => void>();
const watchEnabledByPath = new Map<string, boolean>();

function isWatched(filePath: string): boolean {
  return (watchedPathRefCounts.get(filePath) ?? 0) > 0;
}

function isWatchEnabled(filePath: string): boolean {
  return watchEnabledByPath.get(filePath) !== false;
}

function clearDeferReloadTimer(filePath: string): void {
  const timer = deferReloadTimers.get(filePath);
  if (timer != null) {
    globalThis.clearTimeout(timer);
    deferReloadTimers.delete(filePath);
  }
}

function hasDeferredReload(filePath: string): boolean {
  return deferReloadTimers.has(filePath);
}

function startWatching(filePath: string): void {
  if (watchUnsubscribers.has(filePath)) {
    return;
  }

  watchEnabledByPath.set(filePath, true);
  const unsubscribe = FileService.getInstance().watch(filePath, () => {
    if (!isWatchEnabled(filePath)) {
      return;
    }
    useFileWatcherStore.getState().deferReload(filePath);
  });
  watchUnsubscribers.set(filePath, unsubscribe);
}

function stopWatching(filePath: string): void {
  const unsubscribe = watchUnsubscribers.get(filePath);
  if (unsubscribe != null) {
    unsubscribe();
    watchUnsubscribers.delete(filePath);
  }
  watchEnabledByPath.delete(filePath);
}

function bumpGeneration(
  set: (
    updater: (draft: { generationByPath: Record<string, number> }) => void,
  ) => void,
  filePath: string,
): void {
  // Monotonic reload signal per path. useFileWatcher subscribers call onReload
  // when this counter increases; the store does not load files itself.
  set((draft) => {
    draft.generationByPath[filePath] =
      (draft.generationByPath[filePath] ?? 0) + 1;
  });
}

export type FileWatcherStoreState = {
  /** Per-path reload generation; bumped by requestReload, deferReload, cancelReload. */
  generationByPath: Record<string, number>;
  registerWatcher: (filePath: string) => void;
  unregisterWatcher: (filePath: string) => void;
  setFileWatchEnabled: (filePath: string, enabled: boolean) => void;
  requestReload: (filePath: string) => void;
  deferReload: (filePath: string) => void;
  cancelReload: (filePath: string) => void;
};

export const useFileWatcherStore = create<FileWatcherStoreState>()(
  immer((set) => ({
    generationByPath: {},

    registerWatcher: (filePath) => {
      const nextCount = (watchedPathRefCounts.get(filePath) ?? 0) + 1;
      watchedPathRefCounts.set(filePath, nextCount);
      if (nextCount === 1) {
        startWatching(filePath);
      }
    },

    unregisterWatcher: (filePath) => {
      const nextCount = (watchedPathRefCounts.get(filePath) ?? 0) - 1;
      if (nextCount <= 0) {
        watchedPathRefCounts.delete(filePath);
        clearDeferReloadTimer(filePath);
        stopWatching(filePath);
        return;
      }
      watchedPathRefCounts.set(filePath, nextCount);
    },

    setFileWatchEnabled: (filePath, enabled) => {
      if (!isWatched(filePath)) {
        return;
      }

      watchEnabledByPath.set(filePath, enabled);
      if (!enabled) {
        clearDeferReloadTimer(filePath);
      }
    },

    requestReload: (filePath) => {
      if (!isWatched(filePath)) {
        return;
      }

      clearDeferReloadTimer(filePath);
      bumpGeneration(set, filePath);
    },

    deferReload: (filePath) => {
      if (!isWatched(filePath)) {
        return;
      }

      clearDeferReloadTimer(filePath);
      deferReloadTimers.set(
        filePath,
        globalThis.setTimeout(() => {
          deferReloadTimers.delete(filePath);
          if (!isWatched(filePath)) {
            return;
          }
          bumpGeneration(set, filePath);
        }, SAVE_DEBOUNCE_MS),
      );
    },

    cancelReload: (filePath) => {
      if (!hasDeferredReload(filePath)) {
        return;
      }

      clearDeferReloadTimer(filePath);
      if (isWatched(filePath)) {
        bumpGeneration(set, filePath);
      }
    },
  })),
);

export function resetFileWatcherStore(): void {
  for (const timer of deferReloadTimers.values()) {
    globalThis.clearTimeout(timer);
  }
  deferReloadTimers.clear();
  for (const unsubscribe of watchUnsubscribers.values()) {
    unsubscribe();
  }
  watchUnsubscribers.clear();
  watchEnabledByPath.clear();
  watchedPathRefCounts.clear();
  useFileWatcherStore.setState({ generationByPath: {} });
}
