import { jest } from "@jest/globals";
import { FrontmatterValidator } from "../../../src/async/validators/FrontmatterValidator.ts";

describe("FrontmatterValidator", () => {
  describe("isValidPropertyKey", () => {
    it("returns true for alphanumeric keys", () => {
      expect(FrontmatterValidator.isValidPropertyKey("status")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("author")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("id123")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("123")).toBe(true);
    });

    it("returns true for keys with underscore", () => {
      expect(FrontmatterValidator.isValidPropertyKey("issue_id")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("_private")).toBe(true);
    });

    it("returns true for keys with hyphen", () => {
      expect(FrontmatterValidator.isValidPropertyKey("some-key")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("my-property")).toBe(true);
    });

    it("returns true for single character", () => {
      expect(FrontmatterValidator.isValidPropertyKey("a")).toBe(true);
      expect(FrontmatterValidator.isValidPropertyKey("1")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(FrontmatterValidator.isValidPropertyKey("")).toBe(false);
    });

    it("returns false for keys with spaces", () => {
      expect(FrontmatterValidator.isValidPropertyKey("my key")).toBe(false);
      expect(FrontmatterValidator.isValidPropertyKey(" ")).toBe(false);
    });

    it("returns false for keys with invalid characters", () => {
      expect(FrontmatterValidator.isValidPropertyKey("key.with.dots")).toBe(false);
      expect(FrontmatterValidator.isValidPropertyKey("key:value")).toBe(false);
      expect(FrontmatterValidator.isValidPropertyKey("key[0]")).toBe(false);
      expect(FrontmatterValidator.isValidPropertyKey("key/slash")).toBe(false);
    });

    it("returns false for non-string input", () => {
      expect(FrontmatterValidator.isValidPropertyKey(null as any)).toBe(false);
      expect(FrontmatterValidator.isValidPropertyKey(undefined as any)).toBe(false);
    });
  });
});
