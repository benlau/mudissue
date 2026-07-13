/**
 * Matches issue folder names and extracts issue ID/number/suffix.
 * Folder format: [issue_prefix][issue_num][-issue_suffix]
 * - issue_prefix: optional, [a-zA-Z_-]+ when present (e.g. FN, PR-, PX_)
 * - issue_num: required digits
 * - issue_suffix: optional, after a single hyphen
 */
export class IssueSelectorMatcher {
  /** Matches optional prefix [a-zA-Z_-]*, required digits, optional -suffix. */
  private static readonly FOLDER_REGEX = /^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/;

  public static isIssueNumber(input: string): boolean {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }
    return /^\d+$/.test(input.trim());
  }

  public static isIssueId(input: string): boolean {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }
    return /^[a-zA-Z_-]*\d+$/.test(input.trim());
  }

  /**
   * Returns true if the folder name is a valid issue folder.
   */
  public static isValidateFolderName(input: string): boolean {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }
    return IssueSelectorMatcher.FOLDER_REGEX.test(input.trim());
  }

  /**
   * Returns the issue ID (prefix + issue_num) or null if invalid.
   */
  public static extractIssueId(folder: string): string | null {
    if (typeof folder !== "string") {
      return null;
    }
    const m = folder.trim().match(IssueSelectorMatcher.FOLDER_REGEX);
    return m ? `${m[1]}${m[2]}` : null;
  }

  /**
   * Returns the numeric part of the issue (digits only), or null if invalid.
   */
  public static extractIssueNumber(folder: string): string | null {
    const m =
      typeof folder === "string" &&
      folder.trim().match(IssueSelectorMatcher.FOLDER_REGEX);
    return m ? m[2] : null;
  }

  /**
   * Returns the suffix part (after the hyphen), or null if missing/invalid.
   */
  public static extractIssueSuffix(folder: string): string | null {
    if (typeof folder !== "string") {
      return null;
    }
    const m = folder.trim().match(IssueSelectorMatcher.FOLDER_REGEX);
    return m && m[3] !== undefined ? m[3] : null;
  }

  /**
   * Returns true if both folder names refer to the same issue number.
   */
  public static isSameIssueNumber(
    folderName1: string,
    folderName2: string,
  ): boolean {
    const n1 = IssueSelectorMatcher.extractIssueNumber(folderName1);
    const n2 = IssueSelectorMatcher.extractIssueNumber(folderName2);
    if (n1 === null || n2 === null) {
      return false;
    }
    return parseInt(n1, 10) === parseInt(n2, 10);
  }

  /**
   * Returns true if both folder names refer to the same issue ID
   * (same prefix and same numeric value, allowing zero-padding differences).
   */
  public static isSameIssueId(
    folderName1: string,
    folderName2: string,
  ): boolean {
    const m1 =
      typeof folderName1 === "string" &&
      folderName1.trim().match(IssueSelectorMatcher.FOLDER_REGEX);
    const m2 =
      typeof folderName2 === "string" &&
      folderName2.trim().match(IssueSelectorMatcher.FOLDER_REGEX);
    if (!m1 || !m2) {
      return false;
    }
    if (m1[1] !== m2[1]) {
      return false;
    }
    return parseInt(m1[2], 10) === parseInt(m2[2], 10);
  }

  /**
   * Returns true if folderName matches issueSelector.
   * Selectors with a `-suffix` match on exact folder name, and also on
   * same-ID suffix prefix (e.g. truncated worktree folder names).
   * Partial selectors (issue number or issue id without suffix) also match by number or id.
   */
  public static match(folderName: string, issueSelector: string): boolean {
    if (!IssueSelectorMatcher.isValidateFolderName(folderName)) {
      return false;
    }
    if (folderName === issueSelector) {
      return true;
    }
    const selectorSuffix =
      IssueSelectorMatcher.extractIssueSuffix(issueSelector);
    if (selectorSuffix !== null) {
      if (!IssueSelectorMatcher.isSameIssueId(folderName, issueSelector)) {
        return false;
      }
      const folderSuffix = IssueSelectorMatcher.extractIssueSuffix(folderName);
      if (folderSuffix == null) {
        return false;
      }
      const folderIssueId = IssueSelectorMatcher.extractIssueId(folderName);
      const selectorIssueId =
        IssueSelectorMatcher.extractIssueId(issueSelector);
      if (folderIssueId === selectorIssueId) {
        // Worktree folder names can be truncated, so restore should accept
        // selectors that are a prefix of the full issue suffix for the same ID.
        return folderSuffix.startsWith(selectorSuffix);
      }
      return folderSuffix === selectorSuffix;
    }
    if (IssueSelectorMatcher.isSameIssueId(folderName, issueSelector)) {
      return true;
    }

    if (IssueSelectorMatcher.isIssueNumber(issueSelector)) {
      const folderIssueNum =
        IssueSelectorMatcher.extractIssueNumber(folderName);
      const selectorSelectorNum =
        IssueSelectorMatcher.extractIssueNumber(issueSelector);
      return (
        folderIssueNum !== null &&
        selectorSelectorNum !== null &&
        parseInt(folderIssueNum, 10) === parseInt(selectorSelectorNum, 10)
      );
    }

    return false;
  }
}
