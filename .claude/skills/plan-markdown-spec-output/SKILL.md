---
name: plan-markdown-spec-output
description: Enforce plan file output for Markdown input in plan mode. Use when the user provides a Markdown file and asks for planning or plan edits.
---

# Plan Markdown Spec Output

## Purpose

Ensure plan documents are always written to a sibling `.spec.md` file derived from the user-provided Markdown input path.

## Trigger Conditions

Apply this skill when all are true:

1. The agent is operating in plan mode.
2. The user provides an input file path ending with `.md`.
3. The task is to create, revise, or continue a plan.

## Output Path Rule

For an input file path `<dir>/<name>.md`, the plan file path must be:

`<dir>/<name>.spec.md`

Never write the plan into `<name>.md` directly.

## Required Behavior

1. **Initial plan creation:** write the new plan to `<name>.spec.md`.
2. **Plan edit requests:** read and update the existing `<name>.spec.md`.
3. **Subsequent refinements:** keep writing only to `<name>.spec.md`.
4. **If `<name>.spec.md` does not exist during edit:** create it, then apply the requested changes.

## Path Examples

- `~/any_path_spec/xxxx.md` -> `~/any_path_spec/xxxx.spec.md`
- `/repo/docs/auth-plan.md` -> `/repo/docs/auth-plan.spec.md`

## Notes

- Preserve the same directory as the input file.
- Replace only the final `.md` suffix with `.spec.md`.
