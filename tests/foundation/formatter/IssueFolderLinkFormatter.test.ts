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
      expect(IssueFolderLinkFormatter.stripFolderReference("MI002-child")).toBe(
        "MI002-child",
      );
    });
  });

  describe("normalizeLinkageValues", () => {
    it("returns an empty list when the value is missing", () => {
      expect(
        IssueFolderLinkFormatter.normalizeLinkageValues(undefined),
      ).toEqual([]);
    });

    it("flattens a string or nested arrays into one list", () => {
      expect(
        IssueFolderLinkFormatter.normalizeLinkageValues("[[MI0001]]"),
      ).toEqual(["[[MI0001]]"]);
      expect(
        IssueFolderLinkFormatter.normalizeLinkageValues([
          "[[MI0001]]",
          ["[[MI0002]]"],
        ]),
      ).toEqual(["[[MI0001]]", "[[MI0002]]"]);
    });
  });

  describe("linkedFolderIds", () => {
    it("strips wikilinks from parent and subissue values", () => {
      expect(
        IssueFolderLinkFormatter.linkedFolderIds(["[[MI0002]]", "MI0003"]),
      ).toEqual(["MI0002", "MI0003"]);
    });
  });
});
