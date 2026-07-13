import React, { act } from "react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Key } from "ink";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { CursorTextLayouter } from "../../../src/foundation/layouter/CursorTextLayouter.ts";
import {
  createInteractiveTextInputStore,
  InteractiveTextInput,
  type InteractiveTextInputState,
  type InteractiveTextInputStore,
} from "../../../src/views/components/InteractiveTextInput.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  act(() => {
    cleanup();
  });
});

function buildKey(partial: Partial<Key>): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...partial,
  };
}

function createLineLayouter(
  line: string,
  cursorIndex: number,
  scrollOffset: number,
): CursorTextLayouter {
  return new CursorTextLayouter({
    width: 0,
    text: line,
    cursorIndex,
    scrollOffset,
  });
}

function setLineCaret(
  store: InteractiveTextInputStore,
  lineIndex: number,
  cursorIndex: number,
  scrollOffset: number,
): void {
  const s = store.getState();
  const line = s.lines[lineIndex] ?? "";
  const lineLayouters = [...s.lineLayouters];
  lineLayouters[lineIndex] = createLineLayouter(line, cursorIndex, scrollOffset);
  store.setState({ lineLayouters });
}

function commitCore(store: InteractiveTextInputStore, next: InteractiveTextInputState): void {
  store.setState({
    lines: next.lines,
    lineIndex: next.lineIndex,
    lineLayouters: next.lineLayouters,
  });
}

const noop = (): void => {};

const activeCtx = {
  isActive: true,
  isDisabled: false,
  onChange: noop,
  onSubmit: noop,
};

describe("buildVisibleParts", () => {
  it("splits the current line at the cursor when maxDisplayWidth is omitted or undefined", () => {
    const store = createInteractiveTextInputStore([], "hello");
    setLineCaret(store, 0, 2, 0);
    const expected = { left: "he", cursorChar: "l", right: "lo" };
    expect(store.getState().buildVisibleParts()).toEqual(expected);
    expect(store.getState().buildVisibleParts(undefined)).toEqual(expected);
  });

  it("applies no width cap when maxDisplayWidth is zero or negative", () => {
    const store = createInteractiveTextInputStore([], "abc");
    setLineCaret(store, 0, 1, 0);
    const expected = { left: "a", cursorChar: "b", right: "c" };
    expect(store.getState().buildVisibleParts(0)).toEqual(expected);
    expect(store.getState().buildVisibleParts(-3)).toEqual(expected);
  });

  it("delegates to buildVisiblePartsFor for the active row when maxDisplayWidth is positive", () => {
    const store = createInteractiveTextInputStore([], "abcdef");
    setLineCaret(store, 0, 5, 0);
    const max = 4;
    const s = store.getState();
    const li = s.lineIndex;
    const line = s.lines[li] ?? "";
    const layouter = s.lineLayouters[li]!;
    expect(s.buildVisibleParts(max)).toEqual(
      s.buildVisiblePartsFor(line, layouter.getCursorIndex(), layouter.getScrollOffset(), max),
    );
  });

  it("uses the line at lineIndex, not only the first row", () => {
    const store = createInteractiveTextInputStore(["older"], "new");
    store.setState({
      lineIndex: 1,
      lineLayouters: [
        createLineLayouter("new", 3, 0),
        createLineLayouter("older", 3, 0),
      ],
    });
    const max = 12;
    const s = store.getState();
    const li = s.lineIndex;
    const line = s.lines[li] ?? "";
    const layouter = s.lineLayouters[li]!;
    expect(s.buildVisibleParts(max)).toEqual(
      s.buildVisiblePartsFor(line, layouter.getCursorIndex(), layouter.getScrollOffset(), max),
    );
  });
});

describe("caret after last character (index === line.length)", () => {
  it("deletes the last character when backspace is pressed at the end of hello", () => {
    const store = createInteractiveTextInputStore([], "hello");
    setLineCaret(store, 0, 5, 0);
    expect(store.getState().lineLayouters[0]!.getCursorIndex()).toBe(5);

    store.getState().applyKey("", buildKey({ backspace: true }), { ...activeCtx });

    const s = store.getState();
    expect(s.lines[0]).toBe("hell");
    expect(s.lineLayouters[0]!.getCursorIndex()).toBe(4);
  });
});

