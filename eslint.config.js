import sveltePlugin from "eslint-plugin-svelte"

export default [
  {
    ignores: ["build/", ".svelte-kit/", "node_modules/", "coverage/"],
  },
  ...sveltePlugin.configs["flat/recommended"],
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "svelte/no-at-html-tags": "error",
    },
  },
]
