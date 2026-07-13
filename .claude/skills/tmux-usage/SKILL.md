---
name: tmux-usage
description: >-
  Automate and capture mudissue TUI flows in tmux for testing. Use when testing
  mud/mudissue interactively, verifying Ink UI layout, or driving the CLI in a
  detached terminal session. Playground folder is the sandbox tracker.
---

# tmux usage for mudissue testing

Use tmux to launch, drive, and capture the mudissue TUI (`view`, dialogs, menus) without an attached terminal. All interactive testing should use the **`playground/`** directory as a disposable tracker.

## CLI invocation

Always run the CLI from `playground/` via the worktree's built bundle — **never** bare `mud` on PATH (multiple worktrees may each install or link a different binary):

```bash
cd playground && node ../dist/index.js <subcommand> [args]
```

Run `npm run build` from the repo root before testing so `dist/index.js` matches current source.

## Playground rules

| Action | Permission |
| ------ | ---------- |
| Create issues (`node ../dist/index.js issue create`, TUI create flows) | Allowed without asking |
| Modify issues (edit frontmatter/body, set properties, rename, etc.) | Allowed without asking |
| Remove or delete files in `playground/` | **Ask the user first** |

Initialize the playground tracker once if `playground/mud.conf` is missing:

```bash
cd playground && node ../dist/index.js init
```

## Session naming

Use the **project folder basename** as the tmux session name so parallel worktrees do not collide. Derive it once from the repo root:

```bash
SESSION=$(basename "$(git rev-parse --show-toplevel)")
```

Do **not** use a fixed name like `mud-test`. Reference `"$SESSION"` in all `tmux -t` / `-s` flags below.

## Golden path

1. **Launch** a detached session with fixed dimensions:

```bash
SESSION=$(basename "$(git rev-parse --show-toplevel)")
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 80 -y 24 'cd playground && node ../dist/index.js view'
```

2. **Interact** — send keys, then wait for the TUI to settle:

```bash
tmux send-keys -t "$SESSION" "+"
sleep 0.5
```

3. **Capture** the pane for inspection:

```bash
tmux capture-pane -N -p -t "$SESSION" > playground/capture.txt
```

Read `playground/capture.txt` to verify layout, borders, and text. Capture files are gitignored with other playground contents.

## Session orchestration

Launch detached with explicit width and height. Without `-x` and `-y`, the TUI may render at unexpected defaults and captures will not match real terminal layouts.

```bash
SESSION=$(basename "$(git rev-parse --show-toplevel)")
tmux new-session -d -s "$SESSION" -x 80 -y 24 '<command>'
```

Kill the worktree's session when done:

```bash
tmux kill-session -t "$SESSION"
```

## Input simulation

Send keys as a user would:

```bash
tmux send-keys -t "$SESSION" "<key>"
```

TUIs have render delays and short transitions. Always `sleep 0.5` (or longer for slow flows) between a keypress and a capture so the UI reaches the target state.

For literal text or Enter:

```bash
tmux send-keys -t "$SESSION" "My issue title" Enter
sleep 0.5
```

## Capture: preserve trailing whitespace

Right-side box borders (`│`) depend on trailing spaces. Piping `capture-pane -p` through tools that strip trailing whitespace collapses borders and can show "bleeding" background text (e.g. `...┐dium`).

| Method | Notes |
| ------ | ----- |
| `capture-pane -p` | Fast; prone to whitespace stripping and artifacts |
| `save-buffer` | Better for local files; still susceptible to bleeding if buffer not cleared |
| `capture-pane -e -p` | Full ANSI colors; accurate but noisy |
| **`capture-pane -N -p`** | **Preferred** — strips colors, preserves layout and trailing spaces |

Always prefer `-N` when capturing ASCII layout for review.

## Example: open create dialog and capture

```bash
npm run build

SESSION=$(basename "$(git rev-parse --show-toplevel)")
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 80 -y 24 'cd playground && node ../dist/index.js view'

sleep 1
tmux send-keys -t "$SESSION" "+"
sleep 0.5
tmux capture-pane -N -p -t "$SESSION"

tmux kill-session -t "$SESSION"
```

## Scripted / headless checks

For non-TUI commands in playground, prefer `--json` instead of tmux:

```bash
cd playground && node ../dist/index.js --json issue create 'Test issue'
```

Reserve tmux for flows that require the Ink TUI (views, dialogs, menus, keyboard navigation).
