import typescriptParser from "@typescript-eslint/parser";
import mudissue from "./src/dev-tools/eslint-plugin-mudissue/index.mjs";

export default [
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    plugins: { mudissue },
    rules: {
      "mudissue/test-filename-convention": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "fs",
              message:
                "Do not import fs in tests. Mock FileService instead. See .claude/skills/unittests/SKILL.md.",
            },
            {
              name: "node:fs",
              message:
                "Do not import fs in tests. Mock FileService instead. See .claude/skills/unittests/SKILL.md.",
            },
            {
              name: "fs/promises",
              message:
                "Do not import fs in tests. Mock FileService instead. See .claude/skills/unittests/SKILL.md.",
            },
            {
              name: "node:fs/promises",
              message:
                "Do not import fs in tests. Mock FileService instead. See .claude/skills/unittests/SKILL.md.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["node_modules/**", "out/**", "dist/**"],
  },
];
