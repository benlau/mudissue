import { MultilineCursorTextLayouter } from "../../../src/foundation/layouter/MultilineCursorTextLayouter.ts";

describe("MultilineCursorTextLayouter", () => {
  it("wraps long logical lines for display without changing stored text", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["abcdef"],
      width: 3,
      height: 2,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "abc",
      "def",
      " ",
    ]);
    expect(layouter.getText()).toBe("abcdef");
  });

  it("appends a display-only trailing space that can wrap to a new row", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678"],
      lineIndex: 0,
      cursorIndex: 8,
      width: 8,
      height: 2,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "12345678",
      " ",
    ]);
    expect(layouter.getText()).toBe("12345678");
    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: " ", right: "", isCursorRow: true },
      ],
    });
  });

  it("wraps the trailing space when a logical line ends on a full-width segment", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["1234567812345678"],
      width: 8,
      height: 3,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "12345678",
      "12345678",
      " ",
    ]);
  });

  it("keeps wrapped overflow and the trailing space on the same row when they fit", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["123456789"],
      width: 8,
      height: 3,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "12345678",
      "9 ",
    ]);
  });

  it("does not save the display-only trailing space in getText", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678"],
      lineIndex: 0,
      cursorIndex: 8,
      width: 8,
      height: 2,
    });

    layouter.insertTextAtCursor("x");

    expect(layouter.getText()).toBe("12345678x");
    expect(layouter.getLines()).toEqual(["12345678x"]);
  });

  it("moves the cursor onto the trailing space when End is pressed", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678"],
      lineIndex: 0,
      cursorIndex: 3,
      width: 8,
      height: 2,
    });

    layouter.moveToLineEnd();

    expect(layouter.getCursorIndex()).toBe(8);
    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: " ", right: "", isCursorRow: true },
      ],
    });
  });

  it("keeps the cursor on the trailing space when Right is pressed at end of line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678"],
      lineIndex: 0,
      cursorIndex: 8,
      width: 8,
      height: 2,
    });

    layouter.moveCursorRight();

    expect(layouter.getCursorIndex()).toBe(8);
    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: " ", right: "", isCursorRow: true },
      ],
    });
  });

  it("moves the cursor onto the trailing space when Right is pressed past the last character", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678"],
      lineIndex: 0,
      cursorIndex: 7,
      width: 8,
      height: 2,
    });

    layouter.moveCursorRight();

    expect(layouter.getCursorIndex()).toBe(8);
    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: " ", right: "", isCursorRow: true },
      ],
    });
  });

  it("shows the cursor on the trailing space after typing an exact-fit line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: [""],
      width: 8,
      height: 2,
    });

    layouter.insertTextAtCursor("12345678");

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: " ", right: "", isCursorRow: true },
      ],
    });
  });

  it("wraps an 11-character string at width 8 for display rows", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["12345678901"],
      width: 8,
      height: 2,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "12345678",
      "901 ",
    ]);
    expect(layouter.getText()).toBe("12345678901");
  });

  it("highlights the last character on the first wrapped row when the cursor sits on it", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["123456789"],
      lineIndex: 0,
      cursorIndex: 7,
      width: 8,
      height: 2,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "1234567", cursorChar: "8", right: "", isCursorRow: true },
        { left: "9 ", cursorChar: "", right: "", isCursorRow: false },
      ],
    });
  });

  it("places the cursor on the wrapped row when it sits on the first character after a full-width row", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["123456789"],
      lineIndex: 0,
      cursorIndex: 8,
      width: 8,
      height: 2,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "12345678", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: "9", right: " ", isCursorRow: true },
      ],
    });
  });

  it("moves back onto the last character of the first wrapped row when Left is pressed after it", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["123456789"],
      lineIndex: 0,
      cursorIndex: 8,
      width: 8,
      height: 2,
    });

    layouter.moveCursorLeft();

    expect(layouter.getCursorIndex()).toBe(7);
    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "1234567", cursorChar: "8", right: "", isCursorRow: true },
        { left: "9 ", cursorChar: "", right: "", isCursorRow: false },
      ],
    });
  });

  it("moves the cursor down across wrapped display rows", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["abcdef"],
      lineIndex: 0,
      cursorIndex: 1,
      width: 3,
      height: 2,
    });

    layouter.moveCursorDown();

    expect(layouter.getLineIndex()).toBe(0);
    expect(layouter.getCursorIndex()).toBe(4);
  });

  it("moves to logical line begin and end with Home and End", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello"],
      lineIndex: 0,
      cursorIndex: 3,
      width: 10,
      height: 1,
    });

    layouter.moveToLineBegin();
    expect(layouter.getCursorIndex()).toBe(0);

    layouter.moveToLineEnd();
    expect(layouter.getCursorIndex()).toBe(5);
  });

  it("kills from cursor to end of logical line with killLineFromCursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello world"],
      lineIndex: 0,
      cursorIndex: 5,
      width: 20,
      height: 1,
    });

    expect(layouter.killLineFromCursor()).toBe(" world");
    expect(layouter.getLines()).toEqual(["hello"]);
    expect(layouter.getCursorIndex()).toBe(5);
  });

  it("returns empty string when killLineFromCursor has nothing after the cursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello"],
      lineIndex: 0,
      cursorIndex: 5,
      width: 10,
      height: 1,
    });

    expect(layouter.killLineFromCursor()).toBe("");
    expect(layouter.getLines()).toEqual(["hello"]);
    expect(layouter.getCursorIndex()).toBe(5);
  });

  it("removes a middle empty logical line with killLineFromCursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "", "b"],
      lineIndex: 1,
      cursorIndex: 0,
      width: 10,
      height: 3,
    });

    expect(layouter.killLineFromCursor()).toBe("\n");
    expect(layouter.getLines()).toEqual(["a", "b"]);
    expect(layouter.getLineIndex()).toBe(1);
    expect(layouter.getCursorIndex()).toBe(0);
    expect(layouter.getText()).toBe("a\nb");
  });

  it("removes a trailing empty logical line with killLineFromCursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", ""],
      lineIndex: 1,
      cursorIndex: 0,
      width: 10,
      height: 2,
    });

    expect(layouter.killLineFromCursor()).toBe("\n");
    expect(layouter.getLines()).toEqual(["a"]);
    expect(layouter.getLineIndex()).toBe(0);
    expect(layouter.getCursorIndex()).toBe(1);
    expect(layouter.getText()).toBe("a");
  });

  it("does not remove the only empty logical line with killLineFromCursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: [""],
      lineIndex: 0,
      cursorIndex: 0,
      width: 10,
      height: 1,
    });

    expect(layouter.killLineFromCursor()).toBe("");
    expect(layouter.getLines()).toEqual([""]);
    expect(layouter.getLineIndex()).toBe(0);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("deletes the character at the cursor with deleteAfterCursor", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello"],
      lineIndex: 0,
      cursorIndex: 1,
      width: 10,
      height: 1,
    });

    expect(layouter.deleteAfterCursor()).not.toBeNull();
    expect(layouter.getLines()).toEqual(["hllo"]);
    expect(layouter.getCursorIndex()).toBe(1);
  });

  it("joins the next line when deleteAfterCursor is at end of line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["ab", "cd"],
      lineIndex: 0,
      cursorIndex: 2,
      width: 10,
      height: 2,
    });

    expect(layouter.deleteAfterCursor()).not.toBeNull();
    expect(layouter.getLines()).toEqual(["abcd"]);
    expect(layouter.getLineIndex()).toBe(0);
    expect(layouter.getCursorIndex()).toBe(2);
  });

  it("returns null when deleteAfterCursor is at end of the last line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hi"],
      lineIndex: 0,
      cursorIndex: 2,
      width: 10,
      height: 1,
    });

    expect(layouter.deleteAfterCursor()).toBeNull();
    expect(layouter.getLines()).toEqual(["hi"]);
    expect(layouter.getCursorIndex()).toBe(2);
  });

  it("moves the cursor down by page size in display rows", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d"],
      lineIndex: 0,
      cursorIndex: 0,
      width: 4,
      height: 2,
    });

    layouter.moveCursorPageDown(2);

    expect(layouter.getLineIndex()).toBe(2);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("snaps to the last display row on PageDown when fewer rows remain than page size", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d"],
      lineIndex: 2,
      cursorIndex: 0,
      width: 4,
      height: 2,
    });

    layouter.moveCursorPageDown(2);

    expect(layouter.getLineIndex()).toBe(3);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("moves the cursor up by page size in display rows", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d"],
      lineIndex: 3,
      cursorIndex: 0,
      width: 4,
      height: 2,
    });

    layouter.moveCursorPageUp(2);

    expect(layouter.getLineIndex()).toBe(1);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("snaps to the first display row on PageUp when fewer rows remain than page size", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d"],
      lineIndex: 1,
      cursorIndex: 0,
      width: 4,
      height: 2,
    });

    layouter.moveCursorPageUp(2);

    expect(layouter.getLineIndex()).toBe(0);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("scrolls the viewport by page size minus one row", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d", "e"],
      lineIndex: 0,
      cursorIndex: 0,
      width: 4,
      height: 2,
      scrollRowOffset: 0,
    });

    layouter.scrollPageDown(1);
    expect(layouter.getScrollRowOffset()).toBe(1);

    layouter.scrollPageUp(1);
    expect(layouter.getScrollRowOffset()).toBe(0);
  });

  it("inserts an empty logical line when Enter splits at the end of a line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello"],
      lineIndex: 0,
      cursorIndex: 5,
      width: 10,
      height: 3,
    });

    layouter.insertNewline();

    expect(layouter.getLines()).toEqual(["hello", ""]);
    expect(layouter.getText()).toBe("hello\n");
    expect(layouter.getLineIndex()).toBe(1);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("splits content at the cursor when Enter inserts a newline between text", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello world"],
      lineIndex: 0,
      cursorIndex: 5,
      width: 20,
      height: 3,
    });

    layouter.insertNewline();

    expect(layouter.getLines()).toEqual(["hello", " world"]);
    expect(layouter.getText()).toBe("hello\n world");
    expect(layouter.getLineIndex()).toBe(1);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("splits pasted CR-separated lines into logical lines", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: [""],
      width: 10,
      height: 4,
    });

    layouter.insertTextAtCursor("1\r2\r3");

    expect(layouter.getLines()).toEqual(["1", "2", "3"]);
    expect(layouter.getText()).toBe("1\n2\n3");
    expect(layouter.getLineIndex()).toBe(2);
    expect(layouter.getCursorIndex()).toBe(1);
  });

  it("splits pasted CRLF-separated lines into logical lines", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: [""],
      width: 10,
      height: 4,
    });

    layouter.insertTextAtCursor("1\r\n2\r\n3");

    expect(layouter.getLines()).toEqual(["1", "2", "3"]);
    expect(layouter.getText()).toBe("1\n2\n3");
  });

  it("preserves a blank line between content when building display rows", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["title", "", "body"],
      width: 10,
      height: 4,
    });

    expect(layouter.buildDisplayRows().map((row) => row.text)).toEqual([
      "title ",
      " ",
      "body ",
    ]);
    expect(layouter.getText()).toBe("title\n\nbody");
  });

  it("moves the cursor down across a blank line between content lines", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["title", "", "body"],
      lineIndex: 0,
      cursorIndex: 5,
      width: 10,
      height: 4,
    });

    layouter.moveCursorDown();

    expect(layouter.getLineIndex()).toBe(1);
    expect(layouter.getCursorIndex()).toBe(0);

    layouter.moveCursorDown();

    expect(layouter.getLineIndex()).toBe(2);
    expect(layouter.getCursorIndex()).toBe(0);
  });

  it("returns exactly height visible rows from layout", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["a", "b", "c", "d", "e"],
      lineIndex: 0,
      cursorIndex: 0,
      width: 4,
      height: 4,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "", cursorChar: "a", right: " ", isCursorRow: true },
        { left: "b ", cursorChar: "", right: "", isCursorRow: false },
        { left: "c ", cursorChar: "", right: "", isCursorRow: false },
        { left: "d ", cursorChar: "", right: "", isCursorRow: false },
      ],
    });
  });

  it("shows the cursor row inside the visible height window", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["one", "two", "three", "four", "five"],
      lineIndex: 4,
      cursorIndex: 3,
      width: 8,
      height: 2,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 3,
      visibleRows: [
        { left: "four ", cursorChar: "", right: "", isCursorRow: false },
        { left: "fiv", cursorChar: "e", right: " ", isCursorRow: true },
      ],
    });
  });

  it("shows a block cursor on an empty logical line after Enter", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["hello", ""],
      lineIndex: 1,
      cursorIndex: 0,
      width: 10,
      height: 2,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "hello ", cursorChar: "", right: "", isCursorRow: false },
        { left: "", cursorChar: "█", right: "", isCursorRow: true },
      ],
    });
  });

  it("shows a block cursor when the only line is empty", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: [""],
      lineIndex: 0,
      cursorIndex: 0,
      width: 10,
      height: 1,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "", cursorChar: "█", right: "", isCursorRow: true },
      ],
    });
  });

  it("keeps the last grapheme as cursorChar when the cursor sits on it", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["測試"],
      lineIndex: 0,
      cursorIndex: 1,
      width: 10,
      height: 1,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "測", cursorChar: "試", right: " ", isCursorRow: true },
      ],
    });
  });

  it("shows the cursor on the trailing space at end of line", () => {
    const layouter = new MultilineCursorTextLayouter({
      lines: ["測試"],
      lineIndex: 0,
      cursorIndex: 2,
      width: 10,
      height: 2,
    });

    expect(layouter.layout()).toEqual({
      scrollRowOffset: 0,
      visibleRows: [
        { left: "測試", cursorChar: " ", right: "", isCursorRow: true },
        { left: "", cursorChar: " ", right: "", isCursorRow: false },
      ],
    });
  });
});
