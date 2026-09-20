import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import {
  resolveDefaultItemIndex,
  ScriptPickItemView,
} from "../../../src/views/components/ScriptPickItemView.tsx";
import {
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function resetPickItemDialogStore(): void {
  usePickItemDialogStore.setState({
    isDialogOpen: false,
    items: [],
    getDisplay: String,
    title: "Select item",
    columns: [],
    footerLabel: "Cancel<Esc>",
    minWidth: 52,
    maxWidth: 86,
    geom: {
      dialogWidth: 0,
      contentWidth: 0,
      columnWidths: [],
      tableWidth: 0,
    },
    displayRows: [],
    initialSelectedIndex: 0,
    pendingResolve: null,
  });
}

function resetPopupStore(): void {
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
}

describe("resolveDefaultItemIndex", () => {
  it("returns matching index when default is present", () => {
    expect(resolveDefaultItemIndex(["123", "456", "789"], "456")).toBe(1);
  });

  it("returns 0 when default is missing or unknown", () => {
    expect(resolveDefaultItemIndex(["123", "456"], undefined)).toBe(0);
    expect(resolveDefaultItemIndex(["123", "456"], "999")).toBe(0);
  });
});

describe("ScriptPickItemView", () => {
  let stderrWriteSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    resetPickItemDialogStore();
    resetPopupStore();
    stderrWriteSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    act(() => {
      cleanup();
    });
    stderrWriteSpy.mockRestore();
    resetPickItemDialogStore();
    resetPopupStore();
  });

  it("enters alternate screen and opens PickItemDialog", async () => {
    const onSelect = jest.fn();
    await act(async () => {
      render(
        <ScriptPickItemView
          title="Select item"
          items={["123", "456"]}
          defaultItem="456"
          onSelect={onSelect}
        />,
      );
      await Promise.resolve();
    });

    expect(stderrWriteSpy).toHaveBeenCalledWith(
      AnsiEscapeCode.ENTER_ALTERNATE_SCREEN,
    );
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.PickItemDialog,
    );
    expect(usePickItemDialogStore.getState()).toMatchObject({
      isDialogOpen: true,
      title: "Select item",
      items: ["123", "456"],
      initialSelectedIndex: 1,
    });
  });

  it("resolves onSelect with the accepted item", async () => {
    const onSelect = jest.fn();
    await act(async () => {
      render(
        <ScriptPickItemView
          title="Select item"
          items={["123", "456"]}
          onSelect={onSelect}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      usePickItemDialogStore.getState().confirm(1);
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledWith("456");
  });

  it("resolves onSelect with null when cancelled", async () => {
    const onSelect = jest.fn();
    await act(async () => {
      render(
        <ScriptPickItemView
          title="Select item"
          items={["123", "456"]}
          onSelect={onSelect}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      usePickItemDialogStore.getState().close();
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("exits alternate screen on unmount", async () => {
    const onSelect = jest.fn();
    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ScriptPickItemView
          title="Select item"
          items={["123"]}
          onSelect={onSelect}
        />,
      );
      await Promise.resolve();
    });

    act(() => {
      view!.unmount();
    });

    expect(stderrWriteSpy).toHaveBeenCalledWith(
      AnsiEscapeCode.EXIT_ALTERNATE_SCREEN,
    );
  });
});
