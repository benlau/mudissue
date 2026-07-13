import stringWidth from "string-width";
import { BasicLayouter } from "../../../src/foundation/layouter/BasicLayouter.ts";

describe("BasicLayouter string width helpers", () => {
  it("pads short strings to target display width", () => {
    const padded = BasicLayouter.stringWidthPadEnd("ab", 6);
    expect(stringWidth(padded)).toBe(6);
    expect(padded.startsWith("ab")).toBe(true);
  });

  it("does not shorten strings wider than target", () => {
    const wide = "你好";
    expect(stringWidth(wide)).toBe(4);
    expect(BasicLayouter.stringWidthPadEnd(wide, 2)).toBe(wide);
  });

  it("truncate then pad yields exact width when possible", () => {
    const row = BasicLayouter.stringWidthPadEnd(
      BasicLayouter.stringWidthTruncateEnd("hello world", 8),
      8,
    );
    expect(stringWidth(row)).toBe(8);
  });

  it("truncateMiddle keeps start and end within max length", () => {
    expect(BasicLayouter.truncateMiddle("abcdefghijklmnopqrstuvwxyz", 10)).toBe(
      "abcde…wxyz",
    );
    expect(BasicLayouter.truncateMiddle("short", 10)).toBe("short");
  });

  it("truncatePathSegment hard-truncates from the end without ellipsis", () => {
    expect(BasicLayouter.truncatePathSegment("abcdefghijklmnopqrstuvwxyz", 10)).toBe(
      "abcdefghij",
    );
    expect(BasicLayouter.truncatePathSegment("short", 10)).toBe("short");
  });
});
