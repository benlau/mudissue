import { jest } from "@jest/globals";
import { IssueMergeSectionGenerator } from "../../../src/async/generators/IssueMergeSectionGenerator.ts";
import { IssueFolderStorage } from "../../../src/async/storage/IssueFolderStorage.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { createMockSystemContext } from "../../fixture/MockSystemContext.tsx";

const buildIssueFolder = (issueId: string, label: string): IssueFolder => ({
  issueId,
  label,
  path: `/repo/issues/${issueId}`,
});

const SECTION_SEPARATOR = `\n\n${"-".repeat(40)}\n\n`;

describe("IssueMergeSectionGenerator", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
  });

  it("renders a merge section with issue folder name and full markdown content", async () => {
    const issue = buildIssueFolder("0001-alpha", "0001");
    const fullContent = [
      "---",
      'title: "Alpha issue"',
      "status: open",
      "priority: urgent",
      'created_at: "2026-01-01"',
      "---",
      "",
      "# Alpha issue",
      "",
      "First paragraph.",
    ].join("\n");
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0001-alpha/issue.md");
    fileService.readFile.mockResolvedValue(fullContent);

    const generator = new IssueMergeSectionGenerator();
    const result = await generator.renderSection(issue);

    expect(result).toEqual(
      ["0001-alpha", "--------", "", fullContent, ""].join("\n"),
    );
  });

  it("joins multiple issue sections with a separator between them", async () => {
    const issues = [
      buildIssueFolder("0001-alpha", "0001"),
      buildIssueFolder("0002-beta", "0002"),
    ];
    const generator = new IssueMergeSectionGenerator();
    const renderSectionSpy = jest
      .spyOn(generator, "renderSection")
      .mockResolvedValueOnce("Section one\n")
      .mockResolvedValueOnce("Section two\n");

    const result = await generator.renderMergedContent(issues);

    expect(result).toBe(`Section one${SECTION_SEPARATOR}Section two`);
    expect(renderSectionSpy).toHaveBeenCalledTimes(2);
  });

  it("derives title from frontmatter when present", async () => {
    const issue = buildIssueFolder("0001-alpha", "0001");
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/0001-alpha/issue.md");
    fileService.readFile.mockResolvedValue(
      "---\ntitle: From frontmatter\nstatus: open\n---\n\nBody",
    );

    const generator = new IssueMergeSectionGenerator();
    const title = await generator.deriveTitle(issue);

    expect(title).toBe("From frontmatter");
  });
});
