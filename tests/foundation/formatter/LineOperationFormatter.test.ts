import { LineOperationFormatter } from "../../../src/foundation/formatter/LineOperationFormatter.ts";
import type { LineOperation } from "../../../src/types/LineOperation.ts";

function makeOp(
  overrides: Partial<LineOperation> & Pick<LineOperation, "symbol" | "key">,
): LineOperation {
  return {
    kind: "checkbox",
    displayRows: [0],
    info: { kind: "checkbox", logicalLineIndexes: [0] },
    label: "op",
    action: async () => {},
    ...overrides,
  };
}

describe("LineOperationFormatter", () => {
  describe("getOperationsForRow", () => {
    it("returns only operations whose displayRows include the row", () => {
      const jump = makeOp({
        kind: "jump",
        symbol: "j",
        key: "j",
        displayRows: [2],
      });
      const unlink = makeOp({
        kind: "unlink",
        symbol: "-",
        key: "-",
        displayRows: [2],
      });
      const checkbox = makeOp({
        kind: "checkbox",
        symbol: "X",
        key: "x",
        displayRows: [5],
      });

      expect(
        LineOperationFormatter.getOperationsForRow(
          [jump, unlink, checkbox],
          2,
        ),
      ).toEqual([jump, unlink]);
      expect(
        LineOperationFormatter.getOperationsForRow(
          [jump, unlink, checkbox],
          5,
        ),
      ).toEqual([checkbox]);
      expect(
        LineOperationFormatter.getOperationsForRow(
          [jump, unlink, checkbox],
          0,
        ),
      ).toEqual([]);
    });
  });

  describe("formatPrefix", () => {
    it("returns empty string for no operations", () => {
      expect(LineOperationFormatter.formatPrefix([])).toEqual("");
    });

    it("returns the single symbol for one operation", () => {
      expect(
        LineOperationFormatter.formatPrefix([
          makeOp({ symbol: "-", key: "-" }),
        ]),
      ).toEqual("-");
    });

    it("concatenates symbols when there are two operations", () => {
      expect(
        LineOperationFormatter.formatPrefix([
          makeOp({ kind: "jump", symbol: "j", key: "j" }),
          makeOp({ kind: "unlink", symbol: "-", key: "-" }),
        ]),
      ).toEqual("j-");
    });

    it("returns @ when there are more than two operations", () => {
      expect(
        LineOperationFormatter.formatPrefix([
          makeOp({ symbol: "a", key: "a" }),
          makeOp({ symbol: "b", key: "b" }),
          makeOp({ symbol: "c", key: "c" }),
        ]),
      ).toEqual("@");
    });
  });

  describe("formatGutterPrefix", () => {
    it("pads a single-symbol prefix to PREFIX_WIDTH", () => {
      expect(
        LineOperationFormatter.formatGutterPrefix([
          makeOp({ symbol: "-", key: "-" }),
        ]),
      ).toEqual("- ");
    });

    it("leaves a two-symbol prefix unchanged", () => {
      expect(
        LineOperationFormatter.formatGutterPrefix([
          makeOp({ kind: "jump", symbol: "j", key: "j" }),
          makeOp({ kind: "unlink", symbol: "-", key: "-" }),
        ]),
      ).toEqual("j-");
    });

    it("pads @ to PREFIX_WIDTH", () => {
      expect(
        LineOperationFormatter.formatGutterPrefix([
          makeOp({ symbol: "a", key: "a" }),
          makeOp({ symbol: "b", key: "b" }),
          makeOp({ symbol: "c", key: "c" }),
        ]),
      ).toEqual("@ ");
    });
  });
});
