import sveltePlugin from "eslint-plugin-svelte"
import svelteParser from "svelte-eslint-parser"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["build/", ".svelte-kit/", "node_modules/", "coverage/", "static/"],
  },
  ...tseslint.configs.recommended,
  ...sveltePlugin.configs["flat/recommended"],
  // Override: use svelte-eslint-parser + TS parser for .svelte script blocks.
  // flat/recommended uses processors (espree for JS), which don't understand TS.
  {
    files: ["**/*.svelte", "*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ["**/*.svelte.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "svelte/no-at-html-tags": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Scripts need console output — must come after general rules to override
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]
