import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { NODE_ENV: "test" },
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one database, so files run one at a time
    fileParallelism: false,
  },
});
