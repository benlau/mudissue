import { useEffect, useRef } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { LineRange } from "../types/LineRange.ts";
import { clamp } from "../types/maths.ts";
import { MarkdownLineOperationsStorage } from "../utils/storage/MarkdownLineOperationsStorage.ts";
import { useFileWatcherStore } from "./FileWatcherStore.ts";

export type MarkdownViewerSetContentOptions = {
  content: string;
  logicalLineIndex?: number;
};

function contentToLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized.length > 0 ? normalized.split("\n") : [""];
}

export type MarkdownViewerHandleStoreState = {
  content: string;
  filePath: string | null;
  selectedLogicalLineIndex: number;
  selectedDisplaySubRow: number;
  currentDisplayIndex: number;
  selectionAnchorLogicalLineIndex: number | null;

  setFilePath: (filePath: string) => void;
  setContent: (options: MarkdownViewerSetContentOptions) => void;
  updateContent: (content: string) => void;
  setCursor: (
    logicalLineIndex: number,
    displaySubRow: number,
    displayIndex: number,
  ) => void;
  resetCursor: () => void;
  clearSelection: () => void;
  toggleSelectionMode: () => void;
  getSelectedLogicalLineRange: () => LineRange | null;
  getSelectedContent: () => string | null;
  replaceSelection: (replacement: string) => string | null;
  toggleCheckboxAtLine: (logicalLineIndex: number) => Promise<void>;
  toggleBooleanAtLine: (logicalLineIndex: number) => Promise<void>;
  save: () => Promise<void>;
  setOnLinesChanged: (callback: (lines: string[]) => void) => void;
  setOnSaved: (callback: (mtime: Date) => void) => void;
};

export type MarkdownViewerHandleStore =
  StoreApi<MarkdownViewerHandleStoreState>;

