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
    },
  },
  {
    ignores: ["node_modules/**", "out/**", "dist/**"],
  },
];
