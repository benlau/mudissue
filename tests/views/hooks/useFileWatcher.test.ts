/**
 * @jest-environment jsdom
 */
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import { FileService } from "../../../src/services/FileService.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import { useFileWatcher } from "../../../src/views/hooks/useFileWatcher.ts";

describe("useFileWatcher", () => {
  let watchMock: jest.Mock;
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    resetFileWatcherStore();

    unsubscribeMock = jest.fn();
    watchMock = jest.fn().mockReturnValue(unsubscribeMock);
    FileService.setInstance({
      watch: watchMock,
    } as unknown as FileService);
  });

  afterEach(() => {
    act(() => {
      resetFileWatcherStore();
    });
    jest.useRealTimers();
    FileService.setInstance(new FileService());
    jest.restoreAllMocks();
  });

  it("invokes onReload when generation bumps", () => {
    const onReload = jest.fn();
    renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", { onReload }),
    );

    act(() => {
      useFileWatcherStore.getState().requestReload("/repo/issues/0001/issue.md");
    });

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onReload on mount at generation zero", () => {
    const onReload = jest.fn();
    renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", { onReload }),
    );

    expect(onReload).not.toHaveBeenCalled();
  });

  it("ignores requestReload when no watcher is registered", () => {
    const onReload = jest.fn();

    act(() => {
      useFileWatcherStore.getState().requestReload("/repo/issues/0001/issue.md");
    });

    expect(onReload).not.toHaveBeenCalled();
  });

  it("registers the path so FileWatcherStore starts watching", () => {
    renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", {
        onReload: jest.fn(),
      }),
    );

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(
      "/repo/issues/0001/issue.md",
      expect.any(Function),
    );
  });

  it("does not call FileService.watch itself", () => {
    // Store owns watching; the hook only registers. One watch call comes from
    // registerWatcher, not a second direct call from the hook.
    renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", {
        onReload: jest.fn(),
      }),
    );

    expect(watchMock).toHaveBeenCalledTimes(1);
  });

  it("skips registration when enabled is false", () => {
    renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", {
        onReload: jest.fn(),
        enabled: false,
      }),
    );

    expect(watchMock).not.toHaveBeenCalled();
  });

  it("unregisters on unmount so FileWatcherStore stops watching", () => {
    const { unmount } = renderHook(() =>
      useFileWatcher("/repo/issues/0001/issue.md", {
        onReload: jest.fn(),
      }),
    );

    unmount();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
