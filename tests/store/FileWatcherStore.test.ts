import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { SAVE_DEBOUNCE_MS } from "../../src/constants.ts";
import { FileService } from "../../src/services/FileService.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../src/store/FileWatcherStore.ts";

const FILE_PATH = "/repo/issues/0001/issue.md";

describe("useFileWatcherStore", () => {
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

    useFileWatcherStore.getState().registerWatcher(FILE_PATH);
  });

  afterEach(() => {
    jest.useRealTimers();
    resetFileWatcherStore();
    FileService.setInstance(new FileService());
  });

  it("registerWatcher starts FileService.watch for the path", () => {
    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(FILE_PATH, expect.any(Function));
  });

  it("unregisterWatcher tears down FileService.watch", () => {
    useFileWatcherStore.getState().unregisterWatcher(FILE_PATH);

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("requestReload bumps generation for a watched file path", () => {
    useFileWatcherStore.getState().requestReload(FILE_PATH);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("requestReload is ignored for an unwatched file path", () => {
    useFileWatcherStore.getState().requestReload("/repo/issues/0002/issue.md");

    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });

  it("requestReload cancels a pending deferReload and reloads immediately", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    useFileWatcherStore.getState().requestReload(FILE_PATH);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("deferReload reloads after SAVE_DEBOUNCE_MS", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(useFileWatcherStore.getState().generationByPath).toEqual({});

    jest.advanceTimersByTime(1);
    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("deferReload extends the timer when called again", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 50);
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(useFileWatcherStore.getState().generationByPath).toEqual({});

    jest.advanceTimersByTime(1);
    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("cancelReload reloads immediately when a deferReload is pending", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    useFileWatcherStore.getState().cancelReload(FILE_PATH);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("cancelReload does nothing when no deferReload is pending", () => {
    useFileWatcherStore.getState().cancelReload(FILE_PATH);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });

  it("unregisterWatcher clears deferred reload state for the path", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);
    useFileWatcherStore.getState().unregisterWatcher(FILE_PATH);

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });

  it("watch callback defers reload and bumps generation after debounce", () => {
    const watchCallback = watchMock.mock.calls[0]![1] as () => void;

    watchCallback();
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("setFileWatchEnabled(false) ignores watch events and clears pending defer", () => {
    useFileWatcherStore.getState().deferReload(FILE_PATH);
    useFileWatcherStore.getState().setFileWatchEnabled(FILE_PATH, false);

    const watchCallback = watchMock.mock.calls[0]![1] as () => void;
    watchCallback();
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });

  it("setFileWatchEnabled(true) allows later watch events to defer again", () => {
    useFileWatcherStore.getState().setFileWatchEnabled(FILE_PATH, false);
    useFileWatcherStore.getState().setFileWatchEnabled(FILE_PATH, true);

    const watchCallback = watchMock.mock.calls[0]![1] as () => void;
    watchCallback();
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("stopAllWatchers tears down every FileService.watch and clears deferred reloads", () => {
    const secondPath = "/repo/issues/0002/issue.md";
    const secondUnsubscribe = jest.fn();
    watchMock.mockReturnValueOnce(secondUnsubscribe);
    useFileWatcherStore.getState().registerWatcher(secondPath);
    useFileWatcherStore.getState().deferReload(FILE_PATH);

    useFileWatcherStore.getState().stopAllWatchers();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useFileWatcherStore.getState().generationByPath).toEqual({});
  });

  it("unregisterWatcher after stopAllWatchers is safe and does not re-watch", () => {
    useFileWatcherStore.getState().stopAllWatchers();
    watchMock.mockClear();

    useFileWatcherStore.getState().unregisterWatcher(FILE_PATH);

    expect(watchMock).not.toHaveBeenCalled();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("resumeWatchers restarts FileService.watch for still-registered paths", () => {
    useFileWatcherStore.getState().stopAllWatchers();
    const resumeUnsubscribe = jest.fn();
    watchMock.mockClear();
    watchMock.mockReturnValue(resumeUnsubscribe);

    useFileWatcherStore.getState().resumeWatchers();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(FILE_PATH, expect.any(Function));

    const watchCallback = watchMock.mock.calls[0]![1] as () => void;
    watchCallback();
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(useFileWatcherStore.getState().generationByPath).toEqual({
      [FILE_PATH]: 1,
    });
  });

  it("resumeWatchers called three times watches each registered path only once", () => {
    useFileWatcherStore.getState().stopAllWatchers();
    watchMock.mockClear();

    useFileWatcherStore.getState().resumeWatchers();
    useFileWatcherStore.getState().resumeWatchers();
    useFileWatcherStore.getState().resumeWatchers();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(FILE_PATH, expect.any(Function));
  });

  it("resumeWatchers without stopAllWatchers does not watch the path again", () => {
    watchMock.mockClear();

    useFileWatcherStore.getState().resumeWatchers();

    expect(watchMock).not.toHaveBeenCalled();
  });

  it("registerWatcher after stopAllWatchers starts watching a new path", () => {
    useFileWatcherStore.getState().stopAllWatchers();
    useFileWatcherStore.getState().unregisterWatcher(FILE_PATH);
    watchMock.mockClear();
    const newUnsubscribe = jest.fn();
    watchMock.mockReturnValue(newUnsubscribe);

    const newPath = "/repo/issues/0003/issue.md";
    useFileWatcherStore.getState().registerWatcher(newPath);

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(newPath, expect.any(Function));
  });
});
