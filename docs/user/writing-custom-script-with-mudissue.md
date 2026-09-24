# Writing Custom Scripts with MudIssue

MudIssue includes a `mud script` command group for shell automation. Use it to store temporary values, prompt with small Ink pickers, and combine those helpers with the normal issue CLI.

## Script variables

Script variables live in the system registry at `mudissue://script/variables`. They persist across commands in the same MudIssue installation, so a picker can write a value and a later shell step can read it.

```bash
# Set a variable
mud script set-var selected_issue MI001-example

# Read a variable (prints the value)
mud script get-var selected_issue

# Clear a variable
mud script set-var selected_issue --clear
```

Variable names use the same rules as issue property keys: letters, numbers, underscores, and hyphens only (`[a-zA-Z0-9_-]+`).

## Interactive pickers

### Select an item

Prompt for one value from a list. Without `--set-var`, the selection is printed to stdout. With `--set-var`, it is stored as a script variable instead.

```bash
mud script select-item \
  --items "dev,staging,prod" \
  --title "Deploy target" \
  --set-var deploy_target

TARGET=$(mud script get-var deploy_target)
echo "Deploying to $TARGET"
```

Useful options:

- `--items` — separator-joined list (required)
- `--separator` — defaults to `,`
- `--default` — initially highlighted item
- `--title` — picker title
- `--set-var <name>` — write the selection to a script variable (cleared if the picker is cancelled)

### Select an issue

Pick an issue folder (by selector, or from all issues when omitted). The value stored or printed is the issue folder name.

```bash
mud script select-issue --set-var selected_issue
ISSUE=$(mud script get-var selected_issue)
mud issue cat "$ISSUE"
```

The interactive picker is a full-page table (like the issue list) with columns **id**, **title**, **status**, and **priority** by default. Override the trailing property columns with `--columns` (comma-separated frontmatter keys); **id** and **title** always stay first:

```bash
mud script select-issue --columns assignee,due_date --set-var selected_issue
```

Optional `[issue_selector]` narrows candidates. `--project` scopes lookup to a named project. With `--set-var`, a cancelled picker clears that variable.

### Uniq issue folder name

`mud script uniq <issue_selector>` resolves a selector to a unique issue folder name and prints it. Use it when a script already has a partial ID and needs a stable folder name without an interactive picker.

## Combining with the issue system

Script helpers are meant to sit beside the regular issue commands:

```bash
# Pick an issue, then update and inspect it
mud script select-issue --set-var work_issue
ISSUE=$(mud script get-var work_issue)

mud issue set-property "$ISSUE" status in_progress
mud issue cat "$ISSUE"

# Create a follow-up issue from script context
mud --json issue create "Follow up for $ISSUE" --content "Notes from automation"
```

Other useful issue commands in scripts:

- `mud issue get-property <selector> <property>`
- `mud issue set-property <selector> <property> <value>`
- `mud issue search '<query>'`
- `mud issue locate <selector>`
- `mud --json …` for machine-readable output

## Typical flow

1. Use `select-item` / `select-issue` with `--set-var` to capture UI choices.
2. Read values with `get-var` into shell variables.
3. Call issue commands (`cat`, `set-property`, `create`, …) using those values.
4. Clear temporary variables with `set-var <name> --clear` when the script finishes.
