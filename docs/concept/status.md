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

## Resolved statuses

`resolved_status_list` defines which status values count as **resolved**. In the issue table (TUI), rows with a resolved status are shown dimmed (except when selected).

Search also treats `resolved` as a status alias against this list:

- `status:resolved` — issues whose status is in the effective resolved list
- `-status:resolved` — issues whose status is not in that list

Matching is case-insensitive for both the alias (`status:Resolved`) and the status values compared to the list.

### Built-in defaults

When `mud.conf` and global config omit resolved-status overrides, mudissue treats these as resolved:

`closed`, `canceled`, `duplicated`

### Override (project `mud.conf`)

```yaml
# mud.conf
resolved_status_list: closed, canceled, duplicated
```

Or as a YAML array:

```yaml
resolved_status_list:
  - done
  - wontfix
```

Provide the **full list** — partial patches are not supported.

### Global defaults (`~/.mudissue/global.conf`)

Project `resolved_status_list` overrides global `default_resolved_status_list` when set.

```yaml
default_resolved_status_list: closed, canceled, duplicated
```

---

## Advanced topics

### Global defaults (`~/.mudissue/global.conf`)

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
