export type CheckboxLineParseResult = {
  checked: boolean;
  checkboxStart: number;
  checkboxEnd: number;
};

const CHECKBOX_LINE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](.*)$/;
const WIKILINK_GLOBAL_PATTERN = /\[\[(.+?)\]\]/g;

export class MarkdownParser {
  static extractTitleFromMarkdown(content: string): string {
    const firstHeading = content
      .split(/\r?\n/)
      .find((line) => /^#\s+/.test(line));
    if (firstHeading) {
      const text = firstHeading.replace(/^#\s+/, "").trim();
      if (text) return text;
    }

    return "";
  }

  static parseCheckboxLine(line: string): CheckboxLineParseResult | null {
    const match = CHECKBOX_LINE.exec(line);
    if (!match) return null;

    const prefix = match[1]!;
    const mark = match[2]!;
    const checked = mark !== " ";
    const checkboxToken = `[${mark}]`;
    const checkboxStart = match.index! + prefix.length;
    const checkboxEnd = checkboxStart + checkboxToken.length;

    return { checked, checkboxStart, checkboxEnd };
  }

  static toggleCheckboxLine(line: string): string | null {
    const parsed = MarkdownParser.parseCheckboxLine(line);
    if (!parsed) return null;

    const nextMark = parsed.checked ? " " : "x";
    return (
      line.slice(0, parsed.checkboxStart) +
      `[${nextMark}]` +
      line.slice(parsed.checkboxEnd)
    );
  }

  /** Extract wiki-link targets from a line, deduped in first-seen order. */
  static extractWikiLinkTargets(line: string): string[] {
    const seen = new Set<string>();
    const targets: string[] = [];
    for (const match of line.matchAll(WIKILINK_GLOBAL_PATTERN)) {
      const target = match[1]?.trim() ?? "";
      if (target === "" || seen.has(target)) {
        continue;
      }
      seen.add(target);
      targets.push(target);
    }
    return targets;
  }
}
