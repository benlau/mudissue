v0.0.5 Release
=========

New Features:
- Group subissues under their parent in the issue table when the list is not filtered
- Promote issue ID matches to the top of TUI table search so numeric filters surface the intended issue first
- Let `issue file attach` accept typed content when no file path is given
- Add `mud script select-item` and a full-page table picker for `select-issue` with configurable property columns

Changed:
- Rename issue create `--file` to `--import-from-md` and add body-only `--from-file` and `--from-env-var`; share the same body sources on append and prepend
- Replace script `--output` with registry-backed `set-var` / `get-var` so shell scripts can pass picker results between steps; add `get-var --no-error` for missing variables
- Launch the TUI from bare `mud` without a `view` subcommand
- Rename `change-label` to `change-id` and clarify Issue ID vs issue slug naming
- Forbid `#` in issue folder, worktree, and branch names so paths stay shell- and wikilink-safe
- Use `>` instead of `:` as the palette command path separator in the TUI

Dependencies:
- Drop `better-sqlite3` in favor of Node's built-in `node:sqlite`

Misc
- Log recent-project registry updates and palette project switches in debug mode


v0.0.4 Release
=========

New Features:
- Add a palette command to merge selected issues into a new issue, with optional removal of the originals
- Add `mud config set-property` / `mud config get-property` commands. So that the mud.conf values can be updated without opening an editor

Documentation:
- Document setup config, local git exclude for mud.conf, and the TUI palette command reference

v0.0.3 Release
=========

- Turn mermaid-cli and svgdom into optional dependences
- Setup Github CI publish NPM workflow
