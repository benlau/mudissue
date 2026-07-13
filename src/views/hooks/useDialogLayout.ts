import { useMemo } from "react";
import { clamp } from "../../types/maths.ts";
import { useTerminalSize } from "./useTerminal.ts";

export type DialogDimension = number | ((screen: TerminalDimensions) => number);

export type DialogLayoutInput = {
  minWidth: number;
  maxWidth?: DialogDimension;
  minHeight: number;
  maxHeight?: DialogDimension;
};

export type DialogLayoutResult = {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type TerminalDimensions = {
  cols: number;
  rows: number;
};

const BIG_MIN_DIALOG_WIDTH = 20;
const BIG_MIN_DIALOG_HEIGHT = 6;
const BIG_MAX_DIALOG_WIDTH = 80;
const BIG_MAX_DIALOG_PREFERRED_WIDTH_RATIO = 0.8;
const BIG_MAX_DIALOG_HEIGHT_MARGIN = 2;

const MEDIUM_MIN_DIALOG_WIDTH = 20;
const MEDIUM_MAX_DIALOG_WIDTH = 56;
const MEDIUM_MIN_DIALOG_HEIGHT = 7;
const MEDIUM_MAX_DIALOG_HEIGHT = 20;

export const bigDialogLayout: DialogLayoutInput = {
  minWidth: BIG_MIN_DIALOG_WIDTH,
  maxWidth: (screen) =>
    Math.min(
      BIG_MAX_DIALOG_WIDTH,
      Math.floor(BIG_MAX_DIALOG_PREFERRED_WIDTH_RATIO * screen.cols),
    ),
  minHeight: BIG_MIN_DIALOG_HEIGHT,
  maxHeight: (screen) => screen.rows - BIG_MAX_DIALOG_HEIGHT_MARGIN * 2,
};

export const mediumDialogLayout: DialogLayoutInput = {
  minWidth: MEDIUM_MIN_DIALOG_WIDTH,
  maxWidth: MEDIUM_MAX_DIALOG_WIDTH,
  minHeight: MEDIUM_MIN_DIALOG_HEIGHT,
  maxHeight: MEDIUM_MAX_DIALOG_HEIGHT,
};

function resolveDimension(
  dimension: DialogDimension | undefined,
  screen: TerminalDimensions,
): number | undefined {
  if (dimension === undefined) {
    return undefined;
  }
  return typeof dimension === "function" ? dimension(screen) : dimension;
}

function computeDialogLayout(
  input: DialogLayoutInput,
  screen: TerminalDimensions,
): DialogLayoutResult {
  const resolvedMaxWidth = resolveDimension(input.maxWidth, screen);
  const width =
    resolvedMaxWidth === undefined
      ? input.minWidth
      : Math.min(
          screen.cols,
          clamp(
            screen.cols,
            input.minWidth,
            Math.max(input.minWidth, resolvedMaxWidth),
          ),
        );

  const resolvedMaxHeight = resolveDimension(input.maxHeight, screen);
  const height =
    resolvedMaxHeight === undefined
      ? input.minHeight
      : Math.min(
          screen.rows,
          clamp(
            screen.rows,
            input.minHeight,
            Math.max(input.minHeight, resolvedMaxHeight),
          ),
        );

  const left = Math.max(0, Math.floor((screen.cols - width) / 2));
  const top = Math.max(0, Math.floor((screen.rows - height) / 2));
  const right = Math.max(0, screen.cols - left - width);
  const bottom = Math.max(0, screen.rows - top - height);

  return { width, height, top, left, right, bottom };
}

export function useDialogLayout(input: DialogLayoutInput): DialogLayoutResult {
  const screen = useTerminalSize();
  return useMemo(() => computeDialogLayout(input, screen), [input, screen]);
}
