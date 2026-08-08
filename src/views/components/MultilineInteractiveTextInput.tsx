import React, { useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import type { Key } from "ink";
import { useStore } from "zustand/react";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
  MultilineCursorTextLayouter,
  type VisibleRow,
} from "../../foundation/layouter/MultilineCursorTextLayouter.ts";
import { useClipboardStore } from "../../store/ClipboardStore.ts";
import { clamp } from "../../types/maths.ts";

export type MultilineInteractiveTextInputState = {
  layouter: MultilineCursorTextLayouter;
  revision: number;
};

export type MultilineInteractiveTextInputReduceResult =
  | { handled: false }
  | { handled: true; kind: "update"; state: MultilineInteractiveTextInputState };

export type MultilineInteractiveTextInputReplaceContentOptions = {
  preserveCursorRow?: boolean;
  lineIndex?: number;
  cursorIndex?: number;
};

export type MultilineInteractiveTextInputStoreState =
  MultilineInteractiveTextInputState & {
    getText: () => string;
    reduceKey: (
      input: string,
      key: Key,
      height: number,
    ) => MultilineInteractiveTextInputReduceResult;
    applyKey: (
      input: string,
      key: Key,
      ctx: {
        isActive: boolean;
        isDisabled: boolean;
        width: number;
        height: number;
        onChange: (text: string) => void;
      },
    ) => boolean;
    buildVisibleRows: (width: number, height: number) => VisibleRow[];
    replaceContent: (
      text: string,
      options?: MultilineInteractiveTextInputReplaceContentOptions,
    ) => void;
  };

function wantsBackspace(key: Key, input: string): boolean {
  return (
    key.backspace ||
    key.delete ||
    input === "\u007f" ||
    input === "\b"
  );
}

export type MultilineInteractiveTextInputInitialCursor = {
  lineIndex?: number;
  cursorIndex?: number;
};

function createLayouter(
  initialValue: string | undefined,
  width: number,
  height: number,
  initialCursor?: MultilineInteractiveTextInputInitialCursor,
): MultilineCursorTextLayouter {
  const lines =
    initialValue === undefined || initialValue === ""
      ? [""]
      : initialValue.split("\n");
  return new MultilineCursorTextLayouter({
    lines,
    width,
    height,
    lineIndex: initialCursor?.lineIndex,
    cursorIndex: initialCursor?.cursorIndex,
  });
}

function reduceKey(
  state: MultilineInteractiveTextInputState,
  input: string,
  key: Key,
  height: number,
): MultilineInteractiveTextInputReduceResult {
  const layouter = state.layouter;

  if (key.return) {
    layouter.insertNewline();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.upArrow) {
    layouter.moveCursorUp();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.downArrow) {
    layouter.moveCursorDown();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.leftArrow) {
    layouter.moveCursorLeft();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.rightArrow) {
    layouter.moveCursorRight();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.home) {
    layouter.moveToLineBegin();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.end) {
    layouter.moveToLineEnd();
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.pageUp) {
    layouter.moveCursorPageUp(Math.max(1, height - 1));
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (key.pageDown) {
    layouter.moveCursorPageDown(Math.max(1, height - 1));
    return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
  }

  if (wantsBackspace(key, input)) {
    const result = layouter.deleteBeforeCursor();
    const nextLayouter = result ?? layouter;
    return { handled: true, kind: "update", state: { layouter: nextLayouter, revision: state.revision } };
  }

  if (key.ctrl && input.length === 1) {
    const ch = input.toLowerCase();
    if (ch === "a") {
      layouter.moveToLineBegin();
      return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
    }
    if (ch === "e") {
      layouter.moveToLineEnd();
      return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
    }
    if (ch === "d") {
      const result = layouter.deleteAfterCursor();
      const nextLayouter = result ?? layouter;
      return { handled: true, kind: "update", state: { layouter: nextLayouter, revision: state.revision } };
    }
    if (ch === "k") {
      const killed = layouter.killLineFromCursor();
      if (killed !== "") {
        useClipboardStore.getState().write(killed);
      }
      return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
    }
    if (ch === "v") {
      const clipboard = useClipboardStore.getState().content;
      if (clipboard !== "") {
        layouter.insertTextAtCursor(clipboard);
      }
      return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
    }
    return { handled: false };
  }

  if (
    key.escape ||
    key.tab ||
    key.meta ||
    key.ctrl
  ) {
    return { handled: false };
  }

  if (input.length === 0) {
    return { handled: false };
  }

  layouter.insertTextAtCursor(input);
  return { handled: true, kind: "update", state: { layouter, revision: state.revision } };
}

export function createMultilineInteractiveTextInputStore(
  initialValue: string | undefined,
  width: number,
  height: number,
  initialCursor?: MultilineInteractiveTextInputInitialCursor,
): MultilineInteractiveTextInputStore {
  return createStore<MultilineInteractiveTextInputStoreState>((set, get) => {
    const layouter = createLayouter(
      initialValue,
      width,
      height,
      initialCursor,
    );

    const getText = (): string => get().layouter.getText();

    const applyKey = (
      input: string,
      key: Key,
      ctx: {
        isActive: boolean;
        isDisabled: boolean;
        width: number;
        height: number;
        onChange: (text: string) => void;
      },
    ): boolean => {
      if (!ctx.isActive || ctx.isDisabled) return false;

      const current = get();
      current.layouter.setWidth(ctx.width);
      current.layouter.setHeight(ctx.height);

      const before = getText();
      const result = reduceKey(current, input, key, ctx.height);
      if (!result.handled) return false;

      set({
        layouter: result.state.layouter,
        revision: get().revision + 1,
      });
      const next = getText();
      if (next !== before) {
        ctx.onChange(next);
      }
      return true;
    };

    return {
      layouter,
      revision: 0,
      getText,
      reduceKey: (input, key, h) => reduceKey(get(), input, key, h),
      applyKey,
      buildVisibleRows: (w, h) => {
        const s = get();
        s.layouter.setWidth(w);
        s.layouter.setHeight(h);
        return s.layouter.layout().visibleRows;
      },
      replaceContent: (text, options) => {
        const lines = text.length > 0 ? text.split("\n") : [""];
        const maxLine = Math.max(0, lines.length - 1);
        const current = get();
        let lineIndex = 0;
        let cursorIndex = options?.cursorIndex ?? 0;
        if (options?.preserveCursorRow) {
          lineIndex = clamp(current.layouter.getLineIndex(), 0, maxLine);
          cursorIndex = 0;
        } else if (options?.lineIndex !== undefined) {
          lineIndex = clamp(options.lineIndex, 0, maxLine);
        }
        current.layouter.replaceLines(lines, lineIndex, cursorIndex);
        set({ layouter: current.layouter, revision: get().revision + 1 });
      },
    };
  });
}

export type MultilineInteractiveTextInputStore =
  StoreApi<MultilineInteractiveTextInputStoreState>;

/** Per-mount vanilla Zustand store returned by useMultilineInteractiveTextInputHandle(). */
export type MultilineInteractiveTextInputHandle =
  MultilineInteractiveTextInputStore;

/** Per-mount vanilla Zustand store (not a module singleton). */
export function useMultilineInteractiveTextInputHandle(): MultilineInteractiveTextInputStore {
  const storeRef = useRef<MultilineInteractiveTextInputStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createMultilineInteractiveTextInputStore("", 1, 1);
  }
  return storeRef.current;
}

