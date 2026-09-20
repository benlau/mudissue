import path from "node:path";

const MODULE_LAYERS_DOC = "docs/dev/module-layers.md";

/**
 * Longest matching directory wins. Order in this array does not matter.
 * Each entry: directory (posix, no trailing slash), regexes, optional exceptions (exact basenames).
 */
const filenameConventionRules = [
  {
    directory: "src",
    rootOnly: true,
    exceptions: ["index.ts", "App.tsx", "constants.ts", "intl.ts"],
  },
  {
    directory: "src/commands",
    regexes: [/^.+Command\.tsx?$/],
    exceptions: ["Command.ts", "index.ts"],
  },
  {
    directory: "src/services",
    regexes: [/^.+Service\.ts$/],
  },
  {
    directory: "src/store",
    regexes: [/^.+Store\.ts$/],
  },
  {
    directory: "src/helpers",
    regexes: [/^.+Helper\.ts$/],
  },
  {
    directory: "src/rules",
    regexes: [/^.+Rule\.ts$/],
  },
  {
    directory: "src/contexts",
    regexes: [/^.+Context\.tsx$/],
  },
  {
    directory: "src/db/migrations",
    regexes: [/^\d{6}_\d{3}_[a-z0-9_]+\.ts$/],
    exceptions: ["index.ts", "types.ts"],
  },
  {
    directory: "src/db",
    exceptions: ["DatabaseService.ts", "KyselySqlite.ts", "types.ts"],
  },
  {
    directory: "src/types",
    regexes: [/^([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*)\.ts$/],
    exceptions: ["modules.d.ts"],
  },
  {
    directory: "src/foundation/formatter",
    regexes: [/^.+Formatter\.ts$/],
  },
  {
    directory: "src/foundation/layouter",
    regexes: [/^.+Layouter\.ts$/],
  },
  {
    directory: "src/foundation/matchers",
    regexes: [/^.+Matcher\.ts$/],
  },
  {
    directory: "src/foundation/parser",
    regexes: [/^.+Parser\.ts$/],
  },
  {
    directory: "src/utils/storage",
    regexes: [/^.+Storage\.ts$/],
  },
  {
    directory: "src/utils/resources",
    exceptions: ["Resource.ts", "IssueResource.ts", "index.ts"],
  },
  {
    directory: "src/utils/validators",
    regexes: [/^.+Validator\.ts$/],
  },
  {
    directory: "src/utils/search",
    exceptions: ["IssueSearcher.ts", "SearchQueryParser.ts", "types.ts"],
  },
  {
    directory: "src/utils/travelers",
    regexes: [/^.+Traveler\.ts$/],
    exceptions: ["Traveler.ts", "TravelerFactory.ts"],
  },
  {
    directory: "src/utils/launchers",
    regexes: [/^.+Launcher\.ts$/],
  },
  {
    directory: "src/utils/generators",
    regexes: [/^.+Generator\.ts$/],
  },
  {
    directory: "src/utils",
    disallowFiles: true,
  },
  {
    directory: "src/views/hooks",
    regexes: [/^use[A-Z][a-zA-Z0-9]*\.ts$/],
  },
  {
    directory: "src/views/PaletteCommands",
    regexes: [/^.+PaletteCommand\.ts$/],
    exceptions: ["PaletteCommandRegistry.ts"],
  },
  {
    directory: "src/views/components",
    regexes: [/^.*\.tsx$/],
    exceptions: [
    ],
  },
];

const rulesByDepth = [...filenameConventionRules].sort(
  (a, b) => b.directory.split("/").length - a.directory.split("/").length,
);

function findFilenameConventionRule(relativePath) {
  const parts = relativePath.split("/");
  if (parts[0] !== "src") {
    return null;
  }

  for (const rule of rulesByDepth) {
    if (rule.rootOnly) {
      if (parts.length === 2) {
        return rule;
      }
      continue;
    }
    const prefix = `${rule.directory}/`;
    if (relativePath.startsWith(prefix)) {
      return rule;
    }
  }
  return null;
}

function basenameMatchesRule(basename, rule) {
  if (rule.disallowFiles) {
    return false;
  }
  if (rule.exceptions?.includes(basename)) {
    return true;
  }
  const regexes = rule.regexes ?? [];
  if (regexes.length === 0 && rule.exceptions) {
    return false;
  }
  return regexes.some((re) => re.test(basename));
}

function getRepoRelativePath(filename, cwd) {
  const relative = path.relative(cwd, filename).split(path.sep).join("/");
  if (relative.startsWith("..")) {
    return null;
  }
  return relative;
}

export const filenameConventionRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce per-directory filename conventions under src/",
    },
    schema: [],
    messages: {
      invalid: `Filename does not match project conventions. See ${MODULE_LAYERS_DOC}.`,
      disallowFiles: `Files are not allowed directly in src/utils/. Place code in a subdirectory (storage/, resources/, validators/, search/, travelers/, launchers/, generators/). See ${MODULE_LAYERS_DOC}.`,
    },
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();

    return {
      Program(node) {
        const relativePath = getRepoRelativePath(context.filename, cwd);
        if (!relativePath?.startsWith("src/")) {
          return;
        }

        const rule = findFilenameConventionRule(relativePath);
        if (!rule) {
          return;
        }

        const basename = path.basename(relativePath);
        if (!basenameMatchesRule(basename, rule)) {
          context.report({
            node,
            messageId: rule.disallowFiles ? "disallowFiles" : "invalid",
          });
        }
      },
    };
  },
};
