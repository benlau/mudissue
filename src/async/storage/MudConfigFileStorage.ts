import { parseDocument, stringify, type Document } from "yaml";
import { FileService } from "../../services/FileService.ts";

export class MudConfigFileStorage {
  private readonly absPath: string;
  private readonly fileService: FileService;
  private doc: Document | null = null;

  constructor(absPath: string) {
    this.absPath = absPath;
    this.fileService = FileService.getInstance();
  }

  async load(): Promise<void> {
    const raw = (await this.fileService.readFile(
      this.absPath,
      "utf-8",
    )) as string;
    this.doc = parseDocument(raw);
  }

  getProperty<T = unknown>(key: string): T | undefined {
    if (this.doc === null) {
      throw new Error("MudConfigFileStorage not loaded");
    }
    if (!this.doc.has(key)) {
      return undefined;
    }
    const js = this.doc.toJS() as Record<string, unknown> | null | undefined;
    if (js == null || typeof js !== "object" || Array.isArray(js)) {
      return undefined;
    }
    return js[key] as T;
  }

  setProperty(key: string, value: unknown): void {
    if (this.doc === null) {
      throw new Error("MudConfigFileStorage not loaded");
    }
    this.doc.set(key, value);
  }

  async save(): Promise<void> {
    if (this.doc === null) {
      throw new Error("MudConfigFileStorage not loaded");
    }
    const content = stringify(this.doc);
    await this.fileService.writeFile(this.absPath, content);
  }
}
