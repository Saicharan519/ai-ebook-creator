import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Bundle the workspace package; it ships TypeScript source, not built JS
  noExternal: ["@ebook/shared"],
});
