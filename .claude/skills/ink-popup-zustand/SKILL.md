---
name: ink-popup-zustand
description: Use when writing or refactoring Ink popups, dialogs, toasts, or overlay components in this project with Zustand and PopupStore.
---

# Ink Popup Zustand

## Core Pattern

- Register every popup in `PopupNames` before using `PopupStore`.
- Open store-managed popups by calling `usePopupStore.getState().pushPopup(name)`.
- Close store-managed popups with `usePopupStore.getState().popPopup()`.
- Promise-returning popups should resolve their pending callback when they close or are replaced.
- Keep feature state in a Zustand store and render the Ink component from store selectors.

## Input Handling

- Gate popup `useInput` handlers with `isOpen && latestPopup === PopupNames.X`.
- Main views should continue using `hasPopup` to avoid receiving keys while a popup is visible.
- If a popup renders a `ToolBar`, define toolbar actions in toolbar items and pass `isDisabled` when the toolbar should ignore keys; do not duplicate those shortcuts in custom `useInput` branches.

## Layout

- Use `EmptyArea` behind bordered popups to clear content underneath.
- Bordered dialog `Box` sits inside `EmptyArea` with `marginLeft={1}` and `marginTop={1}` (import `EMPTY_AREA_SIDE_MARGIN` / `EMPTY_AREA_EXTRA` from `EmptyArea.tsx`).
- `EmptyArea` is 2 columns and 2 rows larger than the bordered box. For fixed-size dialogs, add `EMPTY_AREA_EXTRA` to `useDialogLayout` min/max so layout `width`/`height` are EmptyArea sizes and the inner box uses `width - EMPTY_AREA_EXTRA`. For `bigDialogLayout`, pass it to `useDialogLayout` unchanged (bordered size) and add `EMPTY_AREA_EXTRA` only in JSX (`width + EMPTY_AREA_EXTRA`, `marginLeft={left - EMPTY_AREA_SIDE_MARGIN}`).
- Use Ink `Box` borders for dialog chrome.
- Keep positioning based on `useTerminalSize()` and clamp margins to non-negative values.
- Prefer `EmptyArea position="absolute"` directly; avoid an extra fullscreen outer `Box`.

## Tests

- Add DAMP store tests for open, close, popup registration, and cleanup.
- Reset both the feature store and `usePopupStore` in each test.
- For Ink rendering changes, update `tests/views/components/snapshots/components.snapshot.test.tsx`.
- Wrap components that call `useIntl()` in `IntlProvider` in tests.
