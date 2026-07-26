import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { IntlProvider } from "react-intl";
import { ConfirmationDialog } from "../../../src/views/components/ConfirmationDialog.tsx";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function flushInkInput(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setImmediate(resolve);
  });
}

function openCtrlCConfirmationDialog(): void {
  usePopupStore.getState().pushPopup(PopupNames.ConfirmationDialog);
  useConfirmationDialogStore.setState({
    isDialogOpen: true,
    title: "Quit MudIssue?",
    message: "Press Ctrl+C or Enter to quit. Press any other key to cancel.",
    confirmLabel: "Quit",
    variant: "destructive",
    ctrlCToConfirm: true,
    cancelDisabled: false,
    pendingResolve: null,
  });
}

function openCancelDisabledConfirmationDialog(): void {
  usePopupStore.getState().pushPopup(PopupNames.ConfirmationDialog);
  useConfirmationDialogStore.setState({
    isDialogOpen: true,
    title: "File not found",
    message: "The file was not present. Go back to the previous page?",
    confirmLabel: "Go Back",
    variant: "default",
    ctrlCToConfirm: false,
    cancelDisabled: true,
    pendingResolve: null,
  });
}

describe("ConfirmationDialog", () => {
  beforeEach(() => {
    useConfirmationDialogStore.setState({
      isDialogOpen: false,
      title: "",
      message: "",
      confirmLabel: undefined,
      variant: "default",
      ctrlCToConfirm: false,
      cancelDisabled: false,
      pendingResolve: null,
      activeOpenPromise: null,
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  afterEach(() => {
    act(() => {
      cleanup();
    });
  });

  it("confirms on Ctrl+C when ctrlCToConfirm is true", () => {
    const confirm = jest.fn();
    useConfirmationDialogStore.setState({ confirm });

    openCtrlCConfirmationDialog();

    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>,
      );
    });

    act(() => {
      view!.stdin.write("\x03");
    });

    expect(confirm).toHaveBeenCalled();
  });

  it("confirms on Enter via toolbar when ctrlCToConfirm is true", () => {
    const confirm = jest.fn();
    useConfirmationDialogStore.setState({ confirm });

    openCtrlCConfirmationDialog();

    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>,
      );
    });

    act(() => {
      view!.stdin.write("\r");
    });

    expect(confirm).toHaveBeenCalled();
  });

  it("cancels on Esc when ctrlCToConfirm is true", async () => {
    const close = jest.fn();
    useConfirmationDialogStore.setState({ close });

    openCtrlCConfirmationDialog();

    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>,
      );
    });

    act(() => {
      view!.stdin.write(AnsiEscapeCode.ESC);
    });
    await act(async () => {
      await flushInkInput();
    });

    expect(close).toHaveBeenCalled();
  });

  it("hides Cancel and ignores Esc when cancelDisabled is true", async () => {
    const close = jest.fn();
    const confirm = jest.fn();
    useConfirmationDialogStore.setState({ close, confirm });

    openCancelDisabledConfirmationDialog();

    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <IntlProvider locale="en" messages={{}}>
          <ConfirmationDialog />
        </IntlProvider>,
      );
    });

    act(() => {
      view!.stdin.write(AnsiEscapeCode.ESC);
    });
    await act(async () => {
      await flushInkInput();
    });

    expect(close).not.toHaveBeenCalled();

    act(() => {
      view!.stdin.write("\r");
    });
    await act(async () => {
      await flushInkInput();
    });

    expect(confirm).toHaveBeenCalled();
  });
});
