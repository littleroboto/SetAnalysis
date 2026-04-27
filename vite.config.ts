/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// `base` is set to the repo name so GitHub Pages can serve assets from
// https://<user>.github.io/SetAnalysis/. For purely local dev (`npm run dev`)
// the leading slash is harmless. Override with `--base /` if you ever serve
// the dist/ folder from a domain root.

/**
 * Read the latest git commit so the landing footer can show a "Latest"
 * stamp. We resolve at config load time (i.e. build/dev start) and bake
 * the result into the bundle via `define`. If git isn't available (e.g.
 * a tarball install) we fall back to "unknown".
 */
function readGitCommit(): { sha: string; subject: string; date: string } {
  try {
    const sha = execSync("git rev-parse --short=7 HEAD").toString().trim();
    const subject = execSync("git log -1 --pretty=%s").toString().trim();
    const date = execSync("git log -1 --pretty=%cI").toString().trim();
    return { sha, subject, date };
  } catch {
    return { sha: "unknown", subject: "", date: "" };
  }
}

const gitCommit = readGitCommit();

export default defineConfig({
  base: "/SetAnalysis/",
  define: {
    __GIT_SHA__: JSON.stringify(gitCommit.sha),
    __GIT_SUBJECT__: JSON.stringify(gitCommit.subject),
    __GIT_DATE__: JSON.stringify(gitCommit.date),
  },
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
