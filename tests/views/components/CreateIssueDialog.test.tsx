/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { IntlProvider } from "react-intl";
import { renderHook } from "@testing-library/react";
import {
  CreateIssueDialog,
  createIssueDialogInputHeight,
  deriveIssueTitleFromText,
  splitIssueText,
  useCreateIssueDialogState,
} from "../../../src/views/components/CreateIssueDialog.tsx";
import { ConfirmationDialog } from "../../../src/views/components/ConfirmationDialog.tsx";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import { useCreateIssueDialogStore } from "../../../src/store/CreateIssueDialogStore.ts";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";
import { CreateIssueHelper } from "../../../src/helpers/CreateIssueHelper.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";
import {
  bigDialogLayout,
  useDialogLayout,
} from "../../../src/views/hooks/useDialogLayout.ts";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function installInkTimerPolyfills(): void {
  if (globalThis.setImmediate == null) {
    globalThis.setImmediate = ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      globalThis.setTimeout(fn, 0, ...args)) as typeof setImmediate;
  }
  if (globalThis.clearImmediate == null) {
    globalThis.clearImmediate = ((handle: ReturnType<typeof setTimeout>) => {
      globalThis.clearTimeout(handle);
    }) as typeof clearImmediate;
  }
}

function flushInkInput(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setImmediate(resolve);
  });
}

function resetConfirmationDialogStore(): void {
  useConfirmationDialogStore.setState(
    useConfirmationDialogStore.getInitialState(),
    true,
  );
}

function resetCreateIssueDialogStores(): void {
  useCreateIssueDialogStore.setState({
    isDialogOpen: false,
    openSession: 0,
    parentIssue: null,
  });
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
  resetConfirmationDialogStore();
  useTerminalSizeStore.setState({ cols: 80, rows: 24 });
}

function renderOpenCreateIssueDialog(): ReturnType<typeof render> {
  useCreateIssueDialogStore.getState().open();
  let view!: ReturnType<typeof render>;
  act(() => {
    view = render(
      <IntlProvider locale="en" messages={{}}>
        <CreateIssueDialog />
        <ConfirmationDialog />
      </IntlProvider>,
    );
  });
  return view;
}

describe("CreateIssueDialog", () => {
  beforeEach(() => {
    installInkTimerPolyfills();
    resetCreateIssueDialogStores();
  });

  afterEach(() => {
    act(() => {
      cleanup();
    });
  });

  it("closes immediately on Esc when the draft is empty", async () => {
    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });

    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(false);
    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
  });

  it("closes immediately on Esc when the draft is whitespace-only", async () => {
    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write("   \n ");
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });

    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(false);
    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
  });

  it("opens discard confirmation on Esc when the draft has content", async () => {
    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write("draft title");
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });

    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(true);
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(true);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.ConfirmationDialog,
    );
  });

  it("keeps the create dialog open when discard confirmation is cancelled", async () => {
    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write("draft title");
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });

    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(true);
  });

  it("closes the create dialog when discard confirmation is accepted", async () => {
    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write("draft title");
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write("\r");
      await flushInkInput();
    });

    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(false);
  });

  it("submits on Ctrl+D when draft has a title", async () => {
    const createIssueSpy = jest
      .spyOn(CreateIssueHelper.prototype, "createIssue")
      .mockResolvedValue({} as IssueFolder);

    const view = renderOpenCreateIssueDialog();

    await act(async () => {
      view.stdin.write("My title");
      await flushInkInput();
    });
    await act(async () => {
      view.stdin.write("\x04");
      await flushInkInput();
    });

    expect(createIssueSpy).toHaveBeenCalledWith(
      "My title",
      undefined,
      undefined,
    );
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(false);

    createIssueSpy.mockRestore();
  });
});

describe("createIssueDialogInputHeight", () => {
  it("reserves border, error, and footer rows from dialog height", () => {
    expect(createIssueDialogInputHeight(19)).toBe(15);
    expect(createIssueDialogInputHeight(6)).toBe(2);
  });
});

describe("useDialogLayout with bigDialogLayout", () => {
  it("derives input height and width from the resolved dialog layout", () => {
    act(() => {
      useTerminalSizeStore.setState({ cols: 80, rows: 24 });
    });
    const layout = renderHook(() => useDialogLayout(bigDialogLayout)).result
      .current;

    expect(layout).toEqual({
      width: 64,
      height: 20,
      left: 8,
      top: 2,
      right: 8,
      bottom: 2,
    });
    expect(createIssueDialogInputHeight(layout.height)).toBe(16);
    expect(Math.max(4, layout.width - 4)).toBe(60);
  });
});

describe("deriveIssueTitleFromText", () => {
  it("returns the first non-empty line trimmed", () => {
    expect(deriveIssueTitleFromText("\n  My title \nbody")).toBe("My title");
  });

  it("returns empty string when all lines are blank", () => {
    expect(deriveIssueTitleFromText("\n \n")).toBe("");
  });
});

describe("splitIssueText", () => {
  it("splits title and body after the first non-empty line", () => {
    expect(splitIssueText("Title\n\nBody line")).toEqual({
      title: "Title",
      body: "\nBody line",
    });
  });

  it("returns title only when there is no body", () => {
    expect(splitIssueText("Only title")).toEqual({ title: "Only title" });
  });
});

describe("useCreateIssueDialogState", () => {
  it("runs createIssue once when handleSubmit is called twice synchronously during a blocking create", async () => {
    const onCreate = jest.fn(async () => {
      await new Promise<void>(() => {});
    });
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useCreateIssueDialogState({
        isOpen: true,
        onCreate,
        onSuccess,
      }),
    );

    await act(async () => {
      void result.current.handleSubmit("first");
      void result.current.handleSubmit("second");
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("first", undefined);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("passes body text after the title line to onCreate", async () => {
    const onCreate = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      useCreateIssueDialogState({
        isOpen: true,
        onCreate,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit("Title\nBody");
    });

    expect(onCreate).toHaveBeenCalledWith("Title", "Body");
  });

  it("does not call onCreate when title is empty", async () => {
    const onCreate = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      useCreateIssueDialogState({
        isOpen: true,
        onCreate,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit("\n\n");
    });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("sets isSubmitting after submit starts until create hangs", async () => {
    const onCreate = jest.fn(async () => {
      await new Promise<void>(() => {});
    });

    const { result } = renderHook(() =>
      useCreateIssueDialogState({
        isOpen: true,
        onCreate,
      }),
    );

    await act(async () => {
      void result.current.handleSubmit("x");
    });

    expect(result.current.isSubmitting).toBe(true);
  });

  it("clears submitting and sets error after createIssue rejects, then allows retry", async () => {
    const onCreate = jest
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useCreateIssueDialogState({
        isOpen: true,
        onCreate,
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit("one");
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe("boom");

    await act(async () => {
      await result.current.handleSubmit("two");
    });

    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreate).toHaveBeenNthCalledWith(1, "one", undefined);
    expect(onCreate).toHaveBeenNthCalledWith(2, "two", undefined);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("clears submitting when isOpen becomes false even if create never finishes", async () => {
    const onCreate = jest.fn(async () => {
      await new Promise<void>(() => {});
    });

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useCreateIssueDialogState({
          isOpen: open,
          onCreate,
        }),
      { initialProps: { open: true } },
    );

    await act(async () => {
      void result.current.handleSubmit("a");
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      rerender({ open: false });
    });
    await act(async () => {
      rerender({ open: true });
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.text).toBe("");
  });
});
