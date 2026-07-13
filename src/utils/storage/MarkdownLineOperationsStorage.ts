import { MarkdownParser } from "../../foundation/parser/MarkdownParser.ts";
import { SAVE_DEBOUNCE_MS } from "../../constants.ts";
import { FileService } from "../../services/FileService.ts";
import type { LineRange } from "../../types/LineRange.ts";
import { clamp } from "../../types/maths.ts";

export const RELOAD_SUPPRESS_AFTER_SAVE_MS = 500;

export class MarkdownLineOperationsStorage {
  private readonly absPath: string;
  private readonly fileService: FileService;
  private lines: string[] = [""];
  private lastSavedText = "";
  private saveTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private pendingSave: Promise<void> | null = null;
  private reloadSuppressedUntil = 0;
  private onLinesChanged?: (lines: string[]) => void;
  private onSaved?: (mtime: Date) => void;

  constructor(absPath: string, fileService?: FileService) {
    this.absPath = absPath;
    this.fileService = fileService ?? FileService.getInstance();
  }

  setOnLinesChanged(callback: (lines: string[]) => void): void {
    this.onLinesChanged = callback;
  }

  setOnSaved(callback: (mtime: Date) => void): void {
    this.onSaved = callback;
  }

  getLines(): string[] {
    return this.lines;
  }

  setLines(lines: string[]): void {
    this.lines = lines;
    this.lastSavedText = lines.join("\n");
  }

  async loadFromDisk(): Promise<void> {
    const raw = (await this.fileService.readFile(
      this.absPath,
      "utf-8",
    )) as string;
    const normalized = raw.replace(/\r\n/g, "\n");
    const nextLines = normalized.length > 0 ? normalized.split("\n") : [""];
    this.lines = nextLines;
    this.lastSavedText = normalized;
  }

  async toggleCheckboxAtLine(logicalLineIndex: number): Promise<void> {
    const line = this.lines[logicalLineIndex];
    if (line === undefined) return;

    const nextLine = MarkdownParser.toggleCheckboxLine(line);
    if (nextLine === null) return;

    const nextLines = [...this.lines];
    nextLines[logicalLineIndex] = nextLine;
    this.lines = nextLines;
    this.reloadSuppressedUntil =
      Date.now() + SAVE_DEBOUNCE_MS + RELOAD_SUPPRESS_AFTER_SAVE_MS;
    this.onLinesChanged?.(this.lines);
    this.scheduleSave();
  }

  cutLineRange(range: LineRange): string[] {
    return this.replaceLineRange(range, []);
  }

  replaceLineRange(range: LineRange, replacementLines: string[]): string[] {
    if (this.lines.length === 0) {
      return [];
    }

    const maxIndex = this.lines.length - 1;
    const start = clamp(Math.min(range.start, range.end), 0, maxIndex);
    const end = clamp(Math.max(range.start, range.end), 0, maxIndex);
    const replacedLines = this.lines.slice(start, end + 1);
    const nextLines = [
      ...this.lines.slice(0, start),
      ...replacementLines,
      ...this.lines.slice(end + 1),
    ];
    this.lines = nextLines.length > 0 ? nextLines : [""];
    this.reloadSuppressedUntil =
      Date.now() + SAVE_DEBOUNCE_MS + RELOAD_SUPPRESS_AFTER_SAVE_MS;
    this.onLinesChanged?.(this.lines);
    this.scheduleSave();
    return replacedLines;
  }

  scheduleSave(): void {
    if (this.saveTimer != null) {
      globalThis.clearTimeout(this.saveTimer);
    }
    this.saveTimer = globalThis.setTimeout(() => {
      this.saveTimer = null;
      void this.saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  async saveNow(): Promise<void> {
    if (this.saveTimer != null) {
      globalThis.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.pendingSave) {
      await this.pendingSave;
    }

    const content = this.lines.join("\n");
    if (content === this.lastSavedText) return;

    this.pendingSave = (async () => {
      await this.fileService.writeFile(this.absPath, content, "utf-8");
      this.lastSavedText = content;
      const stat = await this.fileService.stat(this.absPath);
      this.onSaved?.(stat.mtime);
    })();

    try {
      await this.pendingSave;
    } finally {
      this.pendingSave = null;
    }
  }

  shouldSuppressReload(): boolean {
    return Date.now() < this.reloadSuppressedUntil;
  }
}
