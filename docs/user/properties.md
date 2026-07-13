# Property Management

## Updating Properties via CLI

You can update issue properties without opening an editor using the `issue set-property` command. This follows a "Set" API similar to updating a record in a SQL database.

```bash
mud issue set-property [issue-id] key value
```

**Example:** Assigning a reviewer and estimated effort:
```bash
mud issue set-property MI-101 reviewer @ben
mud issue set-property MI-101 effort 5
```

