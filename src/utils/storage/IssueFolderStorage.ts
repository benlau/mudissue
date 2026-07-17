import * as path from "path";
import { FileService } from "../../services/FileService.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { IssueFileType } from "../../types/GlobalConfig.ts";
import { DateFormatter } from "../../foundation/formatter/DateFormatter.ts";
import { WikiLinkFormatter } from "../../foundation/formatter/WikiLinkFormatter.ts";
import { IssueFolderLinkFormatter } from "../../foundation/formatter/IssueFolderLinkFormatter.ts";
import { IssueCommentFormatter } from "../../foundation/formatter/IssueCommentFormatter.ts";
import { IssueMarkdownFileStorage } from "./IssueMarkdownFileStorage.ts";
import matter from "gray-matter";

export const ISSUE_ATTACHMENTS_DIR_NAME = "files";

export class IssueFolderStorage {
  private readonly issueFolder: IssueFolder;
  private readonly fileService: FileService;
  private cachedIssueMarkdownStorage: IssueMarkdownFileStorage | undefined;

  constructor(issueFolder: IssueFolder) {
    this.issueFolder = issueFolder;
    this.fileService = FileService.getInstance();
  }

  private async getLoadedIssueMarkdownStorage(): Promise<
    IssueMarkdownFileStorage | undefined
  > {
    if (this.cachedIssueMarkdownStorage !== undefined) {
      return this.cachedIssueMarkdownStorage;
    }

    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      return undefined;
    }

    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    this.cachedIssueMarkdownStorage = storage;
    return storage;
  }

  private async getIssueFileCreatedAt(): Promise<Date | undefined> {
    const storage = await this.getLoadedIssueMarkdownStorage();
    if (storage === undefined) {
      return undefined;
    }
    return storage.getCreatedAt();
  }

  private async getIssueFileUpdatedAt(): Promise<Date | undefined> {
    const storage = await this.getLoadedIssueMarkdownStorage();
    if (storage === undefined) {
      return undefined;
    }
    return storage.getUpdatedAt();
  }

  async findIssueFile(): Promise<string | undefined> {
    const dir = this.issueFolder.path;
    const label = this.issueFolder.label;
    const issueId = this.issueFolder.issueId;

    const checkedPaths = new Set<string>();

    const checkPath = async (p: string): Promise<string | undefined> => {
      if (checkedPaths.has(p)) return undefined;
      checkedPaths.add(p);
      if (await this.fileService.exists(p)) return p;
      return undefined;
    };

    const issueMd = path.join(dir, "issue.md");
    const r1 = await checkPath(issueMd);
    if (r1) return r1;

    const labelMd = path.join(dir, `${label}.md`);
    const r2 = await checkPath(labelMd);
    if (r2) return r2;

    if (issueId) {
      const idMd = path.join(dir, `${issueId}.md`);
      const r3 = await checkPath(idMd);
      if (r3) return r3;
    }

    const entries = await this.fileService.readdir(dir);
    const prefix = `${label}-`;
    const match = entries.find(
      (e) =>
        !e.isDirectory() && e.name.startsWith(prefix) && e.name.endsWith(".md"),
    );
    if (match) {
      return path.join(dir, match.name);
    }

    return undefined;
  }

  /**
   * Reads the content of the issue file. Throws if no issue file found.
   */
  async readIssue(): Promise<string> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    return (await this.fileService.readFile(filePath, "utf-8")) as string;
  }

  /**
   * Returns created_at: from frontmatter if valid, else file birthtime if file exists, else folder birthtime.
   */
  async getCreatedAt(): Promise<Date> {
    const fromFile = await this.getIssueFileCreatedAt();
    if (fromFile !== undefined) {
      return fromFile;
    }
    const stats = await this.fileService.stat(this.issueFolder.path);
    return stats.birthtime;
  }

  /**
   * Returns updated_at: from frontmatter if valid, else file mtime if file exists, else folder mtime.
   */
  async getUpdatedAt(): Promise<Date> {
    const fromFile = await this.getIssueFileUpdatedAt();
    if (fromFile !== undefined) {
      return fromFile;
    }
    const stats = await this.fileService.stat(this.issueFolder.path);
    return stats.mtime;
  }

  /**
   * Sets frontmatter updated_at to the current time (or the given instant) and saves.
   */
  async touchUpdatedAt(now: Date = new Date()): Promise<Date> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const formatted = DateFormatter.format(now);
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    storage.setProperty("updated_at", formatted);
    await storage.save();
    return DateFormatter.parse(formatted) ?? now;
  }

  /**
   * Sets frontmatter updated_at to candidate unless stored updated_at is already newer
   * (e.g. concurrent edit while TextEditDialog was open).
   */
  async touchUpdatedAtIfNotSuperseded(candidate: Date): Promise<Date | null> {
    const current = await this.getUpdatedAt();
    if (current.getTime() > candidate.getTime()) {
      return null;
    }
    return this.touchUpdatedAt(candidate);
  }

  async setParent(
    parentFolderName: string,
    issueFilePattern: IssueFileType,
  ): Promise<void> {
    await this.applyLinkage("parent", parentFolderName, issueFilePattern);
  }

  /**
   * Appends the given folder name to this issue's frontmatter subissues array.
   */
  async appendSubissue(
    newFolderName: string,
    issueFilePattern: IssueFileType,
  ): Promise<void> {
    await this.applyLinkage("subissues", newFolderName, issueFilePattern);
  }

  /**
   * Removes the given folder name from this issue's frontmatter subissues field.
   */
  async removeSubissue(
    folderName: string,
    issueFilePattern: IssueFileType,
  ): Promise<void> {
    await this.removeLinkage("subissues", folderName, issueFilePattern);
  }

  /**
   * Removes the given folder name from this issue's frontmatter parent field.
   */
  async clearParent(
    parentFolderName: string,
    issueFilePattern: IssueFileType,
  ): Promise<void> {
    await this.removeLinkage("parent", parentFolderName, issueFilePattern);
  }

  /**
   * Applies a linkage reference to the given frontmatter field.
   * First link writes a string; subsequent links promote to a list.
   */
  async applyLinkage(
    field: string,
    targetFolderName: string,
    issueFilePattern: IssueFileType,
  ): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const entry = IssueFolderLinkFormatter.formatFolderReference(
      targetFolderName,
      issueFilePattern,
    );
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    const { frontmatter } = storage.getParsed();
    const existing = frontmatter[field];
    const next = IssueFolderStorage.mergeApplyLinkage(
      existing,
      entry,
      targetFolderName,
    );
    if (next === undefined) {
      return;
    }
    storage.setProperty(field, next);
    await storage.save();
  }

  /**
   * Removes a linkage reference from the given frontmatter field.
   */
  async removeLinkage(
    field: string,
    targetFolderName: string,
    _issueFilePattern: IssueFileType,
  ): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    const { frontmatter } = storage.getParsed();
    const existing = frontmatter[field];
    const next = IssueFolderStorage.mergeRemoveLinkage(
      existing,
      targetFolderName,
    );
    if (next === null) {
      storage.removeProperty(field);
    } else if (next !== undefined) {
      storage.setProperty(field, next);
    }
    await storage.save();
  }

  /**
   * Flattens a linkage frontmatter value into a string list.
   * Frontmatter may store one link as a string (`"[[0001]]"`) or several as an
   * array (`["[[0001]]", "[[0002]]"]`); callers get a uniform `string[]`.
   * Missing/invalid values become `[]`.
   */
  static normalizeLinkageValues(existing: unknown): string[] {
    const collect = (value: unknown): string[] => {
      if (typeof value === "string") {
        return [value];
      }
      if (Array.isArray(value)) {
        return value.flatMap(collect);
      }
      return [];
    };
    if (existing === undefined) {
      return [];
    }
    return collect(existing);
  }

  static mergeApplyLinkage(
    existing: unknown,
    entry: string,
    targetFolderName: string,
  ): string | string[] | undefined {
    const values = IssueFolderStorage.normalizeLinkageValues(existing);
    if (values.length === 0) {
      return entry;
    }
    const alreadyPresent = values.some(
      (s) =>
        IssueFolderLinkFormatter.stripFolderReference(s) === targetFolderName,
    );
    if (alreadyPresent) {
      return undefined;
    }
    if (values.length === 1) {
      return [values[0], entry];
    }
    return [...values, entry];
  }

  static mergeRemoveLinkage(
    existing: unknown,
    targetFolderName: string,
  ): string | string[] | null | undefined {
    const values = IssueFolderStorage.normalizeLinkageValues(existing);
    if (values.length === 0) {
      return undefined;
    }
    const filtered = values.filter(
      (s) =>
        IssueFolderLinkFormatter.stripFolderReference(s) !== targetFolderName,
    );
    if (filtered.length === values.length) {
      return undefined;
    }
    if (filtered.length === 0) {
      return null;
    }
    if (filtered.length === 1) {
      return filtered[0];
    }
    return filtered;
  }

  getAttachmentsDir(): string {
    return path.join(this.issueFolder.path, ISSUE_ATTACHMENTS_DIR_NAME);
  }

  async ensureAttachmentsDir(): Promise<string> {
    const dir = this.getAttachmentsDir();
    await this.fileService.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Returns absolute paths for the requested kinds of issue-folder files.
   * Attachment paths are derived from the frontmatter attachments field (no readdir).
   */
  async listFiles(
    options: { attachments?: boolean; issueMarkdownFile?: boolean } = {
      attachments: true,
    },
  ): Promise<string[]> {
    const paths: string[] = [];

    const issueFilePath = await this.findIssueFile();

    if (options.attachments) {
      if (issueFilePath === undefined) {
        throw new Error(`No issue file found in ${this.issueFolder.path}`);
      }
      const content = (await this.fileService.readFile(
        issueFilePath,
        "utf-8",
      )) as string;
      const parsed = matter(content);
      const refs: string[] = Array.isArray(parsed.data.attachments)
        ? parsed.data.attachments.filter(
            (x): x is string => typeof x === "string",
          )
        : [];
      const attachmentsDir = this.getAttachmentsDir();
      for (const ref of refs) {
        const resolved = await this.resolveAttachmentPath(attachmentsDir, ref);
        if (resolved !== undefined) {
          paths.push(resolved);
        }
      }
    }

    if (options.issueMarkdownFile && issueFilePath !== undefined) {
      paths.push(issueFilePath);
    }

    return paths;
  }

  /**
   * Maps an attachment frontmatter/wikilink ref to an on-disk path under files/.
   * Extension-less refs (md/txt wikilinks) resolve via exists to .md then .txt.
   */
  async resolveAttachmentRef(ref: string): Promise<string | undefined> {
    return this.resolveAttachmentPath(this.getAttachmentsDir(), ref);
  }

  /**
   * Maps an attachment frontmatter ref to an on-disk path under attachmentsDir.
   * Extension-less refs (md/txt wikilinks) resolve via exists to .md then .txt.
   */
  private async resolveAttachmentPath(
    attachmentsDir: string,
    ref: string,
  ): Promise<string | undefined> {
    const stripped = WikiLinkFormatter.stripWikiLink(ref);
    const ext = path.extname(stripped);
    if (ext) {
      const candidate = path.join(attachmentsDir, stripped);
      return (await this.fileService.exists(candidate)) ? candidate : undefined;
    }
    for (const textExt of [".md", ".txt"] as const) {
      const candidate = path.join(attachmentsDir, `${stripped}${textExt}`);
      if (await this.fileService.exists(candidate)) {
        return candidate;
      }
    }
    return undefined;
  }

  /**
   * Removes attachments listed in frontmatter, then the issue markdown and folder.
   * When dryRun is true, returns the paths that would be removed without deleting.
   */
  async remove(options?: { dryRun?: boolean }): Promise<string[] | null> {
    const dryRun = options?.dryRun === true;
    const removed: string[] = [];

    const attachments = await this.listFiles({ attachments: true });
    if (attachments.length > 0) {
      for (const filePath of attachments) {
        if (!dryRun) {
          await this.fileService.rm(filePath);
        }
        removed.push(filePath);
      }

      if (attachments.length > 0) {
        const attachmentsDir = this.getAttachmentsDir();
        if (!dryRun) {
          await this.fileService.rmdir(attachmentsDir);
        }
        removed.push(attachmentsDir);
      }
    }

    const issueFile = await this.findIssueFile();
    if (issueFile === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    if (!dryRun) {
      await this.fileService.rm(issueFile);
    }
    removed.push(issueFile);
    if (!dryRun) {
      await this.fileService.rmdir(this.issueFolder.path);
    }
    removed.push(this.issueFolder.path);
    return removed;
  }

  /**
   * Appends the given attachment filenames to this issue's frontmatter attachments array
   * as Obsidian wikilinks (md/txt omit extension; other types keep it).
   */
  async appendAttachments(newAttachmentNames: string[]): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const content = (await this.fileService.readFile(
      filePath,
      "utf-8",
    )) as string;
    const parsed = matter(content);
    const attachments: string[] = Array.isArray(parsed.data.attachments)
      ? [...parsed.data.attachments].filter((x) => typeof x === "string")
      : [];
    const existingKeys = new Set(
      attachments.map((a) => WikiLinkFormatter.stripWikiLink(a)),
    );
    for (const name of newAttachmentNames) {
      const ref = WikiLinkFormatter.formatFileLink(name);
      const key = WikiLinkFormatter.stripWikiLink(ref);
      if (!existingKeys.has(key)) {
        attachments.push(ref);
        existingKeys.add(key);
      }
    }
    parsed.data.attachments = attachments;
    const updated = matter.stringify(parsed.content, parsed.data);
    await this.fileService.writeFile(filePath, updated);
  }

  /**
   * Appends the given tag names to this issue's frontmatter tags array.
   */
  async appendTags(newTagNames: string[]): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    const { frontmatter } = storage.getParsed();
    const existing = frontmatter.tags;
    let tags: string[] = Array.isArray(existing)
      ? existing.filter((v) => typeof v === "string")
      : typeof existing === "string"
        ? [existing]
        : [];
    for (const name of newTagNames) {
      if (!tags.includes(name)) {
        tags.push(name);
      }
    }
    storage.setProperty("tags", tags);
    await storage.save();
  }

  /**
   * Appends a formatted comment block to this issue's markdown body.
   */
  async appendComment(
    author: string,
    content: string,
    at: Date = new Date(),
  ): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    const block = IssueCommentFormatter.formatBlock(author, content, at);
    storage.appendToContent(block);
    await storage.save();
  }

  /**
   * Appends raw markdown text to this issue's body (after frontmatter).
   */
  async appendContent(content: string): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    storage.appendToContent(content);
    await storage.save();
  }

  /**
   * Prepends raw markdown text to this issue's body (after frontmatter).
   */
  async prependContent(content: string): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    storage.prependToContent(content);
    await storage.save();
  }

  /**
   * Removes the given tag names from this issue's frontmatter tags array.
   * Removes the tags key when the array becomes empty.
   */
  async removeTags(tagNames: string[]): Promise<void> {
    const filePath = await this.findIssueFile();
    if (filePath === undefined) {
      throw new Error(`No issue file found in ${this.issueFolder.path}`);
    }
    const storage = new IssueMarkdownFileStorage(filePath);
    await storage.load();
    const { frontmatter } = storage.getParsed();
    const existing = frontmatter.tags;
    let tags: string[] = Array.isArray(existing)
      ? existing.filter((v) => typeof v === "string")
      : typeof existing === "string"
        ? [existing]
        : [];
    const toRemove = new Set(tagNames);
    tags = tags.filter((t) => !toRemove.has(t));
    if (tags.length === 0) {
      storage.removeProperty("tags");
    } else {
      storage.setProperty("tags", tags);
    }
    await storage.save();
  }
}
