import { jest } from "@jest/globals";
import { IssueFolderValidator } from "../../../src/utils/validators/IssueFolderValidator.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";

const mockIssueFolder = (issueId: string): IssueFolder => ({
  issueId,
  folderName: `folder-${issueId}`,
  path: `/fake/issues/${issueId}`,
});

describe("IssueFolderValidator", () => {
  describe("set", () => {
    it("stores value and returns this", () => {
      const folder = mockIssueFolder("1");
      const v = new IssueFolderValidator();
      const chain = v.set(folder);
      expect(chain).toBe(v);
      expect(v.first()).toBe(folder);
    });
  });

  describe("validateIssueNotNone", () => {
    it("throws ISSUE_NOT_FOUND when data is null", () => {
      const v = new IssueFolderValidator().set(null);
      expect(() => v.validateIssueNotNone()).toThrow();
      try {
        v.validateIssueNotNone();
      } catch (err: unknown) {
        const res = err as { status: string; error: { code: string } };
        expect(res.status).toBe("error");
        expect(res.error.code).toBe("ISSUE_NOT_FOUND");
      }
    });

    it("throws ISSUE_NOT_FOUND when data is undefined", () => {
      const v = new IssueFolderValidator().set(undefined);
      expect(() => v.validateIssueNotNone()).toThrow();
      try {
        v.validateIssueNotNone();
      } catch (err: unknown) {
        const res = err as { error: { code: string } };
        expect(res.error.code).toBe("ISSUE_NOT_FOUND");
      }
    });

    it("throws ISSUE_NOT_FOUND when data is empty array", () => {
      const v = new IssueFolderValidator().set([]);
      expect(() => v.validateIssueNotNone()).toThrow();
      try {
        v.validateIssueNotNone();
      } catch (err: unknown) {
        const res = err as { error: { code: string } };
        expect(res.error.code).toBe("ISSUE_NOT_FOUND");
      }
    });

    it("does not throw and returns this when data is single folder", () => {
      const folder = mockIssueFolder("1");
      const v = new IssueFolderValidator().set(folder);
      const chain = v.validateIssueNotNone();
      expect(chain).toBe(v);
    });

    it("does not throw and returns this when data is non-empty array", () => {
      const folders = [mockIssueFolder("1"), mockIssueFolder("2")];
      const v = new IssueFolderValidator().set(folders);
      const chain = v.validateIssueNotNone();
      expect(chain).toBe(v);
    });
  });

  describe("validateIssueNotMultiple", () => {
    it("throws ISSUE_MULTI_MATCHED when data is array with 2+ items", () => {
      const folders = [mockIssueFolder("1"), mockIssueFolder("2")];
      const v = new IssueFolderValidator().set(folders);
      expect(() => v.validateIssueNotMultiple()).toThrow();
      try {
        v.validateIssueNotMultiple();
      } catch (err: unknown) {
        const res = err as { status: string; error: { code: string } };
        expect(res.status).toBe("error");
        expect(res.error.code).toBe("ISSUE_MULTI_MATCHED");
      }
    });

    it("throws ISSUE_MULTI_MATCHED when data is array with 3 items", () => {
      const folders = [
        mockIssueFolder("1"),
        mockIssueFolder("2"),
        mockIssueFolder("3"),
      ];
      const v = new IssueFolderValidator().set(folders);
      expect(() => v.validateIssueNotMultiple()).toThrow();
    });

    it("does not throw and returns this when data is single folder", () => {
      const folder = mockIssueFolder("1");
      const v = new IssueFolderValidator().set(folder);
      const chain = v.validateIssueNotMultiple();
      expect(chain).toBe(v);
    });

    it("does not throw and returns this when data is single-item array", () => {
      const folders = [mockIssueFolder("1")];
      const v = new IssueFolderValidator().set(folders);
      const chain = v.validateIssueNotMultiple();
      expect(chain).toBe(v);
    });
  });

  describe("first", () => {
    it("returns single folder when set with one folder", () => {
      const folder = mockIssueFolder("1");
      const v = new IssueFolderValidator()
        .set(folder)
        .validateIssueNotNone();
      expect(v.first()).toBe(folder);
    });

    it("returns first element when set with array", () => {
      const folders = [mockIssueFolder("1"), mockIssueFolder("2")];
      const v = new IssueFolderValidator()
        .set(folders)
        .validateIssueNotNone();
      expect(v.first()).toBe(folders[0]);
    });
  });

  describe("chaining", () => {
    it("allows chaining set, validateIssueNotNone, validateIssueNotMultiple, and first", () => {
      const folder = mockIssueFolder("1");
      const result = new IssueFolderValidator()
        .set(folder)
        .validateIssueNotNone()
        .validateIssueNotMultiple()
        .first();
      expect(result).toBe(folder);
    });
  });
});
