import { IssueCommentFormatter } from "../../../src/foundation/formatter/IssueCommentFormatter.ts";

describe("IssueCommentFormatter", () => {
  const at = new Date("2026-05-31T10:14:00");

  it("formats a comment block with two-space indentation on every line", () => {
    const block = IssueCommentFormatter.formatBlock(
      "Ben Lau",
      "I've been reviewing the Q3 numbers.",
      at,
    );

    const lines = block.split("\n");
    expect(lines.every((line) => line.startsWith("  "))).toBe(true);
    expect(lines[0]).toMatch(/^  > \*\*Ben Lau\*\* @ \*2026-05-31 /);
    expect(lines[1]).toBe("  >");
    expect(lines[2]).toBe("  > I've been reviewing the Q3 numbers.");
  });

  it("formats empty content lines as blank quoted lines", () => {
    const block = IssueCommentFormatter.formatBlock("A", "line one\n\nline three", at);
    const lines = block.split("\n");
    expect(lines[2]).toBe("  > line one");
    expect(lines[3]).toBe("  >");
    expect(lines[4]).toBe("  > line three");
  });
});
