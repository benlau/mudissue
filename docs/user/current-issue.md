# The `current` issue selector

Many `mud` commands take an **issue selector** (issue ID, folder name, or suffix). You can pass the special keyword **`current`** instead of typing the issue ID when your shell’s working directory is inside that issue’s **git worktree**.

This is useful in scripts and day-to-day terminal work: from an issue worktree you can run commands such as `mud issue cat current` without copying the folder name.

## Example

Create a worktree for an issue, `cd` into it, then use `current`:

```bash
mud issue worktree create MZ0021-my-feature
cd .claude/worktrees/MZ0021-my-feature

mud issue cat current
mud issue locate current
mud issue set-property current status in_progress
```

The keyword is **case-insensitive** and ignores surrounding whitespace (`Current`, ` CURRENT `, and `current` are equivalent).

## Where `current` works

`current` is resolved from the **current working directory**, not from the TUI’s highlighted row or “last viewed” issue.

### Requirement: issue git worktree

The `current` keyword is only valid when the cwd lies inside a **mudissue-managed issue worktree**—typically one you created with:

```bash
mud issue worktree create <issue_selector>
```

Running `mud issue cat current` from the **main project checkout** (or from an arbitrary git worktree that mudissue did not create for an issue) fails with an error indicating that `current` requires an issue worktree.

Subdirectories of the worktree count. For example, `mud issue cat current` works from `.claude/worktrees/MZ0021-my-feature/src/lib` as long as that path is under the issue worktree root.

## Commands that accept `current`

Any command that takes an `<issue_selector>` positional argument goes through the same resolution path, including (non-exhaustive):

- **Read / paths:** `mud issue cat`, `mud issue locate`, `mud issue get-property`
- **Edit content:** `mud issue edit`, `mud issue append`, `mud issue prepend`, `mud issue comment`
- **Metadata:** `mud issue set-property`, `mud issue tag`, `mud issue untag`, `mud issue touch`, `mud issue rename`, `mud issue change-id`
- **Worktrees:** `mud issue worktree locate`, `mud issue worktree run`, merge/rebase/push operands that take an issue selector
- **Scripts:** `mud script select-issue current` (non-interactive when `current` resolves to one issue)

`mud issue view` also accepts `current` when launching the TUI for that issue.

Use `mud issue locate current` to print the issue markdown path when debugging resolution.


