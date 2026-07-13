import React, { act } from "react";
import { IntlProvider } from "react-intl";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { FileService } from "../../../src/services/FileService.ts";
import { createMockFileService } from "../../fixture/MockServiceContext.tsx";
import {
  PopupNames,
  usePopupStore,
} from "../../../src/store/PopupStore.ts";
import { useTextEditDialogStore } from "../../../src/store/TextEditDialogStore.ts";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";
import {
  TextEditDialog,
  textEditDialogInputHeight,
} from "../../../src/views/components/TextEditDialog.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ISSUE_PATH = "/repo/issues/MI0001-demo/MI0001-demo.md";
const FILE_BODY = "hello";
import { SAVE_DEBOUNCE_MS } from "../../../src/constants.ts";
const RELOAD_SUPPRESS_AFTER_SAVE_MS = 500;
const WATCH_DEBOUNCE_MS = 150;

describe("textEditDialogInputHeight", () => {
  it("reserves border and footer rows from dialog height", () => {
    expect(textEditDialogInputHeight(20)).toBe(17);
    expect(textEditDialogInputHeight(6)).toBe(3);
  });
});

describe("TextEditDialog", () => {
  let watchCallback: (() => void) | undefined;
  let mockFileService: ReturnType<typeof createMockFileService>;

  beforeEach(() => {
    jest.useFakeTimers();
    watchCallback = undefined;
    useTerminalSizeStore.setState({ cols: 80, rows: 24 });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    useTextEditDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      filePath: null,
      initialLineIndex: 0,
      pendingResolve: null,
    });

    mockFileService = createMockFileService();
    mockFileService.readFile.mockResolvedValue(FILE_BODY);
    mockFileService.writeFile.mockResolvedValue(undefined);
    mockFileService.watch.mockImplementation((_path, cb) => {
      watchCallback = cb as () => void;
      return jest.fn();
    });
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    FileService.setInstance(new FileService());
    act(() => {
      cleanup();
    });
    jest.useRealTimers();
  });

  it("does not reload from disk while save suppression window is active", async () => {
    void useTextEditDialogStore.getState().open({ filePath: ISSUE_PATH });

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <TextEditDialog />
        </IntlProvider>
      );
      await Promise.resolve();
    });

    const readCountAfterLoad = mockFileService.readFile.mock.calls.length;
    expect(readCountAfterLoad).toBeGreaterThan(0);

    await act(async () => {
      view!.stdin.write("x");
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    });

    expect(mockFileService.writeFile).toHaveBeenCalled();

    await act(async () => {
      watchCallback?.();
      await jest.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
    });

    expect(mockFileService.readFile.mock.calls.length).toBe(readCountAfterLoad);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(RELOAD_SUPPRESS_AFTER_SAVE_MS);
    });

    mockFileService.readFile.mockResolvedValue("updated content");

    await act(async () => {
      watchCallback?.();
      await jest.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(mockFileService.readFile.mock.calls.length).toBeGreaterThan(
      readCountAfterLoad,
    );

    await act(async () => {
      useTextEditDialogStore.getState().close({
        lastUpdatedTimestamp: null,
        lastLogicalLineIndex: 0,
      });
    });
  });

  it("resolves open with the logical line index of the cursor on close", async () => {
    mockFileService.readFile.mockResolvedValue("line one\nline two\nline three");

    const openPromise = useTextEditDialogStore.getState().open({
      filePath: ISSUE_PATH,
      initialLineIndex: 0,
    });
    usePopupStore.setState({
      popupStack: [PopupNames.TextEditDialog],
      hasPopup: true,
      latestPopup: PopupNames.TextEditDialog,
    });

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <TextEditDialog />
        </IntlProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      view!.stdin.write("\x1b[B");
      view!.stdin.write("\x1b[B");
    });

    await act(async () => {
      view!.stdin.write("\x1b");
      await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await expect(openPromise).resolves.toEqual({
      lastUpdatedTimestamp: null,
      lastLogicalLineIndex: 2,
    });
  });
});
