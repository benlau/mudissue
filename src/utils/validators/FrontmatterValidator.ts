/**
 * Validates frontmatter property keys for YAML/frontmatter safety.
 * Allows only [a-zA-Z0-9_-]+ to avoid injection or invalid keys.
 */
export class FrontmatterValidator {
  private static readonly SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;

  /**
   * Returns true if the input is a valid frontmatter property key.
   */
  public static isValidPropertyKey(input: string): boolean {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }
    return FrontmatterValidator.SAFE_KEY_REGEX.test(input);
  }
}
