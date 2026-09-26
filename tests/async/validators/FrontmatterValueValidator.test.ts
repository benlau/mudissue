import { FrontmatterValueValidator } from "../../../src/async/validators/FrontmatterValueValidator.ts";

describe("FrontmatterValueValidator", () => {
  describe("isValidType", () => {
    test("accepts string, boolean, and number", () => {
      expect(FrontmatterValueValidator.isValidType("string")).toBe(true);
      expect(FrontmatterValueValidator.isValidType("boolean")).toBe(true);
      expect(FrontmatterValueValidator.isValidType("number")).toBe(true);
    });

    test("rejects unknown types", () => {
      expect(FrontmatterValueValidator.isValidType("array")).toBe(false);
      expect(FrontmatterValueValidator.isValidType("")).toBe(false);
    });
  });

  describe("coerce", () => {
    test("string returns the raw value unchanged", () => {
      expect(FrontmatterValueValidator.coerce("string", "hello")).toEqual({
        ok: true,
        value: "hello",
      });
      expect(FrontmatterValueValidator.coerce("string", "42")).toEqual({
        ok: true,
        value: "42",
      });
      expect(FrontmatterValueValidator.coerce("string", "")).toEqual({
        ok: true,
        value: "",
      });
    });

    test("boolean coerces yes/no/true/false/1/0 case-insensitively", () => {
      expect(FrontmatterValueValidator.coerce("boolean", "yes")).toEqual({
        ok: true,
        value: true,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "YES")).toEqual({
        ok: true,
        value: true,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "true")).toEqual({
        ok: true,
        value: true,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "1")).toEqual({
        ok: true,
        value: true,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "no")).toEqual({
        ok: true,
        value: false,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "FALSE")).toEqual({
        ok: true,
        value: false,
      });
      expect(FrontmatterValueValidator.coerce("boolean", "0")).toEqual({
        ok: true,
        value: false,
      });
    });

    test("boolean rejects invalid values", () => {
      expect(FrontmatterValueValidator.coerce("boolean", "maybe")).toEqual({
        ok: false,
        argument: "value",
        code: "invalid_boolean",
      });
    });

    test("number coerces numeric strings", () => {
      expect(FrontmatterValueValidator.coerce("number", "42")).toEqual({
        ok: true,
        value: 42,
      });
      expect(FrontmatterValueValidator.coerce("number", "3.14")).toEqual({
        ok: true,
        value: 3.14,
      });
      expect(FrontmatterValueValidator.coerce("number", "-7")).toEqual({
        ok: true,
        value: -7,
      });
    });

    test("number rejects empty, whitespace-only, and NaN inputs", () => {
      expect(FrontmatterValueValidator.coerce("number", "")).toEqual({
        ok: false,
        argument: "value",
        code: "invalid_number",
      });
      expect(FrontmatterValueValidator.coerce("number", "   ")).toEqual({
        ok: false,
        argument: "value",
        code: "invalid_number",
      });
      expect(FrontmatterValueValidator.coerce("number", "abc")).toEqual({
        ok: false,
        argument: "value",
        code: "invalid_number",
      });
    });

    test("rejects unknown type", () => {
      expect(FrontmatterValueValidator.coerce("array", "x")).toEqual({
        ok: false,
        argument: "type",
        code: "invalid_type",
      });
    });
  });
});