/** Ink collapses nested inverse whitespace on empty rows; only those use full-row inverse. */
export function renderMultilineVisibleRow(
  row: VisibleRow,
  index: number,
  width?: number,
): React.ReactNode {
  const rowContent = renderMultilineVisibleRowContent(row, index);
  if (width !== undefined && width > 0) {
    return (
      <Box key={index} width={width}>
        {rowContent}
      </Box>
    );
  }
  return rowContent;
}

function renderMultilineVisibleRowContent(
  row: VisibleRow,
  index: number,
): React.ReactNode {
  if (!row.isCursorRow) {
    return <Text key={index}>{row.left === "" ? " " : row.left}</Text>;
  }

  // Cursor-only row (empty line block or trailing-space row): Ink drops nested inverse
  // on whitespace unless the inverse cell is rendered as a standalone inverse space.
  const blockAfterText =
    row.right === "" &&
    row.left === "" &&
    (row.cursorChar === "█" || row.cursorChar === " ");

  if (blockAfterText) {
    return (
      <Text key={index}>
        {row.left}
        <Text inverse> </Text>
      </Text>
    );
  }

  return (
    <Text key={index}>
      {row.left}
      <Text inverse>{row.cursorChar}</Text>
      {row.right}
    </Text>
  );
}

export type MultilineInteractiveTextInputProps = {
  handle: MultilineInteractiveTextInputStore;
  isActive: boolean;
  isDisabled?: boolean;
  width: number;
  height: number;
  initialValue?: string;
  initialLineIndex?: number;
  initialCursorIndex?: number;
  onChange: (text: string) => void;
};

export function MultilineInteractiveTextInput({
  handle,
  isActive,
  isDisabled = false,
  width,
  height,
  initialValue,
  initialLineIndex,
  initialCursorIndex,
  onChange,
}: MultilineInteractiveTextInputProps) {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (
      initialValue === undefined &&
      initialLineIndex === undefined &&
      initialCursorIndex === undefined
    ) {
      return;
    }
    handle.getState().replaceContent(initialValue ?? "", {
      lineIndex: initialLineIndex,
      cursorIndex: initialCursorIndex,
    });
  }, [handle, initialValue, initialLineIndex, initialCursorIndex]);

  const revision = useStore(handle, (s) => s.revision);
  const buildVisibleRows = useStore(handle, (s) => s.buildVisibleRows);
  void revision;
  const visibleRows = buildVisibleRows(width, height);

  useInput(
    (input, key) => {
      handle.getState().applyKey(input, key, {
        isActive,
        isDisabled,
        width,
        height,
        onChange,
      });
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" height={height}>
      {visibleRows.map((row, index) =>
        renderMultilineVisibleRow(row, index, width),
      )}
    </Box>
  );
}
