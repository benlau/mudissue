import React, { useRef } from "react";
import { Text, useInput } from "ink";
import type { Key } from "ink";
import stringWidth from "string-width";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand/react";
import { CursorTextLayouter } from "../../foundation/layouter/CursorTextLayouter.ts";

export type InteractiveTextInputState = {
  lines: string[];
  lineIndex: number;
  lineLayouters: CursorTextLayouter[];
};

export type InteractiveTextInputReduceResult =
  | { handled: false }
  | { handled: true; kind: "submit" }
  | { handled: true; kind: "update"; state: InteractiveTextInputState };

export type InteractiveTextInputStoreState = InteractiveTextInputState & {
  getCurrentLine: () => string;
  reduceKey: (input: string, key: Key) => InteractiveTextInputReduceResult;
  applyKey: (
    input: string,
    key: Key,
    ctx: {
      isActive: boolean;
      isDisabled: boolean;
      onChange: (currentLine: string) => void;
      onSubmit?: () => void;
      maxDisplayWidth?: number;
    },
  ) => boolean;
  buildVisiblePartsFor: (
    line: string,
    cursorIndex: number,
    displayOffset: number,
    maxCols: number,
  ) => { left: string; cursorChar: string; right: string };
  buildVisibleParts: (maxDisplayWidth?: number) => {
    left: string;
    cursorChar: string;
    right: string;
  };
  truncatePlaceholderToWidth: (placeholder: string, maxCols: number) => string;
};

/** Per-component-instance vanilla store (not a module singleton). */
export type InteractiveTextInputStore = StoreApi<InteractiveTextInputStoreState>;

function createLineLayouter(
  line: string,
  cursorIndex = line.length,
  scrollOffset = 0,
): CursorTextLayouter {
  return new CursorTextLayouter({
    width: 0,
    text: line,
    cursorIndex,
    scrollOffset,
  });
}

