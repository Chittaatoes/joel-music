import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  outDir: "dist",
  format: "esm",
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/^@shared/],
  external: ["./vite", "vite"],
  esbuildOptions(options) {
    options.alias = {
      "@shared": "../shared",
    };
  },
});
