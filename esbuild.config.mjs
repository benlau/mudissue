import { readFileSync } from "node:fs";
import { build } from "esbuild";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const outfile = packageJson.main ?? "dist/index.js";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "node",
  format: "esm",
  banner: {
    js: `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
    `,
  },
  external: [
    "node:*",
    "commander",
    "gray-matter",
    "which",
    "better-sqlite3",
    "isomorphic-git",
    "sharp",
    "mermaid",
    "svgdom",
  ],
  loader: {
    ".tsx": "tsx",
    ".md": "text",
    ".conf": "text",
  },
  outfile,
});
