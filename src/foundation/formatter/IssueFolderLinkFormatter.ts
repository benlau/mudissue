import type { IssueFileType } from "../../types/GlobalConfig.ts";

const WIKILINK_PATTERN = /^\[\[(.+)\]\]$/;

export class IssueFolderLinkFormatter {
  static formatFolderReference(
    folderName: string,
    pattern: IssueFileType,
  ): string {
    if (pattern === "fixed") {
      return folderName;
    }
    if (WIKILINK_PATTERN.test(folderName.trim())) {
      return folderName.trim();
    }
    return `[[${folderName}]]`;
  }

  static stripFolderReference(value: string): string {
    const trimmed = value.trim();
    const match = WIKILINK_PATTERN.exec(trimmed);
    return match ? match[1]! : trimmed;
  }
}
