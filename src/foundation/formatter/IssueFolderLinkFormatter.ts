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

  static linkedFolderIds(existing: unknown): string[] {
    return IssueFolderLinkFormatter.normalizeLinkageValues(existing)
      .map((value) => IssueFolderLinkFormatter.stripFolderReference(value))
      .filter((value) => value.length > 0);
  }
}
