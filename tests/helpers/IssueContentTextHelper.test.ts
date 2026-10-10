import { IssueContentTextHelper } from "../../src/helpers/IssueContentTextHelper.ts";

describe("IssueContentTextHelper.deriveIssueTitleFromText", () => {
  it("returns the first non-empty line trimmed", () => {
    expect(
      IssueContentTextHelper.deriveIssueTitleFromText("\n  My title \nbody"),
    ).toBe("My title");
  });

  it("returns empty string when all lines are blank", () => {
    expect(IssueContentTextHelper.deriveIssueTitleFromText("\n \n")).toBe("");
  });
});

describe("IssueContentTextHelper.splitIssueText", () => {
  it("splits title and body after the first non-empty line", () => {
    expect(IssueContentTextHelper.splitIssueText("Title\n\nBody line")).toEqual(
      {
        title: "Title",
        body: "\nBody line",
      },
    );
  });

  it("returns title only when there is no body", () => {
    expect(IssueContentTextHelper.splitIssueText("Only title")).toEqual({
      title: "Only title",
    });
  });
});

describe("IssueContentTextHelper.attachmentFilenameFromFirstLine", () => {
  it("appends .md when the first line has no extension", () => {
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine("Meeting notes"),
    ).toBe("Meeting notes.md");
  });

  it("keeps an explicit extension", () => {
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine("notes.txt"),
    ).toBe("notes.txt");
  });

  it("uses only the basename when the line contains a path", () => {
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine("dir/My note"),
    ).toBe("My note.md");
  });

  it("returns null for empty, dot, or parent-directory names", () => {
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine("  "),
    ).toBeNull();
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine("."),
    ).toBeNull();
    expect(
      IssueContentTextHelper.attachmentFilenameFromFirstLine(".."),
    ).toBeNull();
  });
});
