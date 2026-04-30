import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/game/**"],
      thresholds: {
        functions: 80,
      },
    },
  },
})
