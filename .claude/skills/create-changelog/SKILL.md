---
name: create-changelog
description: >-
  Generate a release changelog entry from commits since the latest git tag and
  prepend it to CHANGELOG.md. Use when the user asks to create a changelog,
  write release notes, or prepare CHANGELOG.md for the next version.
---

# Create changelog

Write a new release section for `CHANGELOG.md` from commits since the latest release tag.

## Steps

1. Run `git tag` (prefer version-sorted, e.g. `git tag --sort=-v:refname`) to find the latest release version (`LATEST_RELEASE_VERSION`).
2. Resolve the next release version:
   - If the user specified a version, use that.
   - Otherwise assign the next version from `LATEST_RELEASE_VERSION` (bump the patch segment of the existing tag scheme, e.g. `v0.0.3` → `v0.0.4`).
3. Run `git log LATEST_RELEASE_VERSION..HEAD` to list commits since the latest release.
4. Read `CHANGELOG.md` and match its existing style (headings, date format, bullet grouping, Keep a Changelog categories if present).
5. Draft the new changelog section from those commits, then **prepend** it to `CHANGELOG.md` (newest release first). Do not rewrite older entries.

## Done when

- `CHANGELOG.md` starts with the new version section.
- The section covers meaningful changes from `LATEST_RELEASE_VERSION..HEAD`.
- Style matches the rest of `CHANGELOG.md`.
