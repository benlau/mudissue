import { ISSUE_FOLDER_NAME_MAX_LENGTH } from "../../constants.ts";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { Resource } from "./Resource.ts";
import { TemplateGenerator } from "../generators/TemplateGenerator.ts";
import { DateFormatter } from "../../foundation/formatter/DateFormatter.ts";
import { FileNameFormatter } from "../../foundation/formatter/FileNameFormatter.ts";
import { IssueFolderLinkFormatter } from "../../foundation/formatter/IssueFolderLinkFormatter.ts";
import type { IssueFileType } from "../../types/GlobalConfig.ts";
import { IssueMarkdownFileStorage } from "../storage/IssueMarkdownFileStorage.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import { MarkdownParser } from "../../foundation/parser/MarkdownParser.ts";

const TITLE_MAX_LENGTH = 64;

function truncateTitle(s: string): string {
  const t = s.trim();
  if (t.length <= TITLE_MAX_LENGTH) return t;
  return t.slice(0, TITLE_MAX_LENGTH);
}

type IssueResourceProps = {
  templateGenerator?: TemplateGenerator;
  getNow?: () => Date;
};

export class IssueResource extends Resource {
  static readonly resourceType = "issue";

  /**
   * Issue ID (folder basename) for a given label and display title (suffix from FileNameFormatter).
   * Call only when title is non-empty after trim (same contract as create).
   */
  static issueIdForTitle(label: string, title: string): string {
    const slug = FileNameFormatter.format(title.trim()) || "issue";
    const issueId = IssueResource.withSlug(label, slug);
    return BasicLayouter.truncatePathSegment(
      issueId,
      ISSUE_FOLDER_NAME_MAX_LENGTH,
    );
  }

  static async deriveTitleFromFile(filePath: string): Promise<string> {
    const sourceStorage = new IssueMarkdownFileStorage(filePath);
    await sourceStorage.load();
    const parsed = sourceStorage.getParsed();
    const frontmatterTitle =
      typeof parsed.frontmatter?.title === "string" &&
      parsed.frontmatter.title.trim() !== ""
        ? parsed.frontmatter.title.trim()
        : undefined;

    const headingTitle = MarkdownParser.extractTitleFromMarkdown(
      parsed.content,
    );

    const filenameTitle = (() => {
      const match = /([^/\\]+)$/.exec(filePath);
      const basename = match ? match[1] : filePath;
      const dotIndex = basename.lastIndexOf(".");
      const withoutExt =
        dotIndex !== -1 ? basename.slice(0, dotIndex) : basename;
      return withoutExt || "issue";
    })();

    const rawTitle =
      frontmatterTitle ??
      (headingTitle && headingTitle.trim() !== ""
        ? headingTitle.trim()
        : filenameTitle);

    return truncateTitle(rawTitle);
  }

  private templateGenerator: TemplateGenerator;
  private getNow: () => Date;

  constructor(props?: IssueResourceProps) {
    super();
    this.templateGenerator =
      props?.templateGenerator ?? new TemplateGenerator();
    this.getNow = props?.getNow ?? (() => new Date());
  }

  async create(
    issueFolder: IssueFolder,
    issueFilePath: string,
    title: string,
    parentFolderName?: string,
    defaultStatus?: string,
    defaultPriority?: string,
    issueFilePattern: IssueFileType = "fixed",
    content?: string,
  ): Promise<IssueFolder> {
    if (!title || title.trim() === "") {
      throw new Error("Issue title is required");
    }

    const created_at = DateFormatter.format(this.getNow());
    const template = this.templateGenerator.getTemplate("issue", {
      quotedTitle: JSON.stringify(title),
      title,
      created_at,
      status: defaultStatus ?? "open",
      priority: defaultPriority ?? "urgent",
    });
    if (!template) {
      throw new Error("Issue template not found");
    }

    await this.fileService.mkdir(issueFolder.path, { recursive: true });
    await this.fileService.writeFile(issueFilePath, template);

    const hasContent = content !== undefined && content.length > 0;
    if (parentFolderName || hasContent) {
      const storage = new IssueMarkdownFileStorage(issueFilePath);
      await storage.load();
      if (parentFolderName) {
        const parentRef = IssueFolderLinkFormatter.formatFolderReference(
          parentFolderName,
          issueFilePattern,
        );
        storage.setProperty("parent", parentRef);
      }
      if (hasContent) {
        storage.appendToContent(content);
      }
      await storage.save();
    }

    return {
      ...issueFolder,
      metadata: { ...issueFolder.metadata, title },
    };
  }

  async createFromFile(
    sourceFilePath: string,
    issueFolder: IssueFolder,
    issueFilePath: string,
    title: string,
  ): Promise<IssueFolder> {
    const sourceStorage = new IssueMarkdownFileStorage(sourceFilePath);
    await sourceStorage.load();
    const parsed = sourceStorage.getParsed();

    await this.fileService.mkdir(issueFolder.path, { recursive: true });
    await this.fileService.writeFile(issueFilePath, parsed.raw);

    return {
      ...issueFolder,
      metadata: { ...issueFolder.metadata, title },
    };
  }

  static withSlug(label: string, slug: string): string {
    if (label.endsWith(`-${slug}`)) {
      return label;
    }
    return `${label}-${slug}`;
  }
}