export function createInteractiveTextInputStore(
  history: readonly string[],
  initialValue: string | undefined,
): InteractiveTextInputStore {
  function seedCore(): InteractiveTextInputState {
    const hist = history.map((h) => String(h));
    const lines =
      initialValue === undefined
        ? hist.length > 0
          ? [...hist]
          : [""]
        : [initialValue, ...hist];
    const lineLayouters = lines.map((line) => createLineLayouter(line));
    return {
      lines,
      lineIndex: 0,
      lineLayouters,
    };
  }

  /** Keep layouters aligned with `lines` (e.g. after partial zustand merges). */
  function ensureParallelFields(state: InteractiveTextInputState): InteractiveTextInputState {
    const { lines } = state;
    if (state.lineLayouters.length === lines.length) {
      return state;
    }
    const lineLayouters = lines.map((line, i) => {
      const existing = state.lineLayouters[i];
      if (existing !== undefined) {
        return existing;
      }
      return createLineLayouter(line);
    });
    return { ...state, lineLayouters };
  }

  function activeLayouter(state: InteractiveTextInputState): CursorTextLayouter {
    return state.lineLayouters[state.lineIndex]!;
  }

  function syncLayouterTextFromLine(
    layouter: CursorTextLayouter,
    line: string,
  ): void {
    if (layouter.getText() === line) return;
    layouter.replaceText(line, layouter.getCursorIndex(), layouter.getScrollOffset());
  }

  function syncLineFromLayouter(
    lines: string[],
    lineIndex: number,
    layouter: CursorTextLayouter,
  ): string[] {
    const nextLines = [...lines];
    nextLines[lineIndex] = layouter.getText();
    return nextLines;
  }

  function layoutResultToVisibleParts(layout: {
    beforeCursorText: string;
    atCursorText: string;
    afterCursorText: string;
  }): { left: string; cursorChar: string; right: string } {
    return {
      left: layout.beforeCursorText,
      cursorChar: layout.atCursorText,
      right: layout.afterCursorText,
    };
  }

  function buildVisiblePartsFor(
    line: string,
    cursorIndex: number,
    displayOffset: number,
    maxCols: number,
  ): { left: string; cursorChar: string; right: string } {
    const layouter = new CursorTextLayouter({
      width: maxCols,
      text: line,
      cursorIndex,
      scrollOffset: displayOffset,
    });
    return layoutResultToVisibleParts(layouter.layout());
  }

  function reconcileActiveLineDisplay(
    state: InteractiveTextInputState,
    maxDisplayWidth?: number,
  ): InteractiveTextInputState {
    const li = state.lineIndex;
    const line = state.lines[li] ?? "";
    const layouters = [...state.lineLayouters];
    const layouter = layouters[li]!;
    syncLayouterTextFromLine(layouter, line);
    layouter.setWidth(
      maxDisplayWidth !== undefined && maxDisplayWidth > 0 ? maxDisplayWidth : 0,
    );
    layouter.layout();
    const lines = syncLineFromLayouter(state.lines, li, layouter);
    return { ...state, lines, lineLayouters: layouters };
  }

  function truncatePlaceholderToWidth(placeholder: string, maxCols: number): string {
    if (maxCols <= 0 || stringWidth(placeholder) <= maxCols) return placeholder;
    let end = 0;
    for (let i = 1; i <= placeholder.length; i++) {
      if (stringWidth(placeholder.slice(0, i)) > maxCols) break;
      end = i;
    }
    return placeholder.slice(0, Math.max(0, end));
  }

  function wantsBackspace(key: Key, input: string): boolean {
    return (
      key.backspace ||
      key.delete ||
      input === "\u007f" ||
      input === "\b"
    );
  }

  function backwardWordIndex(line: string, cursor: number): number {
    let i = cursor;
    while (i > 0 && /\s/.test(line[i - 1]!)) i--;
    while (i > 0 && !/\s/.test(line[i - 1]!)) i--;
    return i;
  }

  function reduceKey(
    state: InteractiveTextInputState,
    input: string,
    key: Key,
  ): InteractiveTextInputReduceResult {
    state = ensureParallelFields(state);

    if (key.return) {
      return { handled: true, kind: "submit" };
    }

    const li = state.lineIndex;
    const layouters = [...state.lineLayouters];
    const layouter = layouters[li]!;
    let lines = [...state.lines];
    const line = lines[li] ?? "";
    syncLayouterTextFromLine(layouter, line);

    if (key.upArrow) {
      const nextLineIndex = Math.min(state.lines.length - 1, li + 1);
      return {
        handled: true,
        kind: "update",
        state: { ...state, lineIndex: nextLineIndex, lineLayouters: layouters, lines },
      };
    }

    if (key.downArrow) {
      const nextLineIndex = Math.max(0, li - 1);
      return {
        handled: true,
        kind: "update",
        state: { ...state, lineIndex: nextLineIndex, lineLayouters: layouters, lines },
      };
    }

    if (key.leftArrow) {
      if (layouter.getCursorIndex() > 0) {
        layouter.moveCursorOffset(-1);
      }
      return {
        handled: true,
        kind: "update",
        state: { ...state, lineLayouters: layouters, lines },
      };
    }

    if (key.rightArrow) {
      if (layouter.getCursorIndex() < line.length) {
        layouter.moveCursorOffset(1);
      }
      return {
        handled: true,
        kind: "update",
        state: { ...state, lineLayouters: layouters, lines },
      };
    }

    if (wantsBackspace(key, input)) {
      layouter.deleteBeforeCursor();
      lines = syncLineFromLayouter(lines, li, layouter);
      return {
        handled: true,
        kind: "update",
        state: { ...state, lineLayouters: layouters, lines },
      };
    }

    if (key.ctrl && input.length === 1) {
      const ch = input.toLowerCase();
      if (ch === "a") {
        layouter.moveToBegin();
        return {
          handled: true,
          kind: "update",
          state: { ...state, lineLayouters: layouters, lines },
        };
      }
      if (ch === "e") {
        layouter.moveToEnd();
        return {
          handled: true,
          kind: "update",
          state: { ...state, lineLayouters: layouters, lines },
        };
      }
      if (ch === "k") {
        layouter.replaceText(line.slice(0, layouter.getCursorIndex()), layouter.getCursorIndex());
        lines = syncLineFromLayouter(lines, li, layouter);
        return {
          handled: true,
          kind: "update",
          state: { ...state, lineLayouters: layouters, lines },
        };
      }
      if (ch === "u") {
        layouter.replaceText("", 0, 0);
        lines = syncLineFromLayouter(lines, li, layouter);
        return {
          handled: true,
          kind: "update",
          state: { ...state, lineLayouters: layouters, lines },
        };
      }
      if (ch === "w") {
        const start = backwardWordIndex(line, layouter.getCursorIndex());
        if (start === layouter.getCursorIndex()) {
          return { handled: true, kind: "update", state: { ...state, lineLayouters: layouters, lines } };
        }
        layouter.replaceText(
          line.slice(0, start) + line.slice(layouter.getCursorIndex()),
          start,
        );
        lines = syncLineFromLayouter(lines, li, layouter);
        return {
          handled: true,
          kind: "update",
          state: { ...state, lineLayouters: layouters, lines },
        };
      }
      return { handled: false };
    }

    if (
      key.escape ||
      key.tab ||
      key.meta ||
      key.ctrl ||
      key.pageDown ||
      key.pageUp ||
      key.home ||
      key.end
    ) {
      return { handled: false };
    }

    if (input.length === 0) {
      return { handled: false };
    }

    layouter.insertTextAtCursor(input);
    lines = syncLineFromLayouter(lines, li, layouter);
    return {
      handled: true,
      kind: "update",
      state: { ...state, lineLayouters: layouters, lines },
    };
  }

  return createStore<InteractiveTextInputStoreState>((set, get) => {
    const getCurrentLine = (): string => {
      const s = get();
      return s.lines[s.lineIndex] ?? "";
    };

    const applyKey = (
      input: string,
      key: Key,
      ctx: {
        isActive: boolean;
        isDisabled: boolean;
        onChange: (currentLine: string) => void;
        onSubmit?: () => void;
        maxDisplayWidth?: number;
      },
    ): boolean => {
      if (!ctx.isActive || ctx.isDisabled) return false;
      const before = get();
      const result = reduceKey(before, input, key);
      if (!result.handled) return false;
      if (result.kind === "submit") {
        ctx.onSubmit?.();
        return true;
      }
      const prevLine = before.lines[before.lineIndex] ?? "";
      const reconciled = reconcileActiveLineDisplay(result.state, ctx.maxDisplayWidth);
      const nextLine = reconciled.lines[reconciled.lineIndex] ?? "";
      set({
        lines: reconciled.lines,
        lineIndex: reconciled.lineIndex,
        lineLayouters: reconciled.lineLayouters,
      });
      if (nextLine !== prevLine) {
        ctx.onChange(nextLine);
      }
      return true;
    };

    const buildVisibleParts = (maxDisplayWidth?: number): {
      left: string;
      cursorChar: string;
      right: string;
    } => {
      const s = get();
      const layouter = activeLayouter(s);
      syncLayouterTextFromLine(layouter, s.lines[s.lineIndex] ?? "");
      layouter.setWidth(
        maxDisplayWidth !== undefined && maxDisplayWidth > 0 ? maxDisplayWidth : 0,
      );
      return layoutResultToVisibleParts(layouter.layout());
    };

    return {
      ...seedCore(),
      getCurrentLine,
      reduceKey: (input, key) => reduceKey(get(), input, key),
      applyKey,
      buildVisiblePartsFor,
      buildVisibleParts,
      truncatePlaceholderToWidth,
    };
  });
}

