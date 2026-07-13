/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { FileService } from "../../src/services/FileService.ts";
import {
  createMarkdownViewerHandleStore,
  MarkdownViewerHandleStoreManager,
  useMarkdownViewerHandleStore,
} from "../../src/store/MarkdownViewerHandleStore.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../src/store/FileWatcherStore.ts";
import { createMockFileService } from "../fixture/MockServiceContext.tsx";

const ISSUE_PATH = "/tmp/issue.md";

describe("MarkdownViewerHandleStore", () => {
  afterEach(() => {
    MarkdownViewerHandleStoreManager.reset();
    resetFileWatcherStore();
    FileService.setInstance(new FileService());
    jest.restoreAllMocks();
  });

  it("stores content via setContent", () => {
    const store = createMarkdownViewerHandleStore();

    store.getState().setContent({
      content: "line-a\nline-b",
      logicalLineIndex: 1,
    });

    expect(store.getState().content).toEqual("line-a\nline-b");
    expect(store.getState().selectedLogicalLineIndex).toBe(1);
    expect(store.getState().selectionAnchorLogicalLineIndex).toBeNull();
  });

  it("toggles selection mode over logical line ranges", () => {
    const store = createMarkdownViewerHandleStore();
    store.getState().setContent({ content: "line-a\nline-b\nline-c\nline-d" });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    store.getState().setCursor(3, 0, 3);

    expect(store.getState().getSelectedLogicalLineRange()).toEqual({
      start: 1,
      end: 3,
    });
    expect(store.getState().getSelectedContent()).toEqual(
      "line-b\nline-c\nline-d",
    );

    store.getState().toggleSelectionMode();
    expect(store.getState().selectionAnchorLogicalLineIndex).toBeNull();
    expect(store.getState().getSelectedContent()).toBeNull();
  });

  it("replaces the selected logical lines and clears selection", () => {
    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath(ISSUE_PATH);
    store
      .getState()
      .setContent({ content: "keep-a\ncut-b\ncut-c\nkeep-d" });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    store.getState().setCursor(2, 0, 2);

    const replaced = store
      .getState()
      .replaceSelection("[[MI0002-new-issue]]");

    expect(replaced).toEqual("cut-b\ncut-c");
    expect(store.getState().content).toEqual(
      "keep-a\n[[MI0002-new-issue]]\nkeep-d",
    );
    expect(store.getState().selectionAnchorLogicalLineIndex).toBeNull();
    expect(store.getState().selectedLogicalLineIndex).toBe(1);
  });

  it("saves through the file-path line operations storage", async () => {
    const mockFileService = createMockFileService();
    mockFileService.writeFile.mockResolvedValue(undefined);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-07-07T00:00:00Z"),
    } as never);
    FileService.setInstance(mockFileService as unknown as FileService);

    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath(ISSUE_PATH);
    store.getState().setContent({ content: "hello" });
    store.getState().setCursor(0, 0, 0);
    store.getState().toggleSelectionMode();
    store.getState().replaceSelection("hello-saved");

    await store.getState().save();

    expect(mockFileService.writeFile).toHaveBeenCalledWith(
      ISSUE_PATH,
      "hello-saved",
      "utf-8",
    );
  });

  it("pauses file watching while toggling a checkbox and writing", async () => {
    const mockFileService = createMockFileService();
    mockFileService.writeFile.mockResolvedValue(undefined);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-07-07T00:00:00Z"),
    } as never);
    FileService.setInstance(mockFileService as unknown as FileService);

    resetFileWatcherStore();
    useFileWatcherStore.getState().registerWatcher(ISSUE_PATH);

    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath(ISSUE_PATH);
    store.getState().setContent({ content: "- [ ] Task" });
    store.getState().setOnLinesChanged((lines) => {
      store.getState().updateContent(lines.join("\n"));
    });

    const setEnabledSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "setFileWatchEnabled",
    );

    await store.getState().toggleCheckboxAtLine(0);

    expect(setEnabledSpy.mock.calls).toEqual([
      [ISSUE_PATH, false],
      [ISSUE_PATH, true],
    ]);
    expect(store.getState().content).toEqual("- [x] Task");
    expect(mockFileService.writeFile).toHaveBeenCalledWith(
      ISSUE_PATH,
      "- [x] Task",
      "utf-8",
    );
    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });
});

describe("MarkdownViewerHandleStoreManager", () => {
  afterEach(() => {
    MarkdownViewerHandleStoreManager.reset();
  });

  it("returns the latest registered store and unregisters on demand", () => {
    const first = createMarkdownViewerHandleStore();
    const second = createMarkdownViewerHandleStore();

    MarkdownViewerHandleStoreManager.register(first);
    expect(MarkdownViewerHandleStoreManager.getLatest()).toBe(first);

    MarkdownViewerHandleStoreManager.register(second);
    expect(MarkdownViewerHandleStoreManager.getLatest()).toBe(second);

    MarkdownViewerHandleStoreManager.unregister(second);
    expect(MarkdownViewerHandleStoreManager.getLatest()).toBe(first);

    MarkdownViewerHandleStoreManager.unregister(first);
    expect(MarkdownViewerHandleStoreManager.getLatest()).toBeNull();
  });
});

describe("useMarkdownViewerHandleStore", () => {
  afterEach(() => {
    MarkdownViewerHandleStoreManager.reset();
  });

  it("registers the store on mount and unregisters on unmount", () => {
    const { result, unmount } = renderHook(() => useMarkdownViewerHandleStore());

    expect(MarkdownViewerHandleStoreManager.getLatest()).toBe(result.current);

    unmount();

    expect(MarkdownViewerHandleStoreManager.getLatest()).toBeNull();
  });
});