describe("narrow field (per-line offset + cursor)", () => {
  it("shows hel at cursor 2 with max width 3, then ell after moving right with offset 1", () => {
    const store = createInteractiveTextInputStore([], "hello");
    setLineCaret(store, 0, 2, 0);
    expect(store.getState().buildVisibleParts(3)).toEqual({
      left: "he",
      cursorChar: "l",
      right: "",
    });

    store.getState().applyKey("", buildKey({ rightArrow: true }), {
      ...activeCtx,
      maxDisplayWidth: 3,
    });

    const s = store.getState();
    expect(s.lineLayouters[0]!.getCursorIndex()).toBe(3);
    expect(s.lineLayouters[0]!.getScrollOffset()).toBe(1);
    expect(s.buildVisibleParts(3)).toEqual({
      left: "el",
      cursorChar: "l",
      right: "",
    });
  });

  it("shows lo␠ at end of hello with cursor past last char, offset 3, width 3", () => {
    const store = createInteractiveTextInputStore([], "hello");
    setLineCaret(store, 0, 5, 3);
    expect(store.getState().buildVisibleParts(3)).toEqual({
      left: "lo",
      cursorChar: " ",
      right: "",
    });
  });

  it("at EOL with max width 5 uses four text columns and one trailing cursor cell", () => {
    const store = createInteractiveTextInputStore([], "hello");
    setLineCaret(store, 0, 5, 0);
    expect(store.getState().buildVisibleParts(5)).toEqual({
      left: "ello",
      cursorChar: " ",
      right: "",
    });

    const storeLong = createInteractiveTextInputStore([], "abcdefgh");
    setLineCaret(storeLong, 0, 8, 0);
    expect(storeLong.getState().buildVisibleParts(5)).toEqual({
      left: "efgh",
      cursorChar: " ",
      right: "",
    });
  });

  it("at EOL with max width 8 scrolls to show seven text columns and one trailing cursor cell", () => {
    const store = createInteractiveTextInputStore([], "12345678");
    setLineCaret(store, 0, 8, 0);
    expect(store.getState().buildVisibleParts(8)).toEqual({
      left: "2345678",
      cursorChar: " ",
      right: "",
    });
  });
});

describe("per-line cursor and offset preservation", () => {
  it("keeps each history row caret and scroll offset when moving up and down", () => {
    const store = createInteractiveTextInputStore(["older"], "new");
    commitCore(store, {
      lines: ["new", "older"],
      lineIndex: 0,
      lineLayouters: [
        createLineLayouter("new", 1, 0),
        createLineLayouter("older", 4, 2),
      ],
    });

    store.getState().applyKey("", buildKey({ upArrow: true }), { ...activeCtx });

    let s = store.getState();
    expect(s.lineIndex).toBe(1);
    expect(s.lineLayouters[1]!.getCursorIndex()).toBe(4);
    expect(s.lineLayouters[1]!.getScrollOffset()).toBe(2);
    expect(s.lineLayouters[0]!.getCursorIndex()).toBe(1);
    expect(s.lineLayouters[0]!.getScrollOffset()).toBe(0);

    store.getState().applyKey("", buildKey({ downArrow: true }), { ...activeCtx });

    s = store.getState();
    expect(s.lineIndex).toBe(0);
    expect(s.lineLayouters[0]!.getCursorIndex()).toBe(1);
    expect(s.lineLayouters[0]!.getScrollOffset()).toBe(0);
  });
});

describe("truncatePlaceholderToWidth", () => {
  it("truncates placeholder to maxCols using string-width", () => {
    const store = createInteractiveTextInputStore([], "");
    expect(store.getState().truncatePlaceholderToWidth("abcdef", 5)).toBe("abcde");
    expect(store.getState().truncatePlaceholderToWidth("abcdef", 3)).toBe("abc");
    expect(store.getState().truncatePlaceholderToWidth("ab", 5)).toBe("ab");
  });
});

describe("placeholder rendering", () => {
  it("shows placeholder text with the first character as cursor, not a leading block", () => {
    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        React.createElement(InteractiveTextInput, {
          isActive: true,
          history: [],
          initialValue: "",
          placeholder: "filter…",
          onChange: jest.fn(),
          onSubmit: jest.fn(),
        }),
      );
    });
    const frame = stripAnsi(view!.lastFrame() ?? "");
    expect(frame).toContain("filter…");
    expect(frame).not.toContain("█filter");
  });
});
