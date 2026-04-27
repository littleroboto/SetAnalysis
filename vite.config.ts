/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// `base` is set to the repo name so GitHub Pages can serve assets from
// https://<user>.github.io/SetAnalysis/. For purely local dev (`npm run dev`)
// the leading slash is harmless. Override with `--base /` if you ever serve
// the dist/ folder from a domain root.
export default defineConfig({
  base: "/SetAnalysis/",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
