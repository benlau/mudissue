import type { LineOperation } from "../../types/LineOperation.ts";

export class LineOperationFormatter {
  static readonly MULTI_OP_KEY = "@";
  static readonly PREFIX_WIDTH = 2;

  static getOperationsForRow(
    ops: LineOperation[],
    displayRow: number,
  ): LineOperation[] {
    return ops.filter((op) => op.displayRows.includes(displayRow));
  }

  static formatPrefix(ops: LineOperation[]): string {
    if (ops.length === 0) {
      return "";
    }
    if (ops.length > 2) {
      return LineOperationFormatter.MULTI_OP_KEY;
    }
    return ops.map((op) => op.symbol).join("");
  }

  /** Pads prefix to PREFIX_WIDTH for a fixed 2ch gutter. */
  static formatGutterPrefix(ops: LineOperation[]): string {
    return LineOperationFormatter.formatPrefix(ops).padEnd(
      LineOperationFormatter.PREFIX_WIDTH,
      " ",
    );
  }
}
