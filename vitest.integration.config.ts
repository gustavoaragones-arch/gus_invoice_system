import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/integration/**/*.test.ts", "tests/application/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    // All integration tests share one embedded Postgres instance booted
    // once in globalSetup; run test files sequentially in a single fork
    // so RLS session state (SET LOCAL per transaction) and table state
    // between tests stay predictable.
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
