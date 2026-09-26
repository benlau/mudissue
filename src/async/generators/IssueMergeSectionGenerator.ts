import { MarkdownParser } from "../../foundation/parser/MarkdownParser.ts";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";
import { FileService } from "../../services/FileService.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import { IssueFolderStorage } from "../storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../storage/IssueMarkdownFileStorage.ts";
import { TemplateGenerator } from "./TemplateGenerator.ts";

const MERGE_SECTION_SEPARATOR = `\n\n${"-".repeat(40)}\n\n`;

function deriveIssueTitle(
  folderName: string,
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  const frontmatterTitle =
    typeof frontmatter.title === "string" && frontmatter.title.trim() !== ""
      ? frontmatter.title.trim()
      : undefined;

  const headingTitle = MarkdownParser.extractTitleFromMarkdown(content);
  const folderSuffix =
    IssueSelectorMatcher.extractIssueSuffix(folderName) ?? folderName;

  return (
    frontmatterTitle ??
    (headingTitle && headingTitle.trim() !== ""
      ? headingTitle.trim()
      : folderSuffix)
  );
}

export class IssueMergeSectionGenerator {
  private readonly templateGenerator = new TemplateGenerator();

  private get fileService(): FileService {
    return FileService.getInstance();
  }

  async deriveTitle(issue: IssueFolder): Promise<string> {
    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();
    if (issueFilePath === undefined) {
      throw new Error(`No issue file found in ${issue.path}`);
    }

    const storage = new IssueMarkdownFileStorage(issueFilePath);
    await storage.load();
    const parsed = storage.getParsed();
    return deriveIssueTitle(issue.issueId, parsed.frontmatter, parsed.content);
  }

  async renderSection(issue: IssueFolder): Promise<string> {
    const folderStorage = new IssueFolderStorage(issue);
    const issueFilePath = await folderStorage.findIssueFile();
    if (issueFilePath === undefined) {
      throw new Error(`No issue file found in ${issue.path}`);
    }

    const storage = new IssueMarkdownFileStorage(issueFilePath);
    await storage.load();
    const parsed = storage.getParsed();

    const rendered = this.templateGenerator.getTemplate("issue-merge-section", {
      issue_folder_name: issue.issueId,
      full_content: parsed.raw.trimEnd(),
    });
    if (rendered === undefined) {
      throw new Error('Missing template "issue-merge-section".');
    }
    return rendered;
  }

  async renderMergedContent(issues: IssueFolder[]): Promise<string> {
    const sections = await Promise.all(
      issues.map((issue) => this.renderSection(issue)),
    );
    return sections
      .map((section) => section.trimEnd())
      .join(MERGE_SECTION_SEPARATOR);
  }
}
