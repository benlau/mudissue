import path from "node:path";

const FUNCTION_NODE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "TSDeclareFunction",
]);

const NO_EXPORT_FUNCTION_PREFIXES = ["src/helpers/", "src/types/"];

function isNoExportFunctionFile(filename, cwd) {
  if (filename.endsWith(".d.ts")) {
    return false;
  }
  const relative = path.relative(cwd, filename).split(path.sep).join("/");
  if (relative.startsWith("..")) {
    return false;
  }
  return NO_EXPORT_FUNCTION_PREFIXES.some(
    (prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix),
  );
}

function isAccessName(name) {
  return typeof name === "string" && name.startsWith("access");
}

function isFunctionNode(node) {
  return node != null && FUNCTION_NODE_TYPES.has(node.type);
}

function reportFunction(context, node, name) {
  if (isAccessName(name)) {
    return;
  }
  context.report({
    node,
    messageId: "noExportFunction",
  });
}

function exportedNameIsFunction(scope, name) {
  let current = scope;
  while (current) {
    const variable = current.set.get(name);
    if (variable) {
      return variable.defs.some((def) => {
        if (def.node.type === "FunctionDeclaration") {
          return true;
        }
        if (def.node.type === "TSDeclareFunction") {
          return true;
        }
        if (
          def.node.type === "VariableDeclarator" &&
          isFunctionNode(def.node.init)
        ) {
          return true;
        }
        return false;
      });
    }
    current = current.upper;
  }
  return false;
}

export const noExportFunctionRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exported functions in src/helpers and src/types except functions named access*",
    },
    schema: [],
    messages: {
      noExportFunction:
        "Do not export functions from src/helpers or src/types. Use class-based static methods instead. See .claude/skills/monad-accessor/SKILL.md",
    },
  },
  create(context) {
    const cwd = context.cwd ?? process.cwd();
    if (!isNoExportFunctionFile(context.filename, cwd)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    return {
      ExportNamedDeclaration(node) {
        if (node.exportKind === "type") {
          return;
        }

        const declaration = node.declaration;
        if (declaration) {
          if (
            declaration.type === "FunctionDeclaration" ||
            declaration.type === "TSDeclareFunction"
          ) {
            reportFunction(context, declaration, declaration.id?.name);
            return;
          }
          if (declaration.type === "VariableDeclaration") {
            for (const declarator of declaration.declarations) {
              if (!isFunctionNode(declarator.init)) {
                continue;
              }
              const name =
                declarator.id.type === "Identifier" ? declarator.id.name : null;
              reportFunction(context, declarator, name);
            }
          }
          return;
        }

        const scope = sourceCode.getScope(node);
        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") {
            continue;
          }
          const localName = specifier.local.name;
          if (!exportedNameIsFunction(scope, localName)) {
            continue;
          }
          reportFunction(context, specifier, specifier.exported.name);
        }
      },
      ExportDefaultDeclaration(node) {
        if (!isFunctionNode(node.declaration)) {
          return;
        }
        const name =
          node.declaration.type === "FunctionDeclaration" ||
          node.declaration.type === "TSDeclareFunction"
            ? node.declaration.id?.name
            : null;
        reportFunction(context, node.declaration, name);
      },
    };
  },
};
