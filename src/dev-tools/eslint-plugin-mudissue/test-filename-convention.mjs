import path from "node:path";

const UNITTEST_SKILL = ".claude/skills/unittests/SKILL.md";

export const ALLOWED_SNAPSHOT_TEST_PATH =
  "tests/views/components/snapshots/components.snapshot.test.tsx";

/** @type {RegExp[]} */
export const ALLOWED_TEST_FILENAME_PATTERNS = [
  /^[^./]+\.test\.ts$/,
  /^[^./]+\.test\.tsx$/,
];

/**
 * @param {string} basename
 * @returns {boolean}
 */
export function looksLikeTestFile(basename) {
  return /\.test\.tsx?$/.test(basename);
}

/**
 * @param {string} relativePath Repo-relative path (posix).
 * @returns {boolean}
 */
export function isAllowedTestFilename(relativePath) {
  if (relativePath === ALLOWED_SNAPSHOT_TEST_PATH) {
    return true;
  }

  const basename = path.basename(relativePath);
  return ALLOWED_TEST_FILENAME_PATTERNS.some((re) => re.test(basename));
}

function getRepoRelativePath(filename, cwd) {
  const relative = path.relative(cwd, filename).split(path.sep).join("/");
  if (relative.startsWith("..")) {
    return null;
  }
  return relative;
}

export const testFilenameConventionRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce allowed test filename patterns under tests/ (*.test.ts, *.test.tsx; component snapshots only in tests/views/components/snapshots/components.snapshot.test.tsx)",
    },
    schema: [],
    messages: {
      invalid: `Test filename is not allowed. Use *.test.ts or *.test.tsx (one test file per module). Component Ink snapshots belong in tests/views/components/snapshots/components.snapshot.test.tsx only — no other *.snapshot.test.tsx files. See ${UNITTEST_SKILL}.`,
    },
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();

    return {
      Program(node) {
        const relativePath = getRepoRelativePath(context.filename, cwd);
        if (!relativePath?.startsWith("tests/")) {
          return;
        }

        const basename = path.basename(relativePath);
        if (!looksLikeTestFile(basename) || isAllowedTestFilename(relativePath)) {
          return;
        }

        context.report({
          node,
          messageId: "invalid",
        });
      },
    };
  },
};
