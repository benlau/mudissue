import * as path from "path";

export class IssueContentTextHelper {
  static deriveIssueTitleFromText(text: string): string {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed !== "") return trimmed;
    }
    return "";
  }

  static splitIssueText(text: string): { title: string; body?: string } {
    const lines = text.split("\n");
    const titleLineIndex = lines.findIndex((line) => line.trim() !== "");
    if (titleLineIndex < 0) {
      return { title: "" };
    }
    const title = lines[titleLineIndex]!.trim();
    const bodyLines = lines.slice(titleLineIndex + 1);
    const body = bodyLines.join("\n");
    return body.trim() === "" ? { title } : { title, body };
  }

  /** Filename for inline attachment content. Returns null for empty, `.`, or `..`. */
  static attachmentFilenameFromFirstLine(nameLine: string): string | null {
    const base = path.basename(nameLine.trim());
    if (base === "" || base === "." || base === "..") {
      return null;
    }
    return path.extname(base) ? base : `${base}.md`;
  }
}
