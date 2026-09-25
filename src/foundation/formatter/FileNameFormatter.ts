/**
 * Characters forbidden in issue folder/file names (also used as worktree
 * folder basenames). Includes cross-platform filename restrictions plus `.`,
 * `(`, `)`, `[`, `]`, and `#`. Brackets must not appear because mudissue
 * stores parent/subissue links as Obsidian wikilinks (`[[folder-name]]`);
 * brackets inside the folder name would nest inside or prematurely terminate
 * those delimiters. `#` is stripped for the same wikilink reason (heading
 * anchors) and because it breaks shell/URL paths. Dots and parentheses are
 * stripped to keep folder names unambiguous on disk and in shell/git paths.
 */
const FORBIDDEN_CHARS = /[\\/:*?"<>|`\s&#.[\]()]/g;

export class FileNameFormatter {
  static format(input: string): string {
    const s = String(input).trim().toLowerCase();
    if (s === "") return "";
    const step1 = s.replace(FORBIDDEN_CHARS, "-");
    const step2 = step1.replace(/-+/g, "-");
    const result = step2.replace(/^-|-$/g, "");
    return result.length > 0 ? result : "";
  }
}
