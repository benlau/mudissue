import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { FileService } from "../../../src/services/FileService.ts";
import { SAVE_DEBOUNCE_MS } from "../../../src/constants.ts";
import {
  MarkdownLineOperationsStorage,
} from "../../../src/utils/storage/MarkdownLineOperationsStorage.ts";
import { createMockFileService } from "../../fixture/MockServiceContext.tsx";

const ISSUE_PATH = "/repo/issues/MI0001-demo/MI0001-demo.md";

afterEach(() => {
  FileService.setInstance(new FileService());
  jest.useRealTimers();
});

describe("MarkdownLineOperationsStorage", () => {
  let mockFileService: ReturnType<typeof createMockFileService>;

  beforeEach(() => {
    mockFileService = createMockFileService();
    mockFileService.writeFile.mockResolvedValue(undefined);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-07-07T00:00:00Z"),
    } as never);
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  it("mutates lines when toggling a checkbox", async () => {
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["- [ ] Task"]);

    await storage.toggleCheckboxAtLine(0);

    expect(storage.getLines()).toEqual(["- [x] Task"]);
  });

  it("notifies listeners when lines change from a toggle", async () => {
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["- [ ] Task"]);
    const onLinesChanged = jest.fn();
    storage.setOnLinesChanged(onLinesChanged);

    await storage.toggleCheckboxAtLine(0);

    expect(onLinesChanged).toHaveBeenCalledWith(["- [x] Task"]);
  });

  it("debounces save to disk after a toggle", async () => {
    jest.useFakeTimers();
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["- [ ] Task"]);

    await storage.toggleCheckboxAtLine(0);

    expect(mockFileService.writeFile).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(mockFileService.writeFile).toHaveBeenCalledWith(
      ISSUE_PATH,
      "- [x] Task",
      "utf-8",
    );
  });

  it("flushes a pending save immediately with saveNow", async () => {
    jest.useFakeTimers();
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["- [ ] Task"]);

    await storage.toggleCheckboxAtLine(0);
    await storage.saveNow();

    expect(mockFileService.writeFile).toHaveBeenCalledWith(
      ISSUE_PATH,
      "- [x] Task",
      "utf-8",
    );
  });

  it("suppresses reload shortly after a local mutation", async () => {
    jest.useFakeTimers();
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["- [ ] Task"]);

    expect(storage.shouldSuppressReload()).toBe(false);

    await storage.toggleCheckboxAtLine(0);

    expect(storage.shouldSuppressReload()).toBe(true);
  });

  it("cuts an inclusive logical line range and notifies listeners", () => {
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["a", "b", "c", "d"]);
    const onLinesChanged = jest.fn();
    storage.setOnLinesChanged(onLinesChanged);

    const cut = storage.cutLineRange({ start: 1, end: 2 });

    expect(cut).toEqual(["b", "c"]);
    expect(storage.getLines()).toEqual(["a", "d"]);
    expect(onLinesChanged).toHaveBeenCalledWith(["a", "d"]);
  });

  it("replaces an inclusive logical line range with new lines", () => {
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["a", "b", "c", "d"]);
    const onLinesChanged = jest.fn();
    storage.setOnLinesChanged(onLinesChanged);

    const replaced = storage.replaceLineRange({ start: 1, end: 2 }, [
      "[[MI0002-new-issue]]",
    ]);

    expect(replaced).toEqual(["b", "c"]);
    expect(storage.getLines()).toEqual(["a", "[[MI0002-new-issue]]", "d"]);
    expect(onLinesChanged).toHaveBeenCalledWith([
      "a",
      "[[MI0002-new-issue]]",
      "d",
    ]);
  });

  it("leaves a single empty line when cutting the entire file", () => {
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["only", "lines"]);

    const cut = storage.cutLineRange({ start: 0, end: 1 });

    expect(cut).toEqual(["only", "lines"]);
    expect(storage.getLines()).toEqual([""]);
  });

  it("schedules a save after cutting a line range", async () => {
    jest.useFakeTimers();
    const storage = new MarkdownLineOperationsStorage(ISSUE_PATH);
    storage.setLines(["a", "b", "c"]);

    storage.cutLineRange({ start: 1, end: 1 });

    expect(mockFileService.writeFile).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(mockFileService.writeFile).toHaveBeenCalledWith(
      ISSUE_PATH,
      "a\nc",
      "utf-8",
    );
  });
});
