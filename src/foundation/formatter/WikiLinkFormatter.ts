import * as path from "path";

const WIKILINK_PATTERN = /^\[\[(.+)\]\]$/;
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

/** Characters that break Obsidian wikilink parsing inside the link target. */
const WIKILINK_ESCAPE_CHARS = /([#|^[\]])/g;

export class WikiLinkFormatter {
  /**
   * Wraps a link target as an Obsidian wikilink (`[[…]]`).
   * Escapes `# | ^ [ ]` in the target; does not double-wrap an existing wikilink.
   */
  static formatWikiLink(link: string): string {
    const trimmed = link.trim();
    if (WIKILINK_PATTERN.test(trimmed)) {
      return trimmed;
    }
    const escaped = trimmed.replace(WIKILINK_ESCAPE_CHARS, "\\$1");
    return `[[${escaped}]]`;
  }

  /**
   * Formats a file path/basename as a wikilink, omitting `.md` / `.txt`.
   */
  static formatFileLink(filename: string): string {
    const base = path.basename(filename.trim());
    if (WIKILINK_PATTERN.test(base)) {
      return WikiLinkFormatter.formatWikiLink(base);
    }
    const ext = path.extname(base);
    const name = TEXT_EXTENSIONS.has(ext.toLowerCase())
      ? base.slice(0, -ext.length)
      : base;
    return WikiLinkFormatter.formatWikiLink(name);
  }

  /** Removes surrounding `[[` `]]` from a wikilink; returns the value unchanged otherwise. */
  static stripWikiLink(value: string): string {
    const trimmed = value.trim();
    const match = WIKILINK_PATTERN.exec(trimmed);
    return match ? match[1]! : trimmed;
  }
}
