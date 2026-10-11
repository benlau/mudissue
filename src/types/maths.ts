/** Numeric helpers for shared clamping logic. */
export class Maths {
  /** Clamps `value` to the inclusive range `[min, max]`. */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
