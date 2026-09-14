# Searching issues

mudissue search filters issues with a query string. The same syntax works in the TUI search filter and in the CLI:

```bash
mud issue search priority:high -status:closed
```

Multiple terms are combined with **AND** (every term must match). Use `OR` or comma lists for alternatives.

## Free text

Bare words match case-insensitively against issue body content and frontmatter values.

| Query | Meaning |
|-------|---------|
| `login` | Body or frontmatter contains `login` |
| `"promo code"` | Exact phrase (quoted) |
| `-spam` | Exclude issues that contain `spam` |

A bare number also matches the issue number in the folder name (leading zeros ignored). For example, `42` matches folder `MI042-fix-login`.

An **issue ID** (prefix + number) also matches the folder’s issue ID with leading zeros ignored. For example, `MI386` matches folder `MI0386-…`. The full **issue slug** (folder basename) matches exactly.

## Field filters

Use `field:value` to match a frontmatter field (or a built-in date field). String equality is **case-insensitive**.

| Query | Meaning |
|-------|---------|
| `status:open` | Frontmatter `status` is `open` |
| `priority:high` | Frontmatter `priority` is `high` |
| `title:Login` | Frontmatter `title` equals `Login` (case-insensitive) |
| `-status:closed` | Status is not `closed` |

Any frontmatter key can be used as the field name.

### Comparisons

For dates and numbers, prefix the value with `>=` or `<=`:

| Query | Meaning |
|-------|---------|
| `createdAt:>=2026-01-01` | Created on or after that date |
| `updatedAt:<=2026-06-01` | Updated on or before that date |

`createdAt` and `updatedAt` use the issue’s effective timestamps (frontmatter when set, otherwise filesystem times).

### Presence

| Query | Meaning |
|-------|---------|
| `has:assignee` | Frontmatter has an `assignee` key |
| `-has:assignee` | Frontmatter does not have `assignee` |

## Tags

`tag:` matches values in the frontmatter `tags` list (case-insensitive):

| Query | Meaning |
|-------|---------|
| `tag:bug` | Has tag `bug` |
| `-tag:wip` | Does not have tag `wip` |

## Resolved status alias

`status:resolved` is a special alias. It matches any status in the effective **resolved** list from config (`resolved_status_list` in `mud.conf`, else `default_resolved_status_list` in global config, else the built-in defaults `closed`, `canceled`, `duplicated`).

| Query | Meaning |
|-------|---------|
| `status:resolved` | Status is one of the resolved statuses |
| `-status:resolved` | Status is not resolved |

Matching is case-insensitive for both the alias (`status:Resolved`) and the status values compared to the list. Issues with a missing or empty `status` do not match `status:resolved`.

Other status values (for example `status:closed`) still match that literal frontmatter value.

See [status.md](../status.md) for configuring the resolved list.

## OR and comma lists

Space-separated terms are AND. Alternatives:

| Query | Meaning |
|-------|---------|
| `status:open OR status:planned` | Status is `open` or `planned` |
| `status:open,planned` | Same as above (comma expands to OR) |
| `tag:bug,urgent` | Has tag `bug` or `urgent` |
| `priority:high -status:resolved` | High priority and not resolved |

## Combining filters

Examples:

```text
priority:high -status:resolved
tag:bug status:open,planned
login -spam status:in_progress
"error handling" -status:resolved
```

## CLI options

`mud issue search` also accepts:

| Option | Purpose |
|--------|---------|
| `--project <name>` | Search only that project |
| `--sort "+title,-created_at"` | Sort keys; `+` ascending, `-` descending |
| `--max <n>` | Cap the number of results returned |

Built-in sort fields: `id`, `title`, `status`, `priority`, `created_at`, `updated_at`. Other names sort by that frontmatter field.
