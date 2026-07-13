/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import {
  bigDialogLayout,
  mediumDialogLayout,
  useDialogLayout,
  type DialogLayoutInput,
} from "../../../src/views/hooks/useDialogLayout.ts";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";

const PALETTE_MIN_WIDTH = 62;
const HELP_DIALOG_MIN_WIDTH = 62;

function palettePreferredWidth(screen: { cols: number }): number {
  return Math.max(PALETTE_MIN_WIDTH, Math.floor(screen.cols * 0.8));
}

function toolbarHelpPreferredWidth(screen: { cols: number }): number {
  return Math.min(HELP_DIALOG_MIN_WIDTH, Math.max(40, screen.cols));
}

function layoutFor(
  input: DialogLayoutInput,
  screen: { cols: number; rows: number },
) {
  act(() => {
    useTerminalSizeStore.setState(screen);
  });
  const { result } = renderHook(() => useDialogLayout(input));
  return result.current;
}

describe("useDialogLayout", () => {
  it("centers a fixed-size dialog when max width and height are omitted", () => {
    const input: DialogLayoutInput = { minWidth: 44, minHeight: 5 };
    const layout = layoutFor(input, { cols: 80, rows: 24 });

    expect(layout).toEqual({
      width: 44,
      height: 5,
      left: 18,
      top: 9,
      right: 18,
      bottom: 10,
    });
  });

  it("keeps fixed size on a narrow terminal and clamps margins to zero", () => {
    const layout = layoutFor(
      { minWidth: 44, minHeight: 5 },
      { cols: 20, rows: 8 },
    );

    expect(layout.width).toBe(44);
    expect(layout.height).toBe(5);
    expect(layout.left).toBe(0);
    expect(layout.top).toBe(1);
    expect(layout.right).toBe(0);
    expect(layout.bottom).toBe(2);
  });

  it("applies palette-style responsive width", () => {
    expect(
      layoutFor(
        { minWidth: PALETTE_MIN_WIDTH, maxWidth: palettePreferredWidth, minHeight: 10 },
        { cols: 100, rows: 30 },
      ).width,
    ).toBe(80);

    expect(
      layoutFor(
        { minWidth: PALETTE_MIN_WIDTH, maxWidth: palettePreferredWidth, minHeight: 10 },
        { cols: 50, rows: 20 },
      ).width,
    ).toBe(50);
  });

  it("applies toolbar help shrink width", () => {
    expect(
      layoutFor(
        {
          minWidth: HELP_DIALOG_MIN_WIDTH,
          maxWidth: toolbarHelpPreferredWidth,
          minHeight: 8,
        },
        { cols: 100, rows: 24 },
      ).width,
    ).toBe(62);

    expect(
      layoutFor(
        {
          minWidth: HELP_DIALOG_MIN_WIDTH,
          maxWidth: toolbarHelpPreferredWidth,
          minHeight: 8,
        },
        { cols: 50, rows: 24 },
      ).width,
    ).toBe(50);
  });

  it("uses equal min and max height for content-driven dialogs", () => {
    const layout = layoutFor(
      { minWidth: 52, minHeight: 12, maxHeight: 12 },
      { cols: 80, rows: 24 },
    );

    expect(layout.height).toBe(12);
    expect(layout.top).toBe(6);
    expect(layout.bottom).toBe(6);
  });

  it("clamps pick-item width from a numeric maxWidth", () => {
    const layout = layoutFor(
      { minWidth: 52, maxWidth: 70, minHeight: 8, maxHeight: 8 },
      { cols: 100, rows: 24 },
    );

    expect(layout.width).toBe(70);
    expect(layout.left).toBe(15);
    expect(layout.right).toBe(15);
  });

  it("shrinks content height to the terminal when maxHeight is set", () => {
    const layout = layoutFor(
      { minWidth: 40, minHeight: 20, maxHeight: 20 },
      { cols: 80, rows: 12 },
    );

    expect(layout.height).toBe(12);
    expect(layout.top).toBe(0);
    expect(layout.bottom).toBe(0);
  });
});

describe("bigDialogLayout", () => {
  it("sizes a typical terminal at 80% width with vertical margin", () => {
    const layout = layoutFor(bigDialogLayout, { cols: 80, rows: 24 });

    expect(layout).toEqual({
      width: 64,
      height: 20,
      left: 8,
      top: 2,
      right: 8,
      bottom: 2,
    });
  });

  it("caps width at 80 on very wide terminals", () => {
    expect(layoutFor(bigDialogLayout, { cols: 120, rows: 24 }).width).toBe(80);
  });

  it("clamps height on short terminals", () => {
    const layout = layoutFor(bigDialogLayout, { cols: 80, rows: 8 });

    expect(layout.height).toBe(6);
    expect(layout.top).toBe(1);
    expect(layout.bottom).toBe(1);
  });
});

describe("mediumDialogLayout", () => {
  it("sizes a typical terminal to max width and height", () => {
    const layout = layoutFor(mediumDialogLayout, { cols: 80, rows: 24 });

    expect(layout).toEqual({
      width: 56,
      height: 20,
      left: 12,
      top: 2,
      right: 12,
      bottom: 2,
    });
  });

  it("clamps width on narrow terminals", () => {
    const layout = layoutFor(mediumDialogLayout, { cols: 40, rows: 24 });

    expect(layout.width).toBe(40);
    expect(layout.left).toBe(0);
    expect(layout.right).toBe(0);
  });

  it("clamps height on short terminals", () => {
    const layout = layoutFor(mediumDialogLayout, { cols: 80, rows: 12 });

    expect(layout.height).toBe(12);
    expect(layout.top).toBe(0);
    expect(layout.bottom).toBe(0);
  });
});
