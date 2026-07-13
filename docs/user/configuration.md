# Tracker Configuration

`mudissue` utilizes a hierarchical configuration system to balance global preferences with project-specific requirements.

## Configuration Hierarchy

1. **Global Config (`global.conf`):** User-wide settings (e.g., default editor, default worktree path).
2. **Project Config (`mud.conf`):** Repository-specific overrides (e.g., unique status catalogs or issue prefixes).

## Initializing a Tracker

To turn a directory into a `mudissue` tracker repository:

```bash
mud init
```

If you are working within an existing Git project and want the tracker to reside inside the repo, use:
```bash
mud init --inside-git
```

## Configuring Catalogs

You can customize your project's workflow by defining custom status lists in your `mud.conf`.

**Example `mud.conf` snippet:**
```yaml
status_list:
  - To Do
  - In Review
  - Done
```