---
name: mudissue-unittests
description: How to write unit tests in this repo—no real filesystem, mock FileService for I/O, DAMP whole formatter output; do not assert exact user-facing or log message strings
---

# Unit tests

## 1. Do not use the real filesystem for test data

- Do not create files or directories on disk to set up tests (no `fs` / `fs.promises`, no temp folders under `/tmp`, no writing fixtures beside the test run).
- Tests should be fast, deterministic, and runnable anywhere without leaving artifacts.

## 2. Mock `FileService` for file I/O

- Production code must use `FileService` for filesystem access; tests should **not** mock Node’s `fs` module.
- Build a mock object with `jest.fn()` for the methods the code under test actually calls (often a `Pick<FileService, "exists" | "readFile" | ...>`), then:
  - `mockResolvedValue` / `mockRejectedValue` for async results, or
  - `mockImplementation` when behavior depends on the path argument.
- Use `createMockSystemContext()` in `beforeEach`; it calls `FileService.setInstance(mock)` so production code using `FileService.getInstance()` uses the mock.
- `jest.spyOn(SomeClass.prototype, "method")` and `Service.setInstance(mock)` are both acceptable for stubbing collaborators.
- External libraries that touch the OS should be wrapped by a service first (for example, `ShellService.open()` wraps the `open` package), then tests should mock that service instead of the library.

## 3. User-facing copy vs deterministic formatter output

Two different rules apply depending on what you are asserting.

### User-facing copy — do not assert exact strings

For **logger calls, toasts, CLI stderr, confirmation prompts, and other copy shown to users**, do **not** assert the exact message text. That couples tests to wording and makes refactors expensive.

Prefer: assert that a logger method was called (`toHaveBeenCalled()`), structured error codes (`toMatchObject({ error: { code: "..." } })`), mock call counts, side effects, or return shapes—without matching full message bodies.

Same idea as **Testing Conventions** in `AGENTS.md` for loggers.

For thrown errors whose message is user-facing CLI copy, assert **structure** (error type, file path present, field name mentioned) with patterns like `toThrow(/Invalid config/)` and `toThrow(miConfPath)` — not the full `Error.message` string.

### Formatter / transform output — assert the whole value (DAMP)

For **pure formatters and transforms** whose job is to produce a deterministic string or object (e.g. `ZodErrorFormatter`, `MermaidGitGraphGenerator`), the test is the spec. A reader must see the **full expected output** without guessing.

- Prefer `expect(result).toEqual("...")` or `expect(result).toEqual({ ... })` with inline literals.
- Do **not** use vague partial checks (`toMatch(/field/)`, `toContain("fragment")`) when the output is small and deterministic — that hides the real contract.
- If the output is large, use `toMatchSnapshot()` (see `tests/types/GitGraph.test.ts`).

```ts
// Bad — reader cannot tell what the formatter actually produces
expect(formatted).toMatch(/priority_list/);
expect(formatted).toContain("worktree_git_ff_only_enabled:");

// Good — whole output is visible in the test
expect(ZodErrorFormatter.format(parsed.error)).toEqual(
  "priority_list.0: Invalid input: expected string, received object; worktree_git_ff_only_enabled: Invalid input: expected boolean, received string",
);
```

## 4. Do not dynamically import internal modules in tests

- Use normal static imports for internal modules under `src/` and `tests/`.
- Do not use `await import("../../src/...")` just to apply a mock before loading the module under test. It hides dependencies and makes tests harder to read.
- Do not use `moduleNameMapper` or manual package mocks to replace application dependencies when a service wrapper can be mocked instead. Prefer `Service.setInstance(mock)` or `jest.spyOn` in test setup.

## 5. Do not mock the database

- Database behavior should be tested against the configured test database or through higher-level service boundaries, not by mocking the database driver.
- Keep filesystem and OS integration mocked through services; do not apply that rule to database access.

## 6. One test file per module

- Mirror `src/` under `tests/` with a **single** test file per production module: `ModuleName.test.ts` or `ModuleName.test.tsx`.
- Do **not** create multiple test files for the same module split by purpose (e.g. unit vs render, logic vs UI).
- **Exception:** component Ink snapshot tests live in the single shared file `tests/views/components/snapshots/components.snapshot.test.tsx` — not per-component `*.snapshot.test.tsx` files.

Allowed test filenames (enforced by `mudissue/test-filename-convention`):

- `*.test.ts`
- `*.test.tsx`
- `tests/views/components/snapshots/components.snapshot.test.tsx` (component snapshots only)

Not allowed: purpose-specific suffixes such as `*.render.test.tsx`, `*.integration.test.ts`, or any other `*.snapshot.test.tsx`.

```text
# Bad — two test files for one component
CustomViewComponent.test.tsx
CustomViewComponent.render.test.tsx

# Bad — per-component snapshot file
CustomViewComponent.snapshot.test.tsx

# Good — one main test file; add Ink snapshots to the shared snapshot file
CustomViewComponent.test.tsx
tests/views/components/snapshots/components.snapshot.test.tsx
```

## 7. Do not spy on Zustand `getState`

- Do **not** use `jest.spyOn(useSomeStore, "getState")` or `jest.spyOn(useSomeStore.getState(), "someAction")` to stub store behavior. Spies on `getState` are brittle and do not match how production code reads the store after `setState`.
- Prefer **`useSomeStore.setState({ someAction: jest.fn().mockResolvedValue(...) })`** (partial merge) so the real store’s `getState()` returns the mocked actions.
- Reset store state in `afterEach` with the module’s `reset*Store()` helper when available.
- For singleton **services** (`RegistryService`, `FileService`, …), `Service.setInstance(mock)` or `jest.spyOn(Service.getInstance(), "method")` is still fine—this rule applies to **Zustand stores** only.

## Reference pattern

See `tests/commands/IssueArchiveCommand.test.ts`: `createMockSystemContext()` in `beforeEach`, then `new IssueArchiveCommand()` with no constructor arguments.