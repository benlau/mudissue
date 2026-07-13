import { AttachmentLinkFormatter } from "../../../src/foundation/formatter/AttachmentLinkFormatter.ts";

describe("AttachmentLinkFormatter", () => {
  describe("formatAttachmentReference", () => {
    it("omits extension for markdown files", () => {
      expect(AttachmentLinkFormatter.formatAttachmentReference("notes.md")).toEqual(
        "[[notes]]",
      );
    });

    it("omits extension for txt files", () => {
      expect(AttachmentLinkFormatter.formatAttachmentReference("readme.txt")).toEqual(
        "[[readme]]",
      );
    });

    it("includes extension for non-text files", () => {
      expect(
        AttachmentLinkFormatter.formatAttachmentReference("screenshot.png"),
      ).toEqual("[[screenshot.png]]");
    });

    it("is case-insensitive for text extensions", () => {
      expect(AttachmentLinkFormatter.formatAttachmentReference("Doc.MD")).toEqual(
        "[[Doc]]",
      );
      expect(AttachmentLinkFormatter.formatAttachmentReference("Doc.TXT")).toEqual(
        "[[Doc]]",
      );
    });

    it("does not double-wrap when already a wikilink", () => {
      expect(
        AttachmentLinkFormatter.formatAttachmentReference("[[notes]]"),
      ).toEqual("[[notes]]");
    });

    it("uses basename only when given a path", () => {
      expect(
        AttachmentLinkFormatter.formatAttachmentReference("/tmp/files/photo.jpg"),
      ).toEqual("[[photo.jpg]]");
    });
  });

  describe("stripAttachmentReference", () => {
    it("unwraps wikilink syntax", () => {
      expect(
        AttachmentLinkFormatter.stripAttachmentReference("[[screenshot.png]]"),
      ).toEqual("screenshot.png");
    });

    it("returns bare name unchanged", () => {
      expect(AttachmentLinkFormatter.stripAttachmentReference("notes")).toEqual(
        "notes",
      );
    });
  });

  describe("attachmentCompareKey", () => {
    it("maps text filenames and wikilinks to the same key", () => {
      expect(AttachmentLinkFormatter.attachmentCompareKey("notes.md")).toEqual(
        "notes",
      );
      expect(AttachmentLinkFormatter.attachmentCompareKey("[[notes]]")).toEqual(
        "notes",
      );
      expect(AttachmentLinkFormatter.attachmentCompareKey("notes.txt")).toEqual(
        "notes",
      );
    });

    it("keeps extension for non-text files", () => {
      expect(
        AttachmentLinkFormatter.attachmentCompareKey("[[screenshot.png]]"),
      ).toEqual("screenshot.png");
      expect(
        AttachmentLinkFormatter.attachmentCompareKey("screenshot.png"),
      ).toEqual("screenshot.png");
    });
  });
});