export type InteractiveTextInputProps = {
  isActive: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  /** Max display width (terminal columns); omit or ≤0 for no limit. Uses string-width. */
  maxDisplayWidth?: number;
  history: readonly string[];
  /** Omit to use history-only rows; pass (including `""`) to prepend an editable row. */
  initialValue?: string;
  onChange: (currentLine: string) => void;
  onSubmit?: () => void;
};

export function InteractiveTextInput({
  isActive,
  isDisabled = false,
  placeholder,
  maxDisplayWidth,
  history,
  initialValue,
  onChange,
  onSubmit,
}: InteractiveTextInputProps) {
  const storeRef = useRef<InteractiveTextInputStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createInteractiveTextInputStore(history, initialValue);
  }
  const store = storeRef.current;

  const state = useStore(store);

  useInput(
    (input, key) => {
      store.getState().applyKey(input, key, {
        isActive,
        isDisabled,
        onChange,
        onSubmit,
        maxDisplayWidth,
      });
    },
    { isActive },
  );

  const line = state.getCurrentLine();
  const parts = state.buildVisibleParts(maxDisplayWidth);
  const { left, cursorChar, right } = parts;

  if (line.length === 0 && placeholder) {
    const maxW =
      maxDisplayWidth !== undefined && maxDisplayWidth > 0
        ? maxDisplayWidth
        : undefined;
    const ph =
      maxW !== undefined
        ? state.truncatePlaceholderToWidth(placeholder, maxW)
        : placeholder;
    if (ph.length === 0) {
      return (
        <Text>
          <Text inverse>{cursorChar}</Text>
        </Text>
      );
    }
    return (
      <Text>
        <Text inverse>{ph[0]}</Text>
        <Text dimColor>{ph.slice(1)}</Text>
      </Text>
    );
  }

  return (
    <Text>
      {left}
      <Text inverse>{cursorChar}</Text>
      {right}
    </Text>
  );
}
