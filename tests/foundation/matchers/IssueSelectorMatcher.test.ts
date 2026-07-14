import { IssueSelectorMatcher } from "../../../src/foundation/matchers/IssueSelectorMatcher.ts";

describe("IssueSelectorMatcher", () => {
  describe("isIssueNumber", () => {
    it("returns true for numeric-only strings", () => {
      expect(IssueSelectorMatcher.isIssueNumber("1")).toBe(true);
      expect(IssueSelectorMatcher.isIssueNumber("002")).toBe(true);
      expect(IssueSelectorMatcher.isIssueNumber("0003")).toBe(true);
    });

    it("returns false for non-numeric or mixed strings", () => {
      expect(IssueSelectorMatcher.isIssueNumber("FN004")).toBe(false);
      expect(IssueSelectorMatcher.isIssueNumber("PR-005")).toBe(false);
      expect(IssueSelectorMatcher.isIssueNumber("0003-any")).toBe(false);
      expect(IssueSelectorMatcher.isIssueNumber("")).toBe(false);
    });

    it("trims input before validation", () => {
      expect(IssueSelectorMatcher.isIssueNumber("  002  ")).toBe(true);
    });
  });

  describe("isIssueLabel", () => {
    it("returns true for valid labels (digits or prefix + digits)", () => {
      expect(IssueSelectorMatcher.isIssueLabel("1")).toBe(true);
      expect(IssueSelectorMatcher.isIssueLabel("002")).toBe(true);
      expect(IssueSelectorMatcher.isIssueLabel("FN004")).toBe(true);
      expect(IssueSelectorMatcher.isIssueLabel("PR-005")).toBe(true);
      expect(IssueSelectorMatcher.isIssueLabel("PX_006")).toBe(true);
    });

    it("returns false for invalid labels", () => {
      expect(IssueSelectorMatcher.isIssueLabel("0003-any")).toBe(false);
      expect(IssueSelectorMatcher.isIssueLabel("no-digits")).toBe(false);
      expect(IssueSelectorMatcher.isIssueLabel("FN001extra")).toBe(false);
      expect(IssueSelectorMatcher.isIssueLabel("")).toBe(false);
    });

    it("trims input before validation", () => {
      expect(IssueSelectorMatcher.isIssueLabel("  FN004  ")).toBe(true);
    });
  });

  describe("isIssueId", () => {
    it("returns true for valid issue IDs including suffix", () => {
      expect(IssueSelectorMatcher.isIssueId("1")).toBe(true);
      expect(IssueSelectorMatcher.isIssueId("FN004")).toBe(true);
      expect(IssueSelectorMatcher.isIssueId("0003-any string char")).toBe(true);
      expect(IssueSelectorMatcher.isIssueId("PR-005-any stringchar")).toBe(true);
    });

    it("returns false for invalid issue IDs", () => {
      expect(IssueSelectorMatcher.isIssueId("")).toBe(false);
      expect(IssueSelectorMatcher.isIssueId("no-digits")).toBe(false);
      expect(IssueSelectorMatcher.isIssueId("FN001extra")).toBe(false);
    });
  });

  describe("isValidateFolderName", () => {
    it("returns true for numeric-only folder names", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("1")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("002")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("0003")).toBe(true);
    });

    it("returns true for prefix + number", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("FN004")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("PR-005")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("PX_006")).toBe(true);
    });

    it("returns true for folder name with suffix after hyphen", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("0003-any string char")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("PR-005-any stringchar")).toBe(true);
      expect(IssueSelectorMatcher.isValidateFolderName("PX_006-any stringchar")).toBe(true);
    });

    it("returns false for empty or non-issue names", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("")).toBe(false);
      expect(IssueSelectorMatcher.isValidateFolderName("no-digits")).toBe(false);
      expect(IssueSelectorMatcher.isValidateFolderName("abc")).toBe(false);
    });

    it("returns false when prefix contains non-[a-zA-Z_-] characters", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("FN001extra")).toBe(false);
      expect(IssueSelectorMatcher.isValidateFolderName("PR.005")).toBe(false);
      expect(IssueSelectorMatcher.isValidateFolderName("X 001")).toBe(false);
    });

    it("trims input before validation", () => {
      expect(IssueSelectorMatcher.isValidateFolderName("  002  ")).toBe(true);
    });
  });

  describe("extractIssueLabel", () => {
    it("returns label (prefix + num) for valid folders", () => {
      expect(IssueSelectorMatcher.extractIssueLabel("1")).toBe("1");
      expect(IssueSelectorMatcher.extractIssueLabel("002")).toBe("002");
      expect(IssueSelectorMatcher.extractIssueLabel("0003-any string char")).toBe("0003");
      expect(IssueSelectorMatcher.extractIssueLabel("FN004")).toBe("FN004");
      expect(IssueSelectorMatcher.extractIssueLabel("PR-005-any stringchar")).toBe("PR-005");
      expect(IssueSelectorMatcher.extractIssueLabel("PX_006-any stringchar")).toBe("PX_006");
    });

    it("returns null for invalid folder names", () => {
      expect(IssueSelectorMatcher.extractIssueLabel("")).toBe(null);
      expect(IssueSelectorMatcher.extractIssueLabel("no-digits")).toBe(null);
    });
  });

  describe("extractIssueId", () => {
    it("returns full folder basename as issue ID for valid folders", () => {
      expect(IssueSelectorMatcher.extractIssueId("1")).toBe("1");
      expect(IssueSelectorMatcher.extractIssueId("002")).toBe("002");
      expect(IssueSelectorMatcher.extractIssueId("0003-any string char")).toBe(
        "0003-any string char",
      );
      expect(IssueSelectorMatcher.extractIssueId("FN004")).toBe("FN004");
      expect(IssueSelectorMatcher.extractIssueId("PR-005-any stringchar")).toBe(
        "PR-005-any stringchar",
      );
    });

    it("returns null for invalid folder names", () => {
      expect(IssueSelectorMatcher.extractIssueId("")).toBe(null);
      expect(IssueSelectorMatcher.extractIssueId("no-digits")).toBe(null);
    });
  });

  describe("extractIssueSuffix", () => {
    it("returns suffix for folders with hyphen suffix", () => {
      expect(IssueSelectorMatcher.extractIssueSuffix("0001-foo")).toBe("foo");
      expect(IssueSelectorMatcher.extractIssueSuffix("PR-005-bar")).toBe("bar");
      expect(IssueSelectorMatcher.extractIssueSuffix("0003-any string char")).toBe("any string char");
    });

    it("returns null when no suffix or invalid", () => {
      expect(IssueSelectorMatcher.extractIssueSuffix("0001")).toBe(null);
      expect(IssueSelectorMatcher.extractIssueSuffix("")).toBe(null);
      expect(IssueSelectorMatcher.extractIssueSuffix("no-digits")).toBe(null);
    });
  });

  describe("isSameIssueNumber", () => {
    it("returns true when numeric part matches", () => {
      expect(IssueSelectorMatcher.isSameIssueNumber("005", "005")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueNumber("PR-005", "005")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueNumber("PR-005-foo", "005-bar")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueNumber("FN004", "004")).toBe(true);
    });

    it("returns false when numeric part differs", () => {
      expect(IssueSelectorMatcher.isSameIssueNumber("004", "005")).toBe(false);
      expect(IssueSelectorMatcher.isSameIssueNumber("PR-005", "006")).toBe(false);
    });

    it("returns false when either folder is invalid", () => {
      expect(IssueSelectorMatcher.isSameIssueNumber("005", "invalid")).toBe(false);
      expect(IssueSelectorMatcher.isSameIssueNumber("invalid", "005")).toBe(false);
    });
  });

  describe("isSameIssueLabel", () => {
    it("returns true when prefix and numeric part match", () => {
      expect(IssueSelectorMatcher.isSameIssueLabel("MI309", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueLabel("MI0309", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueLabel("MI00309", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueLabel("PR-005-foo", "PR-005")).toBe(true);
      expect(IssueSelectorMatcher.isSameIssueLabel("FN004", "FN4")).toBe(true);
    });

    it("returns false when prefix differs", () => {
      expect(IssueSelectorMatcher.isSameIssueLabel("MI0309", "309")).toBe(false);
      expect(IssueSelectorMatcher.isSameIssueLabel("005-foo", "PR-005")).toBe(false);
    });

    it("returns false when numeric part differs", () => {
      expect(IssueSelectorMatcher.isSameIssueLabel("MI0309", "MI0310")).toBe(false);
      expect(IssueSelectorMatcher.isSameIssueLabel("PR-005", "PR-006")).toBe(false);
    });

    it("returns false when either folder is invalid", () => {
      expect(IssueSelectorMatcher.isSameIssueLabel("MI309", "invalid")).toBe(false);
      expect(IssueSelectorMatcher.isSameIssueLabel("invalid", "MI309")).toBe(false);
    });
  });

  describe("match", () => {
    it("returns false when folderName is invalid", () => {
      expect(IssueSelectorMatcher.match("", "0001")).toBe(false);
      expect(IssueSelectorMatcher.match("no-digits", "0001")).toBe(false);
    });

    it("returns true when folderName === issueSelector", () => {
      expect(IssueSelectorMatcher.match("0001-rename", "0001-rename")).toBe(true);
      expect(IssueSelectorMatcher.match("0001", "0001")).toBe(true);
    });

    it("returns true when extracted label matches", () => {
      expect(IssueSelectorMatcher.match("0001-rename", "0001")).toBe(true);
      expect(IssueSelectorMatcher.match("PR-005-foo", "PR-005")).toBe(true);
    });

    it("returns true when the issue number matches", () => {
      expect(IssueSelectorMatcher.match("0001-rename", "0001")).toBe(true);
      expect(IssueSelectorMatcher.match("PR-005-foo", "005")).toBe(true);
      expect(IssueSelectorMatcher.match("PR-005-foo", "5")).toBe(true);
    });

    it("returns true when the label matches", () => {
      expect(IssueSelectorMatcher.match("PR-005-foo", "PR-005")).toBe(true);
      expect(IssueSelectorMatcher.match("005-foo", "PR-005")).toBe(false);
    });

    it("returns false when only suffix matches across different labels", () => {
      expect(IssueSelectorMatcher.match("0001-foo", "0002-foo")).toBe(false);
      expect(IssueSelectorMatcher.match("PR-005-same", "006-same")).toBe(false);
    });

    it("returns false when no condition met", () => {
      expect(IssueSelectorMatcher.match("0001-rename", "0002")).toBe(false);
      expect(IssueSelectorMatcher.match("0001-foo", "0002-bar")).toBe(false);
    });

    it("matches exact folder when selector includes a suffix", () => {
      expect(
        IssueSelectorMatcher.match(
          "0001-duplicated-issue-number-bug",
          "0001-duplicated-issue-number-bug",
        ),
      ).toBe(true);
    });

    it("does not match other folders that share only the suffix", () => {
      const selector = "AB0001-hello123";
      expect(IssueSelectorMatcher.match("AB0001-hello123", selector)).toBe(
        true,
      );
      expect(IssueSelectorMatcher.match("0060-hello123", selector)).toBe(
        false,
      );
      expect(IssueSelectorMatcher.match("AB0002-hello123", selector)).toBe(
        false,
      );
    });

    it("matches when selector suffix is a prefix of folder suffix for same label", () => {
      expect(
        IssueSelectorMatcher.match("MI252-hello-world", "MI252-hello-w"),
      ).toBe(true);
      expect(
        IssueSelectorMatcher.match("0001-duplicated-issue-number-bug", "0001-duplicated-issue"),
      ).toBe(true);
    });

    it("does not match when selector suffix is not a prefix for same label", () => {
      expect(IssueSelectorMatcher.match("MI252-hello-world", "MI252-other")).toBe(
        false,
      );
    });

    it("partial issue number still matches all folders with the same number", () => {
      expect(
        IssueSelectorMatcher.match("0001-duplicated-issue-number-bug", "1"),
      ).toBe(true);
      expect(
        IssueSelectorMatcher.match("0001-rename-to-mudissue", "1"),
      ).toBe(true);
    });

    it("matches zero-padded folders when prefixed selector omits padding", () => {
      expect(IssueSelectorMatcher.match("MI0309", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.match("MI00309", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.match("MI0309-suffix", "MI309")).toBe(true);
      expect(IssueSelectorMatcher.match("MI00309-suffix", "MI309")).toBe(true);
    });

    it("does not match bare numeric folders when selector has prefix", () => {
      expect(IssueSelectorMatcher.match("309", "MI309")).toBe(false);
      expect(IssueSelectorMatcher.match("309-suffix", "MI309")).toBe(false);
      expect(IssueSelectorMatcher.match("0309", "MI309")).toBe(false);
      expect(IssueSelectorMatcher.match("0309-suffix", "MI309")).toBe(false);
    });

    it("matches padded folders with exact suffix when selector includes suffix", () => {
      expect(IssueSelectorMatcher.match("MI0309-suffix", "MI309-suffix")).toBe(
        true,
      );
      expect(IssueSelectorMatcher.match("MI00309-suffix", "MI309-suffix")).toBe(
        true,
      );
    });

    it("does not match padded folders with different suffix when selector includes suffix", () => {
      expect(
        IssueSelectorMatcher.match("MI00309-longer-suffix", "MI309-suffix"),
      ).toBe(false);
      expect(
        IssueSelectorMatcher.match("MI0309-suffix-longer", "MI309-suffix"),
      ).toBe(false);
    });
  });
});
