# Issue folder naming rules

An issue folder is a directory whose name follows the issue folder format. Only such folders are treated as issues by mudissue.

## Format

An issue folder name has three parts:

| Part           | Required | Description |
|----------------|----------|-------------|
| **issue_prefix** | No    | Optional prefix before the number. When present, must match `[a-zA-Z_-]+` (e.g. `FN`, `PR-`, `PX_`). |
| **issue_num**    | Yes   | One or more digits. |
| **issue_suffix** | No    | Optional text after a single hyphen (e.g. a short description). |

- **Issue ID** = `{issue_prefix}{issue_num}` (PREFIX optional). Not necessarily unique across folders.
- **Issue Slug** = `{issue_prefix}{issue_num}[-{issue_suffix}]` — the full folder basename (PREFIX and SUFFIX optional). Unique within one issues directory. Issue slug is the official term for the issue folder name.

See [ADR-001: Issue ID and Issue Slug Naming](../adr/ADR-001-issue-id-and-issue-slug.md).

When mudissue creates or renames an issue folder from a title, the full folder name (issue slug) is limited to **48 characters**. If longer, characters are removed from the end (no ellipsis). Issue branch names and worktree folder names are still limited to **32 characters** with the same end truncation.

## Valid examples

| Folder name / Issue Slug | Issue prefix | Issue num | Issue suffix   | Issue ID |
|--------------------------|--------------|-----------|----------------|----------|
| `1`                      | *(none)*     | 1         | *(none)*       | `1`      |
| `002`                    | *(none)*     | 002       | *(none)*       | `002`    |
| `0003-any string char`   | *(none)*     | 0003      | any string char| `0003`   |
| `FN004`                  | FN           | 004       | *(none)*       | `FN004`  |
| `PR-005-any stringchar`  | PR-          | 005       | any stringchar | `PR-005` |
| `PX_006-any stringchar`  | PX_          | 006       | any stringchar | `PX_006` |

## Invalid examples

- `no-digits` — no digit sequence
- `abc` — no digits
- Empty string
