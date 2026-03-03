import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
    },
  },
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(import.meta.dirname, "tailwind.config.ts") }),
        autoprefixer(),
      ],
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/invoices": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