export function createMarkdownViewerHandleStore(): MarkdownViewerHandleStore {
  let lineOperationsStorage: MarkdownLineOperationsStorage | null = null;

  return createStore<MarkdownViewerHandleStoreState>((set, get) => ({
    content: "",
    filePath: null,
    selectedLogicalLineIndex: 0,
    selectedDisplaySubRow: 0,
    currentDisplayIndex: 0,
    selectionAnchorLogicalLineIndex: null,

    setFilePath: (filePath) => {
      lineOperationsStorage = new MarkdownLineOperationsStorage(filePath);
      lineOperationsStorage.setLines(contentToLines(get().content));
      set({ filePath });
    },

    setContent: ({ content, logicalLineIndex }) => {
      const normalized = content.replace(/\r\n/g, "\n");
      const lines = contentToLines(normalized);
      lineOperationsStorage?.setLines(lines);

      if (logicalLineIndex === undefined) {
        set({ content: normalized });
        return;
      }

      const nextLogical = clamp(
        logicalLineIndex,
        0,
        Math.max(0, lines.length - 1),
      );
      set({
        content: normalized,
        selectionAnchorLogicalLineIndex: null,
        selectedLogicalLineIndex: nextLogical,
        selectedDisplaySubRow: 0,
        currentDisplayIndex: nextLogical,
      });
    },

    updateContent: (content) => {
      const normalized = content.replace(/\r\n/g, "\n");
      set({ content: normalized });
    },

    setCursor: (logicalLineIndex, displaySubRow, displayIndex) => {
      set({
        selectedLogicalLineIndex: logicalLineIndex,
        selectedDisplaySubRow: displaySubRow,
        currentDisplayIndex: displayIndex,
      });
    },

    resetCursor: () => {
      set({
        selectedLogicalLineIndex: 0,
        selectedDisplaySubRow: 0,
        currentDisplayIndex: 0,
        selectionAnchorLogicalLineIndex: null,
      });
    },

    clearSelection: () => {
      set({ selectionAnchorLogicalLineIndex: null });
    },

    toggleSelectionMode: () => {
      const { selectionAnchorLogicalLineIndex, selectedLogicalLineIndex } =
        get();
      if (selectionAnchorLogicalLineIndex != null) {
        set({ selectionAnchorLogicalLineIndex: null });
        return;
      }
      set({ selectionAnchorLogicalLineIndex: selectedLogicalLineIndex });
    },

    getSelectedLogicalLineRange: () => {
      const { selectionAnchorLogicalLineIndex, selectedLogicalLineIndex } =
        get();
      if (selectionAnchorLogicalLineIndex == null) {
        return null;
      }
      return {
        start: Math.min(
          selectionAnchorLogicalLineIndex,
          selectedLogicalLineIndex,
        ),
        end: Math.max(
          selectionAnchorLogicalLineIndex,
          selectedLogicalLineIndex,
        ),
      };
    },

    getSelectedContent: () => {
      const range = get().getSelectedLogicalLineRange();
      if (range == null) {
        return null;
      }
      const lines = contentToLines(get().content);
      const selected = lines.slice(range.start, range.end + 1);
      if (selected.length === 0) {
        return null;
      }
      return selected.join("\n");
    },

    replaceSelection: (replacement) => {
      const range = get().getSelectedLogicalLineRange();
      if (range == null || lineOperationsStorage == null) {
        return null;
      }
      const replacementLines =
        replacement === "" ? [] : replacement.split("\n");
      const replacedLines = lineOperationsStorage.replaceLineRange(
        range,
        replacementLines,
      );
      const nextContent = lineOperationsStorage.getLines().join("\n");
      set({
        content: nextContent,
        selectionAnchorLogicalLineIndex: null,
        selectedLogicalLineIndex: range.start,
        selectedDisplaySubRow: 0,
        currentDisplayIndex: range.start,
      });
      return replacedLines.join("\n");
    },

    toggleCheckboxAtLine: async (logicalLineIndex) => {
      if (lineOperationsStorage == null) {
        return;
      }

      const filePath = get().filePath;
      if (filePath != null) {
        useFileWatcherStore.getState().setFileWatchEnabled(filePath, false);
      }
      try {
        await lineOperationsStorage.toggleCheckboxAtLine(logicalLineIndex);
        await lineOperationsStorage.saveNow();
      } finally {
        if (filePath != null) {
          useFileWatcherStore.getState().setFileWatchEnabled(filePath, true);
        }
      }
    },

    toggleBooleanAtLine: async (logicalLineIndex) => {
      if (lineOperationsStorage == null) {
        return;
      }

      const filePath = get().filePath;
      if (filePath != null) {
        useFileWatcherStore.getState().setFileWatchEnabled(filePath, false);
      }
      try {
        await lineOperationsStorage.toggleBooleanAtLine(logicalLineIndex);
        await lineOperationsStorage.saveNow();
      } finally {
        if (filePath != null) {
          useFileWatcherStore.getState().setFileWatchEnabled(filePath, true);
        }
      }
    },

    save: async () => {
      if (lineOperationsStorage == null) {
        return;
      }
      await lineOperationsStorage.saveNow();
    },

    setOnLinesChanged: (callback) => {
      lineOperationsStorage?.setOnLinesChanged(callback);
    },

    setOnSaved: (callback) => {
      lineOperationsStorage?.setOnSaved(callback);
    },
  }));
}

const registeredStores: MarkdownViewerHandleStore[] = [];

export class MarkdownViewerHandleStoreManager {
  static register(store: MarkdownViewerHandleStore): void {
    registeredStores.push(store);
  }

  static unregister(store: MarkdownViewerHandleStore): void {
    const index = registeredStores.lastIndexOf(store);
    if (index >= 0) {
      registeredStores.splice(index, 1);
    }
  }

  static getLatest(): MarkdownViewerHandleStore | null {
    return registeredStores[registeredStores.length - 1] ?? null;
  }

  static reset(): void {
    registeredStores.length = 0;
  }
}

/** Per-mount MarkdownViewer store; registers with the manager for palette access. */
export function useMarkdownViewerHandleStore(): MarkdownViewerHandleStore {
  const storeRef = useRef<MarkdownViewerHandleStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createMarkdownViewerHandleStore();
  }

  useEffect(() => {
    const store = storeRef.current!;
    MarkdownViewerHandleStoreManager.register(store);
    return () => {
      MarkdownViewerHandleStoreManager.unregister(store);
    };
  }, []);

  return storeRef.current;
}
