# Issue status configuration

mudissue uses a configurable status catalog. The value stored in issue frontmatter is the status **name** (e.g. `pending` in `status: pending`).

Statuses are an **ordered flat list**. The palette and sort order follow list order (first item first). The **first item** is also the default status assigned when creating a new issue.

## Override statuses (project `mud.conf`)

In your tracker repo’s `mud.conf`, replace the built-in list with the `status_list` key. Provide the **full list** — partial patches are not supported.

```yaml
# mud.conf
status_list: open, backlog, planned, in_progress, review, duplicated, closed, canceled
```

You can also use a YAML array:

```yaml
status_list:
  - open
  - backlog
  - planned
```

### Rules

- Each entry must be a non-empty string.
- Names must be **unique** across the list.
- The first entry is the default status for newly created issues.

## Built-in defaults

When `mud.conf` and global config omit status overrides, mudissue uses this list:

`open`, `backlog`, `planned`, `in_progress`, `review`, `duplicated`, `closed`, `canceled`

## Palette ordering

The **Set Status** command shows statuses in list order (same order as in config).

## Status aliases

`status_aliases` groups workflow `status` values under a name. Search can match that name (`status:<alias>`), and the built-in alias `resolved` also drives issue-table dimming and resolved predicates.

Aliases are not linkage frontmatter fields. Each entry is an object with a `statuses` list (comma-separated string or YAML array). Provide the **full list** for that alias — partial patches are not supported.

```yaml
# mud.conf
status_aliases:
  resolved:
    statuses: done, 取消
  active:
    statuses:
      - open
      - in_progress
```

### Built-in `resolved` alias

When neither config defines a `resolved` alias, mudissue treats these statuses as resolved:

`closed`, `canceled`, `duplicated`

In the issue table (TUI), rows with a resolved status are shown dimmed (except when selected).

Search:

- `status:resolved` — issues whose status is in the effective resolved list
- `-status:resolved` — issues whose status is not in that list
- `status:<aliasName>` — same idea for any configured alias

Matching is case-insensitive for both the alias name (`status:Resolved`) and the status values compared to the list. If an alias name is also a real status, the alias wins.

### Older resolved-list keys

`resolved_status_list` (project) and `default_resolved_status_list` (global) still work. Each is copied into that config layer’s `resolved` alias **only when that layer does not already define `resolved`**. If `status_aliases.resolved` is set, it wins over `resolved_status_list` on the same file.

```yaml
# mud.conf — equivalent to status_aliases.resolved when resolved is not set above
resolved_status_list: closed, canceled, duplicated
```

### Global defaults (`~/.mudissue/global.conf`)

Use `default_status_aliases` for aliases shared by every project. Repo `status_aliases` replaces **only the alias names it sets**; other global aliases stay in effect.

```yaml
default_status_aliases:
  resolved:
    statuses: closed, canceled, duplicated
  active:
    statuses: open, in_progress
```

`default_resolved_status_list` fills the global `resolved` alias when `default_status_aliases` does not already include `resolved`.

---

## Advanced topics

### Global status list (`~/.mudissue/global.conf`)

Use global config when you want the same custom catalog for **all** projects. Project `status_list` overrides global `default_status_list` when set.


| Key                   | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `default_status_list` | Full status list for all projects (when repo omits `status_list`) |


#### Example

```yaml
default_status_list: open, pending, in_progress, done, canceled
```

Or as an array:

```yaml
default_status_list:
  - open
  - pending
  - in_progress
  - done
  - canceled
```

#### Validation

- Duplicate status names in a list are rejected.
- Invalid YAML causes load errors such as `Invalid default_status_list`.

### Comparison with priority


|                        | Priority                                  | Status                                           |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| Typical project config | `priority_list` (optional full override) | `status_list` (optional full override)           |
| Global key             | `default_priority_list`                  | `default_status_list`                            |
| Frontmatter field      | `priority`                                | `status`                                         |
| Default for new issues | `*name` marker in list, else first entry  | First status in effective list                   |


See [`src/types/status.ts`](../src/types/status.ts) for schemas and built-in constants.
