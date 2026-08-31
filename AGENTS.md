# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build     # Bundle src/index.ts → dist/index.js via esbuild
npm test          # Run all Jest tests (568 tests across 76 files)
npm run lint      # ESLint on src/**/*.ts
npm run format    # Prettier format src/**/*.ts
npm run typecheck # TypeScript type check
```

Run tests matching a pattern:

```bash
npm test -- "test pattern"
```

## Architecture

**mudissue** is a CLI tool (`mud` binary) for managing specifications and issues stored as markdown files with YAML frontmatter in a folder-based structure.

### Layer Overview


| Layer          | Path                   | Role                                                                                                                    |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CLI entry      | `src/index.ts`         | yargs setup, command registration                                                                                       |
| Commands       | `src/commands/`        | One class per CLI command, extend `Command` base                                                                        |
| Helpers        | `src/helpers/`         | Cross-cutting orchestration (issue ID allocation, TUI create flows, cwd issue lookup)                                   |
| Rules          | `src/rules/`           | L4 domain reaction rules (e.g. linkage status post-hooks); registered at composition roots                              |
| Resources      | `src/resources/`       | Document and File Creation logic                                                                                        |
| Services       | `src/services/`        | Core business logic (filesystem/git/shell/registry, search, editor)                                                       |
| Storage        | `src/storage/`         | Filesystem abstraction for repos and issue folders                                                                      |
| Store          | `src/store/`           | Client-side and shared state via [Zustand](https://github.com/pmndrs/zustand) (`create`, often with `immer` middleware) |
| Types          | `src/types/`           | Shared TypeScript interfaces                                                                                            |
| Utils          | `src/utils/`           | Utility functions                                                                                                       |


### Module Dependency Hierarchy

See `docs/dev/module-layers.md` for the full dependency matrix and ESLint layer rules.

- `service` (`src/services/`): low-level singleton modules. Services should be stateless. They can depend on `src/types/`, but must not depend on other modules.
- `store` (`src/store/`): high-level singleton modules. Stores may hold application state. Stores must **not** import `src/helpers/` (L4); TUI flows that need helpers (e.g. issue create) belong in `src/helpers/` and are called from `src/views/`.
- `src/commands/`: command classes may use appropriate Zustand stores via `getState()` (e.g. `useCurrentTrackerRepoStore`, `IssueSearchStoreFactory`, `useGlobalConfigStore`). Purely headless commands must **not** use `useAppStore` / `AppStore`—that store is for the interactive TUI. **Exception:** commands whose job is to launch the TUI (`view`, `issue view`) may use `AppStore` when needed to prepare or sync interactive state.
- `src/helpers/`: shared orchestration at L4. Use for workflows that combine storage, stores, and services—e.g. `NextIssueIdHelper` (allocate/resolve issue IDs), `CreateIssueHelper` (TUI create/subissue), `ChangeIssueLabelHelper`, `CurrentIssueResolverHelper`. Do **not** place helpers under `src/utils/storage/` to bypass layer rules.
- `src/rules/`: L4 domain reaction rules (same layer as commands/helpers). Register from `src/index.ts`; lower layers must not import `src/rules/`.
- `src/utils/`: utility modules. Utilities may depend on services, but must not depend on store modules (this restriction applies to `src/utils`, not to `src/commands`).

### Store (`src/store/`)

- App and feature state live in Zustand stores (e.g. `useAppStore`, `IssueSearchStoreFactory`). Use `getState()` or hooks from TUI/views. Headless CLI command code should avoid `AppStore`, except for TUI-launch commands (`view`, `issue view`) (see **Module Dependency Hierarchy**).
- **Store-owned behavior:** Methods that read or interpret state held by a store belong on that store (e.g. `getSelectedIssues()`, `getCurrentPage()`), not as parallel helpers elsewhere. Callers use the store via `getState()` or hooks—do not reimplement the same logic in views, commands, or utils.
- **Type helpers use accessors:** Shared type definitions live in `src/types/`. When a type needs query or transform helpers, use the **accessor pattern** (`FooAccessor` + `accessFoo()`), not loose free-standing functions—see `accessIssueFolder()` in [`src/types/Issue.ts`](src/types/Issue.ts) and `.claude/skills/monad-accessor/SKILL.md`. Do not add parallel helper functions that duplicate accessor or store methods; that drifts and is hard to maintain.

### Glossary

For project folder, tracker folder, issues folder, issue folder, issue file, and `issue_file_pattern` (`fixed` | `short` | `long`), read `docs/dev/glossary.md`.

### Issue Folder Naming

For issue folder naming rules and examples, read `docs/concept/issue-folder.md`.

### Testing Conventions

- Test files mirror `src/` structure under `tests/`. **Do not** add dedicated tests for L1 services (`src/services/`); see `docs/dev/module-layers.md` (**Testing by layer**).
- **Logger:** You may assert that a logger method was called (e.g. `expect(mockLogger.info).toHaveBeenCalled()`). Do **not** assert on the exact message or arguments passed—that couples tests to copy and makes refactors costly.

### Code Conventions

- Class filenames use **CamelCase** (e.g. `TrackerRepoStorage.ts`); per-directory suffix rules are in `docs/dev/module-layers.md` and enforced by ESLint (`mudissue/filename-convention`).
- Tracker repo discovery (`find`, `findSubTrackerRepos`) and config loading live in `TrackerRepoStorage` (`src/utils/storage/`).
- Keep comments concise; document only non-obvious logic.
- When parsing structured config or registry values (JSON), prefer defining a Zod schema (e.g. `z.array(z.string())`) and using `safeParse` instead of ad-hoc `JSON.parse` checks.

