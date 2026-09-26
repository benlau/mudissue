---
name: mudissue-code-review
description: >-
  Review mudissue code changes for module layer placement, scope, and project
  conventions. Use when the user says "code view", or when reviewing a PR or diff before merge.
---

# mudissue code review

**Trigger:** user says **"code view"** (or **"check file layer rule"** / **"check module layer rule"**).

Read [docs/dev/module-layers.md](../../../docs/dev/module-layers.md) first. Layer rules are about **where behavior lives**, not only import direction (views may import `async/storage`; that does not justify new helpers in the wrong folder).

## Architecture checklist

For every new or moved file, ask:

| Question | If "no" → likely wrong layer |
| -------- | ----------------------------- |
| Does this touch issue/repo files or frontmatter? | Belongs in L2 `src/async/storage/` (e.g. `TrackerRepoStorage`, `IssueFolderStorage`, `IssueMarkdownFileStorage`), not in `views/` or palette-local helpers. |
| Is this Zustand state or list/viewer behavior? | Belongs in L3 `src/store/`. |
| Is this CLI-only headless flow? | Belongs in L4 `src/commands/`. |
| Is this Ink UI orchestration? | Belongs in L4 `src/views/` or `src/contexts/` — call storage/store, do not reimplement file I/O. |

**Red flags**

## Bad example (do not repeat)

**Task:** After Set Status / Set Priority in the TUI, set frontmatter `updated_at` to now.

**Wrong:** Add `src/views/PaletteCommands/touchIssueUpdatedAt.ts` as a standalone helper that performs the update.

**Why wrong:** That file holds **command/workflow** behavior (do this step after set status), not a **utility** that belongs under `views/`. Palette commands should orchestrate; persistence belongs on `IssueFolderStorage` in `async/storage/`. A new helper class in the wrong folder breaks architecture even when imports are valid.

## Review output format

1. **Layer** — file path → expected layer; flag mismatches first
2. **Scope** — does the diff match the stated issue only?
3. **Tests** — mirror `src/` under `tests/`; mock `FileService`, not real disk ([mudissue-unittests](../unittests/SKILL.md))
4. **Other** — accessors vs loose helpers (`AGENTS.md`), headless commands vs `AppStore`

Use:

- 🔴 **Critical** — wrong layer or out-of-scope architectural change; must fix
- 🟡 **Suggestion** — style, duplication, missing test
- 🟢 **Nice** — optional polish

## User correction phrase

If the user says **"code view"** : re-read `docs/dev/module-layers.md`, list helpers/files in the wrong folder, and propose moving them to the correct layer path.
