import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const headlessRestrictedImports = [
  {
    group: ["**/view/**", "view/**"],
    message:
      "sim/ and server/ are Node-safe: they must never import from the client-only view/ subtree.",
  },
  {
    group: ["@assets/*", "@css/*"],
    message:
      "sim/ and server/ are Node-safe: those aliases resolve through Vite and do not exist under tsconfig.server.json.",
  },
  {
    group: ["@atlasjs/nebula-webgpu", "@atlasjs/gizmos"],
    message:
      "sim/ and server/ are Node-safe: @atlasjs/nebula-webgpu fails to import in Node, and gizmos are presentation.",
  },
];

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/game/sim/**/*.ts", "src/server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: headlessRestrictedImports },
      ],
    },
  },
]);
