import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import mudissue from "./src/dev-tools/eslint-plugin-mudissue/index.mjs";

const layers = [
  {
    dirs: [
      "./src/types",
      "./src/foundation",
    ],
  },
  {
    dirs: [
      "./src/services",
      "./src/db",
    ],
  },
  {
    dirs: ["./src/async"],
  },
  { dirs: ["./src/store"] },
  {
    dirs: [
      "./src/commands",
      "./src/views",
      "./src/contexts",
      "./src/helpers",
      "./src/rules",
    ],
  },
];

function layerLabel(dir) {
  return dir.replace(/^\.\/src\//, "");
}

function buildLayerZones() {
  const zones = [];
  for (let i = 0; i < layers.length; i++) {
    const higherDirs = layers.slice(i + 1).flatMap((layer) => layer.dirs);
    for (const target of layers[i].dirs) {
      for (const from of higherDirs) {
        zones.push({
          target,
          from,
          message: `${layerLabel(target)} must not import ${layerLabel(from)}`,
        });
      }
    }
  }
  return zones;
}

const layerZones = buildLayerZones();

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      import: importPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "import/no-restricted-paths": ["error", { zones: layerZones }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/dev-tools/**"],
    plugins: { mudissue },
    rules: {
      "mudissue/filename-convention": "error",
      "mudissue/no-new-src-directory": "error",
    },
  },
  {
    files: ["src/index.ts", "src/App.tsx"],
    rules: {
      "import/no-restricted-paths": "off",
    },
  },
  {
    ignores: ["node_modules/**", "out/**", "dist/**"],
  },
];
