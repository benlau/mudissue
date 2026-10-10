import path from "node:path";

/**
 * Folders under tests/ that must not exist. Each name mirrors a src/ directory
 * that is not part of the tested product surface.
 */
const disallowedTestFolders = ["dev-tools"];

function getRepoRelativePath(filename, cwd) {
  const relative = path.relative(cwd, filename).split(path.sep).join("/");
  if (relative.startsWith("..")) {
    return null;
  }
  return relative;
}

/**
 * @param {string} relativePath Repo-relative path (posix).
 * @returns {string | null} Disallowed folder name under tests/, if any.
 */
export function disallowedTestFolder(relativePath) {
  if (!relativePath.startsWith("tests/")) {
    return null;
  }
  const underTests = relativePath.slice("tests/".length);
  for (const folder of disallowedTestFolders) {
    if (underTests === folder || underTests.startsWith(`${folder}/`)) {
      return folder;
    }
  }
  return null;
}

export const noTestFolderRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow test files under folders that mirror untested src directories, such as src/dev-tools",
    },
    schema: [],
    messages: {
      disallowed:
        "tests/{{folder}} is not allowed. Do not write tests for src/{{folder}}.",
    },
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();

    return {
      Program(node) {
        const relativePath = getRepoRelativePath(context.filename, cwd);
        if (relativePath == null) {
          return;
        }
        const folder = disallowedTestFolder(relativePath);
        if (folder == null) {
          return;
        }
        context.report({
          node,
          messageId: "disallowed",
          data: { folder },
        });
      },
    };
  },
};
