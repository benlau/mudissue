import matter from "gray-matter";
import { DateFormatter } from "../../foundation/formatter/DateFormatter.ts";
import { FileService } from "../../services/FileService.ts";

type CachedState = {
  frontmatter: Record<string, unknown>;
  content: string;
  raw: string;
  parseError: boolean;
};

function newEmptyCache(): CachedState {
  return {
    frontmatter: {},
    content: "",
    raw: "",
    parseError: false,
  };
}

export class IssueMarkdownFileStorage {
  private readonly absPath: string;
  private readonly fileService: FileService;
  private cache: CachedState = newEmptyCache();

  constructor(absPath: string) {
    this.absPath = absPath;
    this.fileService = FileService.getInstance();
  }

  clear(): void {
    this.cache = newEmptyCache();
  }

  loadFromRaw(raw: string): void {
    try {
      const parsed = matter(raw);
      this.cache = {
        frontmatter: (parsed.data ?? {}) as Record<string, unknown>,
        content: parsed.content ?? "",
        raw,
        parseError: false,
      };
    } catch {
      this.cache = {
        frontmatter: {},
        content: raw,
        raw,
        parseError: true,
      };
    }
  }

  async load(): Promise<void> {
    const raw = (await this.fileService.readFile(
      this.absPath,
      "utf-8",
    )) as string;
    this.loadFromRaw(raw);
  }

  getStatus(): string | undefined {
    const state = this.cache;
    if (state.parseError) {
      return "PARSE_ERROR";
    }
    const value = state.frontmatter.status;
    if (value == null) {
      return undefined;
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return undefined;
  }

  getPriority(): string | undefined {
    const state = this.cache;
    if (state.parseError) {
      return "PARSE_ERROR";
    }
    const value = state.frontmatter.priority;
    if (value == null) {
      return undefined;
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return undefined;
  }

  private parseFrontmatterDate(key: string): Date | undefined {
    const state = this.cache;
    if (state.parseError) {
      return undefined;
    }
    const value = state.frontmatter[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (value != null && typeof value === "string") {
      const parsedDate = DateFormatter.parse(value.trim());
      if (parsedDate !== null) {
        return parsedDate;
      }
    }
    return undefined;
  }

  async getCreatedAt(): Promise<Date> {
    const fromFrontmatter = this.parseFrontmatterDate("created_at");
    if (fromFrontmatter !== undefined) {
      return fromFrontmatter;
    }
    const stats = await this.fileService.stat(this.absPath);
    return stats.birthtime;
  }

  async getUpdatedAt(): Promise<Date> {
    const fromFrontmatter = this.parseFrontmatterDate("updated_at");
    if (fromFrontmatter !== undefined) {
      return fromFrontmatter;
    }
    const stats = await this.fileService.stat(this.absPath);
    return stats.mtime;
  }

  getTags(): string[] {
    const state = this.cache;
    if (state.parseError) {
      return [];
    }
    const value = state.frontmatter.tags;
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === "string");
    }
    if (typeof value === "string") {
      return [value];
    }
    return [];
  }

  getProperty<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const state = this.cache;
    if (state.parseError) {
      return defaultValue;
    }
    const value = state.frontmatter[key];
    if (value === undefined) {
      return defaultValue;
    }
    if (defaultValue === undefined) {
      return value as T;
    }
    if (value === null) return defaultValue;
    const defaultType = typeof defaultValue;
    if (
      defaultType === "string" ||
      defaultType === "number" ||
      defaultType === "boolean"
    ) {
      if (typeof value !== defaultType) return defaultValue;
    }
    return value as T;
  }

  setProperty(key: string, value: unknown): void {
    const state = this.cache;
    const nextFrontmatter: Record<string, unknown> = {
      ...state.frontmatter,
      [key]: value,
    };
    this.cache = {
      ...state,
      frontmatter: nextFrontmatter,
    };
  }

  removeProperty(key: string): void {
    const state = this.cache;
    const nextFrontmatter = { ...state.frontmatter };
    delete nextFrontmatter[key];
    this.cache = {
      ...state,
      frontmatter: nextFrontmatter,
    };
  }

  appendToContent(block: string): void {
    const state = this.cache;
    const trimmed = state.content.trimEnd();
    const separator = trimmed === "" ? "" : "\n\n";
    this.cache = {
      ...state,
      content: `${trimmed}${separator}${block}\n`,
    };
  }

  prependToContent(block: string): void {
    const state = this.cache;
    const trimmed = state.content.trimStart();
    this.cache = {
      ...state,
      content:
        trimmed === ""
          ? `${block.trimEnd()}\n`
          : `${block.trimEnd()}\n\n${trimmed}`,
    };
  }

  async save(): Promise<void> {
    const state = this.cache;
    const body = state.parseError ? state.raw : state.content;
    const updated = matter.stringify(body, state.frontmatter);
    await this.fileService.writeFile(this.absPath, updated);
    this.cache = {
      frontmatter: { ...state.frontmatter },
      content: body,
      raw: updated,
      parseError: false,
    };
  }

  getParsed(): {
    status?: string;
    frontmatter: Record<string, unknown>;
    content: string;
    raw: string;
  } {
    const state = this.cache;
    return {
      status: this.getStatus(),
      frontmatter: state.frontmatter,
      content: state.content,
      raw: state.raw,
    };
  }
}
