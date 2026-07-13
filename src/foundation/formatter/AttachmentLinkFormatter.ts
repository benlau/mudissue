import * as path from "path";

const WIKILINK_PATTERN = /^\[\[(.+)\]\]$/;
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

export class AttachmentLinkFormatter {
  static formatAttachmentReference(filename: string): string {
    const base = path.basename(filename.trim());
    if (WIKILINK_PATTERN.test(base)) {
      return base;
    }
    const ext = path.extname(base);
    const name = ext ? base.slice(0, -ext.length) : base;
    if (TEXT_EXTENSIONS.has(ext.toLowerCase())) {
      return `[[${name}]]`;
    }
    return `[[${base}]]`;
  }

  static stripAttachmentReference(value: string): string {
    const trimmed = value.trim();
    const match = WIKILINK_PATTERN.exec(trimmed);
    return match ? match[1]! : trimmed;
  }

  static attachmentCompareKey(value: string): string {
    const stripped = AttachmentLinkFormatter.stripAttachmentReference(value);
    const ext = path.extname(stripped);
    if (TEXT_EXTENSIONS.has(ext.toLowerCase())) {
      return stripped.slice(0, -ext.length);
    }
    return stripped;
  }
}
