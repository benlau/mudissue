const REPLACEMENT_CHAR = "-";
const INVALID_GIT_REF_CHARS = new Set([
  "~",
  "^",
  ":",
  "?",
  "*",
  "[",
  "]",
  "\\",
  "&",
  "#",
]);

export class GitBranchFormatter {
  static normalize(branchName: string, fallback: string): string {
    const normalized = GitBranchFormatter.normalizeCandidate(branchName);
    if (GitBranchFormatter.hasMeaningfulName(normalized)) {
      return normalized;
    }

    return fallback;
  }

  private static normalizeCandidate(value: string): string {
    const replaced = value
      .trim()
      .split("")
      .map((char) => GitBranchFormatter.replaceInvalidChar(char))
      .join("")
      .replace(/@\{|\}/g, REPLACEMENT_CHAR)
      .replace(/\.{2,}/g, REPLACEMENT_CHAR)
      .replace(/-+/g, REPLACEMENT_CHAR)
      .replace(/\/+/g, "/");

    return replaced
      .split("/")
      .map((component) => GitBranchFormatter.normalizeComponent(component))
      .filter((component) => component !== "")
      .join("/");
  }

  private static normalizeComponent(component: string): string {
    return component
      .replace(/^\.+/, "")
      .replace(/\.+$/g, "")
      .replace(/\.lock$/i, "")
      .replace(/^-+|-+$/g, "")
      .replace(/\.+$/g, "")
      .replace(/\.lock$/i, "")
      .replace(/^-+|-+$/g, "");
  }

  private static replaceInvalidChar(char: string): string {
    const code = char.charCodeAt(0);
    return code <= 32 || code === 127 || INVALID_GIT_REF_CHARS.has(char)
      ? REPLACEMENT_CHAR
      : char;
  }

  private static hasMeaningfulName(value: string): boolean {
    return value !== "" && value !== REPLACEMENT_CHAR && value !== "@";
  }
}
