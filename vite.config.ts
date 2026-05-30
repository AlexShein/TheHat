import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
    environment: "node",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/game/**"],
      thresholds: {
        functions: 80,
      },
    },
  },
})
