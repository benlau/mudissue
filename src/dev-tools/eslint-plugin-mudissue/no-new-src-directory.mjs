import fs from "node:fs";
import path from "node:path";

const MODULE_LAYERS_DOC = "docs/dev/module-layers.md";

/** Frozen allowlist of directories under src/. Update only after human approval. */
const allowedSrcDirectories = new Set([
  "src",
  "src/assets",
  "src/assets/templates",
  "src/commands",
  "src/contexts",
  "src/dev-tools",
  "src/dev-tools/eslint-plugin-mudissue",
  "src/db",
  "src/db/migrations",
  "src/foundation",
  "src/foundation/formatter",
  "src/foundation/layouter",
  "src/foundation/matchers",
  "src/foundation/parser",
  "src/helpers",
  "src/rules",
  "src/services",
  "src/store",
  "src/types",
  "src/async",
  "src/async/generators",
  "src/async/launchers",
  "src/async/resources",
  "src/async/search",
  "src/async/storage",
  "src/async/travelers",
  "src/async/validators",
  "src/views",
  "src/views/components",
  "src/views/hooks",
  "src/views/PaletteCommands",
]);

/** One full-tree scan per ESLint CLI run. */
let directoryScanDone = false;

function collectSrcDirectories(srcDir, relativeBase = "src") {
  const dirs = [relativeBase];
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const childDir = path.join(srcDir, entry.name);
    dirs.push(
      ...collectSrcDirectories(childDir, `${relativeBase}/${entry.name}`),
    );
  }
  return dirs;
}

function findUnknownSrcDirectories(srcDir) {
  return collectSrcDirectories(srcDir).filter(
    (dir) => !allowedSrcDirectories.has(dir),
  );
}

export const noNewSrcDirectoryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow new directories under src/ unless added to the allowlist",
    },
    schema: [],
    messages: {
      unknown: `{{dir}}: Unknown directory under src/. If you want to create a new directory, ask for approval from a human with an explanation. See ${MODULE_LAYERS_DOC} for where new code belongs.`,
    },
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();

    return {
      Program(node) {
        if (directoryScanDone) {
          return;
        }
        directoryScanDone = true;

        for (const dir of findUnknownSrcDirectories(path.join(cwd, "src"))) {
          context.report({
            node,
            messageId: "unknown",
            data: { dir },
          });
        }
      },
    };
  },
};
