# Glossary

Terms used across mudissue docs and code when describing where configuration lives and how issues are stored on disk.

## Project folder

The directory that contains `mud.conf` (or `.git/mudissue/mud.conf` when initialized with `mud init --inside-git`). This is the root mudissue discovers by walking up from your current working directory.

Usually this is a software repository you work in, but it can be any directory you choose to track with mudissue.

In code this path is `projectPath` on a `TrackerRepo`.

## Tracker folder

The directory that holds the issue tracker data for a project. By default it is the same as the **project folder**.

If `mud.conf` sets `tracker_path`, the tracker folder is resolved from that value instead:

- `.` or omitted — use the project folder
- Relative path — resolved under the project folder
- Absolute path — used as-is

In code this path is `trackerPath` on a `TrackerRepo`.

## Issues folder

The directory that contains one subdirectory per issue. It lives inside the **tracker folder**.

The relative path comes from `issue_path` in `mud.conf`, defaulting to `issues`. For example, with the default config, issues live at `<tracker_folder>/issues/`.

## Issue folder

A single issue’s directory inside the **issues folder**. Its name follows the [issue folder naming rules](../concept/issue-folder.md) (issue prefix, number, optional suffix; the full name is the **issue slug**; PREFIX+NUM is the **issue ID**).

Each issue folder can hold:

- The **issue file** (Markdown)
- Attached files under a `files/` subdirectory

Example layout:

```text
issues/
  MI001-summary/
    MI001-summary.md    # issue file (when pattern is "long")
    files/              # attached files
```

## Issue file

The Markdown file for one issue: YAML frontmatter plus body text. mudissue reads and writes properties (status, priority, title, and so on) through this file.

The filename depends on `issue_file_pattern` (and related settings). See below.

---

## Issue file naming (`issue_file_pattern`)

Configured per repo in `mud.conf` as `issue_file_pattern`, or globally as `default_issue_file_pattern`. Precedence: repo config → global config → default (`long`).

### `long` (default)

The issue file is named after the **issue folder**:

- Folder: `MI001-summary`
- File: `MI001-summary.md`

Useful when the folder name already describes the issue and you want the file name to match.

### `short`

The issue file is named after the **issue ID** only (prefix + number; suffix is not included):

- Folder / issue slug: `MI001-summary`
- File: `MI001.md`

Useful when folder names are long but you prefer a shorter filename inside each folder.

### `fixed`

The issue file always uses a single configured basename, regardless of folder name. Set the basename with `issue_file` in `mud.conf` (or `default_issue_file` globally), defaulting to `issue.md`:

- Folder: `MI001-summary`
- File: `issue.md`

Useful when every issue folder should share the same predictable filename.

When the pattern is `long` or `short`, mudissue records parent/child links in frontmatter (`subissues`, `parent`) as Obsidian wikilinks: `[[issue-folder-name]]`. With `fixed`, folder names are stored without brackets.

---

## How the pieces fit together

```text
<project_folder>/              # mud.conf lives here
  mud.conf
  <issues_folder>/             # default: issues/ (under tracker folder)
    <issue_folder>/            # e.g. MI001-summary/
      <issue_file>             # e.g. MI001-summary.md, MI001.md, or issue.md
      files/                   # attached files (see mud issue file attach)
        ...
```

When `tracker_path` points elsewhere, the **tracker folder** (and thus the **issues folder**) may sit outside the project folder; `projectPath` and `trackerPath` in code still reflect that split.
