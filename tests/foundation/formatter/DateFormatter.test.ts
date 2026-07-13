import { jest } from "@jest/globals";
import { DateFormatter } from "../../../src/foundation/formatter/DateFormatter.ts";

describe("DateFormatter", () => {
  describe("format", () => {
    it("formats date as YYYY-MM-DD HH:mm +ZZ:ZZ (no seconds)", () => {
      const date = new Date(2026, 0, 15, 14, 30, 0);
      const formatted = DateFormatter.format(date);
      expect(formatted).toEqual("2026-01-15 14:30 Z");
    });

    it("round-trips with parse", () => {
      const date = new Date(2026, 0, 15, 10, 5, 30);
      const formatted = DateFormatter.format(date);
      const parsed = DateFormatter.parse(formatted);
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(date.getFullYear());
      expect(parsed!.getMonth()).toBe(date.getMonth());
      expect(parsed!.getDate()).toBe(date.getDate());
      expect(parsed!.getHours()).toBe(date.getHours());
      expect(parsed!.getMinutes()).toBe(date.getMinutes());
    });

    it("formats with log_timestamp type as yyyyMMdd-HHmmss", () => {
      const date = new Date(2026, 0, 15, 14, 5, 30);
      const formatted = DateFormatter.format(date, "log_timestamp");
      expect(formatted).toBe("20260115-140530");
    });
  });

  describe("parse", () => {
    it("parses YYYY-MM-DD HH:mm +ZZ:ZZ", () => {
      const str = "2026-01-15 14:30 +08:00";
      const date = DateFormatter.parse(str);
      expect(date).not.toBeNull();
      expect(date!.getUTCFullYear()).toBe(2026);
      expect(date!.getUTCMonth()).toBe(0);
      expect(date!.getUTCDate()).toBe(15);
      expect(date!.getUTCHours()).toBe(6); // 14:30 +08:00 => 06:30 UTC
      expect(date!.getUTCMinutes()).toBe(30);
    });

    it("returns null for clearly invalid input", () => {
      expect(DateFormatter.parse("")).toBeNull();
      expect(DateFormatter.parse("not-a-date")).toBeNull();
    });

    it("parses negative timezone offset", () => {
      const str = "2026-01-15 10:00:00 -05:00";
      const date = DateFormatter.parse(str);
      expect(date).not.toBeNull();
      expect(date!.getUTCFullYear()).toBe(2026);
      expect(date!.getUTCMonth()).toBe(0);
      expect(date!.getUTCDate()).toBe(15);
      expect(date!.getUTCHours()).toBe(15); // 10:00 -05:00 => 15:00 UTC
    });

    it("auto-detects year-month-first formats without second argument", () => {
      const dateOnly = DateFormatter.parse("2026-02-18");
      expect(dateOnly).not.toBeNull();
      expect(dateOnly!.getFullYear()).toBe(2026);
      expect(dateOnly!.getMonth()).toBe(1);
      expect(dateOnly!.getDate()).toBe(18);

      const dateTime = DateFormatter.parse("2026-02-18 10:20:30");
      expect(dateTime).not.toBeNull();
      expect(dateTime!.getFullYear()).toBe(2026);
      expect(dateTime!.getMonth()).toBe(1);
      expect(dateTime!.getDate()).toBe(18);
    });

    it("uses explicit format when provided (even for non year-month-first)", () => {
      const date = DateFormatter.parse("15/01/2026", "dd/MM/yyyy");
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(0);
      expect(date!.getDate()).toBe(15);
    });

    it("falls back to built-in Date when no explicit format matches", () => {
      const date = DateFormatter.parse("March 10, 2026");
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(2); // March
      expect(date!.getDate()).toBe(10);
    });
  });
});
