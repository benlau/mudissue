import { CursorTextLayouter } from "../../../src/foundation/layouter/CursorTextLayouter.ts";

describe("CursorTextLayouter", () => {
  it("shows the first width columns with the cursor on the first character", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12345678",
      cursorIndex: 0,
      scrollOffset: 0,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "",
      atCursorText: "1",
      afterCursorText: "2345",
      scrollOffset: 0,
      cursorIndex: 0,
    });
  });

  it("keeps the same visible window when the cursor moves within it", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12345678",
      cursorIndex: 0,
      scrollOffset: 0,
    });

    expect(layouter.moveCursorOffset(2)).toEqual({
      beforeCursorText: "12",
      atCursorText: "3",
      afterCursorText: "45",
      scrollOffset: 0,
      cursorIndex: 2,
    });
  });

  it("starts the visible window at scrollOffset when it is ahead of the cursor", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12345678",
      cursorIndex: 2,
      scrollOffset: 2,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "",
      atCursorText: "3",
      afterCursorText: "4567",
      scrollOffset: 2,
      cursorIndex: 2,
    });
  });

  it("shows trailing space with the last text columns when the cursor is at the end", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12345678",
      cursorIndex: 0,
      scrollOffset: 0,
    });

    expect(layouter.moveToEnd()).toEqual({
      beforeCursorText: "5678",
      atCursorText: " ",
      afterCursorText: "",
      scrollOffset: 4,
      cursorIndex: 8,
    });
  });

  it("moves the cursor to the beginning of the text", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12345678",
      cursorIndex: 8,
      scrollOffset: 4,
    });

    expect(layouter.moveToBegin()).toEqual({
      beforeCursorText: "",
      atCursorText: "1",
      afterCursorText: "2345",
      scrollOffset: 0,
      cursorIndex: 0,
    });
  });

  it("inserts text at the cursor and advances the cursor past the insertion", () => {
    const layouter = new CursorTextLayouter({
      width: 5,
      text: "12",
      cursorIndex: 2,
      scrollOffset: 0,
    });

    expect(layouter.insertTextAtCursor("34")).toEqual({
      beforeCursorText: "1234",
      atCursorText: " ",
      afterCursorText: "",
      scrollOffset: 0,
      cursorIndex: 4,
    });
  });

  it("counts a CJK character as two display columns when the cursor is on it", () => {
    const layouter = new CursorTextLayouter({
      width: 4,
      text: "中ab",
      cursorIndex: 0,
      scrollOffset: 0,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "",
      atCursorText: "中",
      afterCursorText: "ab",
      scrollOffset: 0,
      cursorIndex: 0,
    });
  });

  it("keeps one ASCII column after a two-column CJK cursor character when width is three", () => {
    const layouter = new CursorTextLayouter({
      width: 3,
      text: "中ab",
      cursorIndex: 0,
      scrollOffset: 0,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "",
      atCursorText: "中",
      afterCursorText: "a",
      scrollOffset: 0,
      cursorIndex: 0,
    });
  });

  it("scrolls past a two-column CJK character when only one column remains before the cursor", () => {
    const layouter = new CursorTextLayouter({
      width: 2,
      text: "中ab",
      cursorIndex: 1,
      scrollOffset: 0,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "",
      atCursorText: "a",
      afterCursorText: "",
      scrollOffset: 1,
      cursorIndex: 1,
    });
  });

  it("returns the full line split at the cursor when width is zero", () => {
    const layouter = new CursorTextLayouter({
      width: 0,
      text: "hello",
      cursorIndex: 2,
      scrollOffset: 0,
    });

    expect(layouter.layout()).toEqual({
      beforeCursorText: "he",
      atCursorText: "l",
      afterCursorText: "lo",
      scrollOffset: 0,
      cursorIndex: 2,
    });
  });
});
