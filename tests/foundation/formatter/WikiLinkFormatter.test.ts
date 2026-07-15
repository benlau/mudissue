import { WikiLinkFormatter } from "../../../src/foundation/formatter/WikiLinkFormatter.ts";

describe("WikiLinkFormatter", () => {
  describe("formatWikiLink", () => {
    it("wraps a bare target in wikilink brackets", () => {
      expect(WikiLinkFormatter.formatWikiLink("notes")).toEqual("[[notes]]");
    });

    it("does not double-wrap when already a wikilink", () => {
      expect(WikiLinkFormatter.formatWikiLink("[[notes]]")).toEqual("[[notes]]");
    });

    it("escapes characters that break wikilink parsing", () => {
      expect(WikiLinkFormatter.formatWikiLink("a#b")).toEqual("[[a\\#b]]");
      expect(WikiLinkFormatter.formatWikiLink("a|b")).toEqual("[[a\\|b]]");
      expect(WikiLinkFormatter.formatWikiLink("a^b")).toEqual("[[a\\^b]]");
      expect(WikiLinkFormatter.formatWikiLink("a[b]c")).toEqual("[[a\\[b\\]c]]");
    });
  });

  describe("formatFileLink", () => {
    it("omits extension for markdown files", () => {
      expect(WikiLinkFormatter.formatFileLink("notes.md")).toEqual("[[notes]]");
    });

    it("omits extension for txt files", () => {
      expect(WikiLinkFormatter.formatFileLink("readme.txt")).toEqual(
        "[[readme]]",
      );
    });

    it("includes extension for non-text files", () => {
      expect(WikiLinkFormatter.formatFileLink("screenshot.png")).toEqual(
        "[[screenshot.png]]",
      );
    });

    it("is case-insensitive for text extensions", () => {
      expect(WikiLinkFormatter.formatFileLink("Doc.MD")).toEqual("[[Doc]]");
      expect(WikiLinkFormatter.formatFileLink("Doc.TXT")).toEqual("[[Doc]]");
    });

    it("does not double-wrap when already a wikilink", () => {
      expect(WikiLinkFormatter.formatFileLink("[[notes]]")).toEqual("[[notes]]");
    });

    it("uses basename only when given a path", () => {
      expect(WikiLinkFormatter.formatFileLink("/tmp/files/photo.jpg")).toEqual(
        "[[photo.jpg]]",
      );
    });
  });

  describe("stripWikiLink", () => {
    it("unwraps wikilink syntax", () => {
      expect(WikiLinkFormatter.stripWikiLink("[[screenshot.png]]")).toEqual(
        "screenshot.png",
      );
    });

    it("returns bare name unchanged", () => {
      expect(WikiLinkFormatter.stripWikiLink("notes")).toEqual("notes");
    });
  });
});
