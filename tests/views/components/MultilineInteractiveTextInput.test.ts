import { jest } from "@jest/globals";
import type { Key } from "ink";
import { useClipboardStore } from "../../../src/store/ClipboardStore.ts";
import {
  createMultilineInteractiveTextInputStore,
  type MultilineInteractiveTextInputStore,
} from "../../../src/views/components/MultilineInteractiveTextInput.tsx";

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

describe("createMultilineInteractiveTextInputStore", () => {
  let store: MultilineInteractiveTextInputStore;
  let onChange: jest.Mock<(text: string) => void>;

  beforeEach(() => {
    store = createMultilineInteractiveTextInputStore("", 10, 3);
    onChange = jest.fn();
    useClipboardStore.setState({ content: "" });
  });

  function activeCtx(overrides?: Partial<{
    width: number;
    height: number;
  }>) {
    return {
      isActive: true,
      isDisabled: false,
      width: 10,
      height: 3,
      onChange,
      ...overrides,
    };
  }

  it("inserts an empty line when Enter is pressed", () => {
    store.getState().applyKey("", buildKey({ return: true }), activeCtx());

    expect(store.getState().layouter.getLines()).toEqual(["", ""]);
    expect(store.getState().getText()).toBe("\n");
    expect(onChange).toHaveBeenCalledWith("\n");
  });

  it("shows a visible cursor row after Enter inserts an empty line", () => {
    store.getState().applyKey("hello", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ return: true }), activeCtx());

    expect(store.getState().buildVisibleRows(10, 2)).toEqual([
      { left: "hello ", cursorChar: "", right: "", isCursorRow: false },
      { left: "", cursorChar: "█", right: "", isCursorRow: true },
    ]);
  });

  it("places the cursor on the trailing space row after typing an exact-fit line", () => {
    const narrowStore = createMultilineInteractiveTextInputStore("", 8, 2);
    narrowStore
      .getState()
      .applyKey("12345678", buildKey({}), activeCtx({ width: 8, height: 2 }));

    expect(narrowStore.getState().buildVisibleRows(8, 2)).toEqual([
      { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
      { left: "", cursorChar: " ", right: "", isCursorRow: true },
    ]);
  });

  it("moves the cursor to the trailing space row when End is pressed on an exact-fit line", () => {
    const narrowStore = createMultilineInteractiveTextInputStore("12345678", 8, 2);
    narrowStore
      .getState()
      .applyKey("", buildKey({ end: true }), activeCtx({ width: 8, height: 2 }));

    expect(narrowStore.getState().buildVisibleRows(8, 2)).toEqual([
      { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
      { left: "", cursorChar: " ", right: "", isCursorRow: true },
    ]);
  });

  it("moves the cursor to the trailing space row when Right is pressed at end of an exact-fit line", () => {
    const narrowStore = createMultilineInteractiveTextInputStore("", 8, 2);
    narrowStore
      .getState()
      .applyKey("12345678", buildKey({}), activeCtx({ width: 8, height: 2 }));
    narrowStore
      .getState()
      .applyKey("", buildKey({ leftArrow: true }), activeCtx({ width: 8, height: 2 }));
    narrowStore
      .getState()
      .applyKey("", buildKey({ rightArrow: true }), activeCtx({ width: 8, height: 2 }));

    expect(narrowStore.getState().buildVisibleRows(8, 2)).toEqual([
      { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
      { left: "", cursorChar: " ", right: "", isCursorRow: true },
    ]);
  });

  it("wraps typed text at width 8 without splitting the second row", () => {
    const narrowStore = createMultilineInteractiveTextInputStore("", 8, 2);
    narrowStore
      .getState()
      .applyKey("12345678901", buildKey({}), activeCtx({ width: 8, height: 2 }));

    expect(narrowStore.getState().buildVisibleRows(8, 2)).toEqual([
      { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
      { left: "901", cursorChar: " ", right: "", isCursorRow: true },
    ]);
  });

  it("inserts uppercase letters when Shift is held", () => {
    store.getState().applyKey("Hello", buildKey({ shift: true }), activeCtx());

    expect(store.getState().getText()).toBe("Hello");
    expect(onChange).toHaveBeenCalledWith("Hello");
  });

  it("deletes the character at the cursor on Ctrl+D", () => {
    store.getState().applyKey("hello", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ leftArrow: true }), activeCtx());
    store.getState().applyKey("", buildKey({ leftArrow: true }), activeCtx());
    const handled = store
      .getState()
      .applyKey("d", buildKey({ ctrl: true }), activeCtx());

    expect(handled).toBe(true);
    expect(store.getState().getText()).toBe("helo");
    expect(store.getState().layouter.getCursorIndex()).toBe(3);
    expect(onChange).toHaveBeenCalledWith("helo");
  });

  it("kills from cursor to end of line on Ctrl+K and stores the killed text", () => {
    store.getState().applyKey("hello", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ leftArrow: true }), activeCtx());
    store.getState().applyKey("", buildKey({ leftArrow: true }), activeCtx());
    store.getState().applyKey("k", buildKey({ ctrl: true }), activeCtx());

    expect(store.getState().getText()).toBe("hel");
    expect(useClipboardStore.getState().content).toBe("lo");
  });

  it("removes an empty line on Ctrl+K and stores a newline in the clipboard", () => {
    store.getState().applyKey("hello", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ return: true }), activeCtx());
    store.getState().applyKey("k", buildKey({ ctrl: true }), activeCtx());

    expect(store.getState().getText()).toBe("hello");
    expect(store.getState().layouter.getLineIndex()).toBe(0);
    expect(useClipboardStore.getState().content).toBe("\n");
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("does not overwrite the clipboard when Ctrl+K kills nothing", () => {
    useClipboardStore.getState().write("keep me");
    store.getState().applyKey("hi", buildKey({}), activeCtx());
    store.getState().applyKey("k", buildKey({ ctrl: true }), activeCtx());

    expect(store.getState().getText()).toBe("hi");
    expect(useClipboardStore.getState().content).toBe("keep me");
  });

  it("pastes clipboard content at the cursor on Ctrl+V", () => {
    useClipboardStore.getState().write("XYZ");
    store.getState().applyKey("ab", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ leftArrow: true }), activeCtx());
    store.getState().applyKey("v", buildKey({ ctrl: true }), activeCtx());

    expect(store.getState().getText()).toBe("aXYZb");
    expect(onChange).toHaveBeenCalledWith("aXYZb");
  });

  it("pastes multiline clipboard content on Ctrl+V", () => {
    useClipboardStore.getState().write("one\ntwo");
    store.getState().applyKey("v", buildKey({ ctrl: true }), activeCtx());

    expect(store.getState().getText()).toBe("one\ntwo");
    expect(store.getState().layouter.getLines()).toEqual(["one", "two"]);
    expect(onChange).toHaveBeenCalledWith("one\ntwo");
  });

  it("does nothing on Ctrl+V when the clipboard is empty", () => {
    store.getState().applyKey("hi", buildKey({}), activeCtx());
    onChange.mockClear();
    const handled = store
      .getState()
      .applyKey("v", buildKey({ ctrl: true }), activeCtx());

    expect(handled).toBe(true);
    expect(store.getState().getText()).toBe("hi");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves the cursor down by height minus one on PageDown", () => {
    const tallStore = createMultilineInteractiveTextInputStore(
      "a\nb\nc\nd\ne",
      4,
      2,
    );
    tallStore.getState().applyKey("", buildKey({ pageDown: true }), activeCtx({
      width: 4,
      height: 2,
    }));

    expect(tallStore.getState().layouter.getLineIndex()).toBe(1);
  });

  it("snaps the cursor to the last line on PageDown near the bottom", () => {
    const tallStore = createMultilineInteractiveTextInputStore(
      "a\nb\nc\nd\ne",
      4,
      2,
      { lineIndex: 3 },
    );
    tallStore.getState().applyKey("", buildKey({ pageDown: true }), activeCtx({
      width: 4,
      height: 2,
    }));

    expect(tallStore.getState().layouter.getLineIndex()).toBe(4);
  });

  it("scrolls the viewport to show the initial line index", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i}`);
    const tallStore = createMultilineInteractiveTextInputStore(
      lines.join("\n"),
      10,
      1,
      { lineIndex: 15 },
    );

    tallStore.getState().buildVisibleRows(10, 1);
    expect(tallStore.getState().layouter.getLineIndex()).toBe(15);
    expect(tallStore.getState().layouter.getScrollRowOffset()).toBeGreaterThan(0);
  });

  it("inserts CR-separated pasted lines as separate visible rows", () => {
    store.getState().applyKey("1\r2\r3", buildKey({}), activeCtx({ height: 4 }));

    expect(store.getState().getText()).toBe("1\n2\n3");
    expect(store.getState().buildVisibleRows(10, 4)).toEqual([
      { left: "1 ", cursorChar: "", right: "", isCursorRow: false },
      { left: "2 ", cursorChar: "", right: "", isCursorRow: false },
      { left: "3", cursorChar: " ", right: "", isCursorRow: true },
      { left: "", cursorChar: " ", right: "", isCursorRow: false },
    ]);
  });

  it("replaceContent resets cursor to line 0 by default", () => {
    store.getState().applyKey("a", buildKey({}), activeCtx());
    store.getState().applyKey("", buildKey({ return: true }), activeCtx());
    store.getState().applyKey("b", buildKey({}), activeCtx());

    expect(store.getState().layouter.getLineIndex()).toBe(1);

    store.getState().replaceContent("x\ny\nz");

    expect(store.getState().getText()).toBe("x\ny\nz");
    expect(store.getState().layouter.getLineIndex()).toBe(0);
    expect(store.getState().layouter.getCursorIndex()).toBe(0);
  });

  it("replaceContent with preserveCursorRow keeps the cursor line when possible", () => {
    const tallStore = createMultilineInteractiveTextInputStore("a\nb\nc", 10, 3);
    tallStore.getState().applyKey("", buildKey({ downArrow: true }), activeCtx());
    tallStore.getState().applyKey("", buildKey({ downArrow: true }), activeCtx());

    expect(tallStore.getState().layouter.getLineIndex()).toBe(2);

    tallStore.getState().replaceContent("x\ny\nz", { preserveCursorRow: true });

    expect(tallStore.getState().getText()).toBe("x\ny\nz");
    expect(tallStore.getState().layouter.getLineIndex()).toBe(2);
    expect(tallStore.getState().layouter.getCursorIndex()).toBe(0);
  });

  it("replaceContent with preserveCursorRow clamps line index when content shrinks", () => {
    const tallStore = createMultilineInteractiveTextInputStore("a\nb\nc\nd", 10, 4);
    tallStore.getState().applyKey("", buildKey({ downArrow: true }), activeCtx());
    tallStore.getState().applyKey("", buildKey({ downArrow: true }), activeCtx());
    tallStore.getState().applyKey("", buildKey({ downArrow: true }), activeCtx());

    expect(tallStore.getState().layouter.getLineIndex()).toBe(3);

    tallStore.getState().replaceContent("only", { preserveCursorRow: true });

    expect(tallStore.getState().getText()).toBe("only");
    expect(tallStore.getState().layouter.getLineIndex()).toBe(0);
  });
});
