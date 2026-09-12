# Palette Commands

Press `:` in the TUI to open the **Command Palette**. Commands below are available from the issue table, the issue viewer, or both.

Custom scripts defined in `mud.conf` also appear in the palette when configured; their labels and descriptions come from each script entry.

## Issue Table

| Command | Description |
| --- | --- |
| Switch Recent Project | Switch to another recently opened repository |
| Set Sort Order | Choose how issues are sorted in the list |
| Refresh | Reload the issue list, project config, and registry from disk |
| Merge Selected Issues | Merge selected issues into a new issue |
| Import Issue from file | Create an issue by importing a markdown file |

## Issue Viewer

| Command | Description |
| --- | --- |
| Extract Content into New Issue | Cut the selected markdown lines into a new sub-issue of the current issue |

## Issue Table and Issue Viewer

| Command | Description |
| --- | --- |
| Remove Selected Issue | Delete the selected issue folder from disk |
| Archive Selected Issue | Move the selected issue folder into `issues/.archive` |
| Set Priority | Change the priority of the selected issue |
| Set Status | Change the status of the selected issue |
| Toggle Pin Issue | Pin or unpin the selected issue at the top of the list |
| Open Shell | Open an interactive shell in a project folder |
| Edit | Edit the selected issue in the text editor |
| Link Issue | Link the selected issue(s) to another issue |
| Create Sub-issue | Create a sub-issue linked to the selected issue |
| Copy to Clipboard | Copy issue information to the clipboard |
| Touch Issue | Set `updated_at` to the current time for the selected issue |
| Change Label | Change the label of the first selected issue |
| Run Custom Script | Run a predefined script from `mud.conf` on selected issues |
