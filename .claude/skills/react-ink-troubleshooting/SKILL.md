---
name: react-ink-troubleshooting
description: >-
  React Ink troubleshooting when Flex/column menus lose rows or rows seem to vanish at random:
  fixed-height clipping, wrapping Text, and terminal row budgets. Use when debugging Ink layouts,
  PickItemDialog-style lists, or selectable menus where content disappears.
---

# React Ink: rows randomly disappearing — how to fix

## Symptom

A selectable menu built from **`flexDirection="column"`** and a **list of `Box` rows** (each with `Text`) shows **missing rows**, or rows **drop out unpredictably** after resize or with long strings.

## Cause

Ink uses Yoga. Parents with a **fixed `height`** or **bounded flex height** **clip** children. Overflow does not scroll by default—extra lines are cut off, which can look "random" depending on measure order, wrapping, or terminal size.

Common triggers:

- **`height` on the column `Box` is smaller** than the **actual rendered line count** (e.g. one logical row but `Text` **wraps**, or strings contain **newlines**).
- **`height` / `dialogHeight` out of sync** with `displayRows.length` (or item count).
- **Terminal too short**: still rendering too many items without slicing—compare `PickItemDialog`'s `visibleItemLimit` from `terminalSize.rows`.

## Fixes

1. **Match height to real rows** — Either reserve **one terminal row per selectable line** and **truncate/pad** strings in layout (see `TableLayouter` + `displayRows` in `PickItemDialog`), **or** compute **wrapped line counts** and set column/`EmptyArea` **`height`** to that total.
2. **Stop accidental wrap** — Prefer single-line row strings; avoid relying on `Text` wrapping inside a height-limited column unless you account for extra lines.
3. **Cap visible items** — Derive max rows from **`useTerminalSize().rows`** minus chrome (borders, title, footer); slice the list like `PickItemDialog`.
4. **Debug checklist** — Compare **`height={listHeight}`** (and outer `dialogHeight`) to **each child's line count**; test **narrow terminal + long labels**.

## Reference pattern

`src/views/components/PickItemDialog.tsx` — centered `EmptyArea`, bordered `Box`, inner column `Box` with explicit height, `inverse` selection, `useInput`.

Popup/input stacking: [.claude/skills/ink-popup-zustand/SKILL.md](../ink-popup-zustand/SKILL.md).

## Related files

- `src/views/components/PickItemDialog.tsx`
- `src/views/components/EmptyArea.tsx`
