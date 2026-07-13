import { IssueFolderLinkFormatter } from "../../../src/foundation/formatter/IssueFolderLinkFormatter.ts";

describe("IssueFolderLinkFormatter", () => {
  describe("formatFolderReference", () => {
    it("wraps folder name for long pattern", () => {
      expect(
        IssueFolderLinkFormatter.formatFolderReference("MI002-child", "long"),
      ).toBe("[[MI002-child]]");
    });

    it("wraps folder name for short pattern", () => {
      expect(
        IssueFolderLinkFormatter.formatFolderReference("MI002-child", "short"),
      ).toBe("[[MI002-child]]");
    });

    it("leaves folder name unchanged for fixed pattern", () => {
      expect(
        IssueFolderLinkFormatter.formatFolderReference("MI002-child", "fixed"),
      ).toBe("MI002-child");
    });

    it("does not double-wrap when already a wikilink", () => {
      expect(
        IssueFolderLinkFormatter.formatFolderReference(
          "[[MI002-child]]",
          "long",
        ),
      ).toBe("[[MI002-child]]");
    });
  });

  describe("stripFolderReference", () => {
    it("unwraps wikilink syntax", () => {
      expect(
        IssueFolderLinkFormatter.stripFolderReference("[[MI002-child]]"),
      ).toBe("MI002-child");
    });

    it("returns bare folder name unchanged", () => {
      expect(
        IssueFolderLinkFormatter.stripFolderReference("MI002-child"),
      ).toBe("MI002-child");
    });
  });
});
