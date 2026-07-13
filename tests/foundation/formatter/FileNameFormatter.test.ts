import { jest } from "@jest/globals";
import { FileNameFormatter } from "../../../src/foundation/formatter/FileNameFormatter.ts";

describe("FileNameFormatter", () => {
  describe("format", () => {
    it("replaces spaces with dash and lowercases", () => {
      expect(FileNameFormatter.format("Test issue")).toBe("test-issue");
      expect(FileNameFormatter.format("a b c")).toBe("a-b-c");
    });

    it("replaces forbidden filename chars with dash", () => {
      expect(FileNameFormatter.format("a/b")).toBe("a-b");
      expect(FileNameFormatter.format("a*b?c")).toBe("a-b-c");
      expect(FileNameFormatter.format('a"b')).toBe("a-b");
      expect(FileNameFormatter.format("a<b>c")).toBe("a-b-c");
      expect(FileNameFormatter.format("a|c")).toBe("a-c");
      expect(FileNameFormatter.format("a:b")).toBe("a-b");
      expect(FileNameFormatter.format("a\\b")).toBe("a-b");
      expect(FileNameFormatter.format("a&b")).toBe("a-b");
    });

    it("replaces square brackets with dash for wikilink compatibility", () => {
      expect(FileNameFormatter.format("a[b]c")).toBe("a-b-c");
      expect(FileNameFormatter.format("[[wiki]]")).toBe("wiki");
      expect(FileNameFormatter.format("Fix [auth] bug")).toBe("fix-auth-bug");
    });

    it("replaces dots and parentheses with dash", () => {
      expect(FileNameFormatter.format("a.b")).toBe("a-b");
      expect(FileNameFormatter.format("fix (auth) bug")).toBe("fix-auth-bug");
      expect(FileNameFormatter.format("MI0301-.-should-…in-issue-folder")).toBe(
        "mi0301-should-…in-issue-folder",
      );
    });

    it("collapses continuous dashes into one", () => {
      expect(FileNameFormatter.format("a   b")).toBe("a-b");
      expect(FileNameFormatter.format("a - b")).toBe("a-b");
      expect(FileNameFormatter.format("a/b/c")).toBe("a-b-c");
    });

    it("trims leading and trailing dashes and lowercases", () => {
      expect(FileNameFormatter.format("  Hello  ")).toBe("hello");
      expect(FileNameFormatter.format(" - X - ")).toBe("x");
    });

    it("preserves non-Latin characters and lowercases Latin", () => {
      expect(FileNameFormatter.format("中文问题")).toBe("中文问题");
      expect(FileNameFormatter.format("修复 Bug")).toBe("修复-bug");
      expect(FileNameFormatter.format("日本語 タイトル")).toBe("日本語-タイトル");
    });

    it("returns empty string when input is empty or only whitespace/forbidden", () => {
      expect(FileNameFormatter.format("")).toBe("");
      expect(FileNameFormatter.format("   ")).toBe("");
      expect(FileNameFormatter.format("---")).toBe("");
      expect(FileNameFormatter.format(" /:*?\"<>| ")).toBe("");
    });

    it("converts uppercase to lowercase", () => {
      expect(FileNameFormatter.format("UPPERCASE")).toBe("uppercase");
      expect(FileNameFormatter.format("Fix Bug")).toBe("fix-bug");
    });
  });
});
