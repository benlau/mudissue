# ADR-001: Issue ID and Issue Slug Naming

**Date**: 2026-09-14
**Status**: Accepted
**Deciders**: Ben Lau

## Context

MudIssue stores each issue in a folder whose name is built from an optional prefix, a number, and an optional title-derived suffix:

```
{issue_prefix}{issue_num}[-{issue_suffix}]
```

Historically we called the full folder basename the **issue ID**, because prefix + number alone might collide when two issues share the same number with different suffixes. We called prefix + number the **label**.

That naming confused readers of the user guide:

- “Label” sounds like a free-form tag, not the primary identifier users allocate and change.
- The folder basename is **not** a true global unique ID either: uniqueness holds only within one issues tree, and workspaces / sync can still introduce collisions.
- Therefore mudissue has no globally unique issue identifier. Naming should reflect everyday use, not a false uniqueness guarantee.

## Decision

1. **Issue ID** = `[issue_prefix]` + `issue_num` (prefix optional). Example: `MZ0003`.
2. **Issue Slug** = Issue ID + optional `-` + `issue_suffix`. Example: `MZ0003-issue-id-and-issue-slug`.
3. **Issue slug is the official term for the issue folder basename.** “Issue folder name” and “issue slug” refer to the same string.
4. Retire **“issue label”** as a domain term in docs and user-facing UX. Prefer **issue ID**.
5. The palette and CLI command that reassigns prefix + number is **Change Issue ID** / `mud issue change-id` (formerly Change Label / `change-label`).

Uniqueness expectations:

- Issue ID need not be unique across folders that differ only by suffix.
- Issue slug is unique within a single issues directory at create/rename time.
- Across devices or users, prefer distinct prefixes (see [distributed.md](../user/distributed.md)); do not invent opaque global IDs.

## Consequences

### Positive Consequences

- Docs and CLI match how users talk about issues (`MZ0003` is the ID; the folder is the slug).
- Create `--id` and change-id operate on the same concept (prefix + number).
- “Label” is freed for unrelated UI chrome (palette command labels, script labels).

### Negative Consequences

- Existing code still uses inverted names (`IssueFolder.label` = PREFIX+NUM, `IssueFolder.issueId` = folder basename) until a follow-up rename.
- Copy-to-clipboard and some help strings may still say “Issue ID” while copying the slug until updated.
- Renaming `change-label` to `change-id` breaks scripts that call the old command name (no alias in this change).

### Mitigation Strategies

- Ship docs and UX renames with this ADR.
- Record a suggested code rename map below; apply it in a dedicated follow-up.
- Document unique prefixes for distributed setups instead of promising global IDs.

## Suggested code renames (follow-up)

Current types are **inverted** relative to this ADR. Apply when ready:

| Current | Suggested | Notes |
|---------|-----------|-------|
| `IssueFolder.label` | `issueId` | PREFIX+NUM; what create `--id` / change-id edit |
| `IssueFolder.issueId` | `issueSlug` | Folder basename; official slug term |
| `isIssueLabel` / `extractIssueLabel` | `isIssueId` / `extractIssueId` | Today’s `isIssueId` means full folder → `isIssueSlug` / `extractIssueSlug` |
| `isSameIssueLabel` | `isSameIssueId` | |
| Local `slug` / `extractIssueSuffix` | Prefer `issueSlug` for the **full** folder name; keep “suffix” for the trailing segment only | Avoid calling the suffix alone “slug” |
| `issueIdForTitle(label, title)` | `issueSlugForTitle(issueId, title)` or `folderNameForTitle` | |
| `withSlug(label, slug)` | `withSuffix(issueId, suffix)` or build slug explicitly | |
| Branch template `issue_label` | `issue_id`; today’s `issue_id` → `issue_slug` (alias old vars if needed) | |
| `--add-label` on file attach | `--add-issue-id` | |
| Copy-to-clipboard “Issue ID” copying `issue.issueId` | Label as **Issue Slug**, and/or copy `issue.label` as **Issue ID** | User-facing mismatch under new terms |
| `NextIssueIdHelper` | Keep | Already means PREFIX+NUM |

**Stay as-is:** filesystem locals (`folderName`, pinned folder name lists, rename APIs), palette chrome `.label` properties, markdown “label” for UI chrome.

**Recommended follow-up order:** (1) type fields + matchers, (2) templates/flags/clipboard, (3) sweep tests / `buildIssueFolder`.

## References

- [Issue folder naming rules](../concept/issue-folder.md)
- [Using MudIssue in distributed environments](../user/distributed.md)
- Glossary: [Issue folder](../dev/glossary.md)
