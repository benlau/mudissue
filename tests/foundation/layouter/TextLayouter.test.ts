import { TextLayouter } from "../../../src/foundation/layouter/TextLayouter.ts";

describe("TextLayouter", () => {
  it("returns single segment when content is within width", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abc"]);

    expect(layouter.layout(10, 0)).toEqual({
      newCursorRowIndex: 0,
      formattedContent: ["abc"],
    });
  });

  it("preserves blank lines as one display row", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["x", "", "y"]);

    expect(layouter.layout(5, 0).formattedContent).toEqual(["x", "", "y"]);
  });

  it("splits long lines by display width", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abcdef"]);

    expect(layouter.layout(3, 0).formattedContent).toEqual(["abc", "def"]);
  });

  it("wraps an 11-character string at width 8", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["12345678901"]);

    expect(layouter.layout(8, 0).formattedContent).toEqual([
      "12345678",
      "901",
    ]);
  });

  it("uses string display width for wide characters", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["中a"]);

    expect(layouter.layout(2, 0).formattedContent).toEqual(["中", "a"]);
  });

  it("keeps one Chinese character on one row when width is narrower than the character", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["中"]);

    expect(layouter.layout(1, 0).formattedContent).toEqual(["中"]);
  });

  it("splits two Chinese characters into two rows when width is narrower than one character", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["中中"]);

    expect(layouter.layout(1, 0).formattedContent).toEqual(["中", "中"]);
  });

  it("returns normalized original lines when content width is non-positive", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["hello", "a\tb"]);

    expect(layouter.layout(0, 0).formattedContent).toEqual([
      "hello",
      "a  b",
    ]);
    expect(layouter.layout(-1, 0).formattedContent).toEqual([
      "hello",
      "a  b",
    ]);
  });

  it("converts tabs into two spaces before wrapping", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["a\tb"]);

    expect(layouter.layout(2, 0).formattedContent).toEqual(["a ", " b"]);
  });

  it("returns the cached formatted content when width is unchanged", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abcdef"]);

    const first = layouter.layout(3, 0);
    const second = layouter.layout(3, 1);

    expect(second.formattedContent).toBe(first.formattedContent);
    expect(second).toEqual({
      newCursorRowIndex: 1,
      formattedContent: ["abc", "def"],
    });
  });

  it("rescales the cursor row when width changes", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abcdef"]);

    expect(layouter.layout(3, 0)).toEqual({
      newCursorRowIndex: 0,
      formattedContent: ["abc", "def"],
    });
    expect(layouter.layout(2, 1)).toEqual({
      newCursorRowIndex: 2,
      formattedContent: ["ab", "cd", "ef"],
    });
  });

  it("maps wrapped display rows back to logical source line indices", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abcdef", "ghi"]);
    layouter.layout(3, 0);

    expect(layouter.getLogicalLineIndex(0)).toBe(0);
    expect(layouter.getLogicalLineIndex(1)).toBe(0);
    expect(layouter.getLogicalLineIndex(2)).toBe(1);
  });

  it("returns all display rows for a wrapped logical line", () => {
    const layouter = new TextLayouter();
    layouter.setContent(["abcdef", "ghi"]);
    layouter.layout(3, 0);

    expect(layouter.getDisplayRowsForLogicalLine(0)).toEqual([0, 1]);
    expect(layouter.getDisplayRowsForLogicalLine(1)).toEqual([2]);
  });
});
