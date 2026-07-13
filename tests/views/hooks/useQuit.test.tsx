import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { useQuit } from "../../../src/views/hooks/useQuit.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";
import { resetAppStore } from "../../../src/store/AppStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("useQuit", () => {
  let quitApi: ReturnType<typeof useQuit>;

  function Harness() {
    quitApi = useQuit();
    return null;
  }

  beforeEach(() => {
    resetAppStore();
    useConfirmationDialogStore.setState({
      isDialogOpen: false,
      title: "",
      message: "",
      confirmLabel: undefined,
      variant: "default",
      ctrlCToConfirm: false,
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

  it("requestQuit opens destructive quit dialog with ctrlCToConfirm", async () => {
    act(() => {
      render(<Harness />);
    });

    let accepted = false;
    await act(async () => {
      const pending = quitApi.requestQuit();
      expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(true);
      expect(useConfirmationDialogStore.getState().variant).toBe("destructive");
      expect(useConfirmationDialogStore.getState().ctrlCToConfirm).toBe(true);
      expect(usePopupStore.getState().latestPopup).toBe(
        PopupNames.ConfirmationDialog,
      );
      useConfirmationDialogStore.getState().confirm();
      accepted = await pending;
    });

    expect(accepted).toBe(true);
  });

  it("requestQuit resolves false when quit is cancelled", async () => {
    act(() => {
      render(<Harness />);
    });

    let accepted = true;
    await act(async () => {
      const pending = quitApi.requestQuit();
      useConfirmationDialogStore.getState().close();
      accepted = await pending;
    });

    expect(accepted).toBe(false);
  });
});
