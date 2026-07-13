import stringWidth from "string-width";
import { TableLayouter } from "../../../src/foundation/layouter/TableLayouter.ts";

describe("TableLayouter", () => {
  it("calculates min and max table width including column gaps", () => {
    const layouter = new TableLayouter([
      { minWidth: 2, maxWidth: 4 },
      { minWidth: 3 },
    ]);

    expect(layouter.getMinMaxWidth()).toEqual({
      minWidth: 6,
      maxWidth: Number.MAX_SAFE_INTEGER,
    });
  });

  it("distributes extra width according to grow ratio", () => {
    const layouter = new TableLayouter([
      { minWidth: 2, grow: 1 },
      { minWidth: 2, grow: 3 },
    ]);

    expect(layouter.layout(13)).toEqual([4, 8]);
  });

  it("preserves minimum widths when available width is too small", () => {
    const layouter = new TableLayouter([
      { minWidth: 4 },
      { minWidth: 5 },
    ]);

    expect(layouter.layout(3)).toEqual([4, 5]);
  });

  it("does not grow a column beyond max width", () => {
    const layouter = new TableLayouter([
      { minWidth: 2, maxWidth: 3, grow: 1 },
      { minWidth: 2, grow: 1 },
    ]);

    expect(layouter.layout(8)).toEqual([3, 4]);
  });

  it("returns the cached layout when available width has not changed", () => {
    const layouter = new TableLayouter([
      { minWidth: 2, grow: 1 },
      { minWidth: 2, grow: 1 },
    ]);

    const firstLayout = layouter.layout(9);
    const cachedLayout = layouter.layout(9);
    const nextLayout = layouter.layout(10);

    expect(cachedLayout).toBe(firstLayout);
    expect(nextLayout).not.toBe(firstLayout);
  });

  it("truncates and pads row values by ellipsis direction", () => {
    const layouter = new TableLayouter([
      { minWidth: 4, ellipsisDirection: "right" },
      { minWidth: 4, ellipsisDirection: "left" },
    ]);

    layouter.layout(9);

    expect(layouter.makeRow(["abcdef", "abcdef"])).toBe("abc… …def");
  });

  it("measures wide characters using string-width", () => {
    const layouter = new TableLayouter([{ minWidth: 4 }]);

    layouter.layout(4);
    const row = layouter.makeRow(["界a"]);

    expect(stringWidth(row)).toBe(4);
    expect(row).toBe("界a ");
  });
});
