import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages用: GITHUB_PAGES=true の場合にリポジトリ名をbaseとして設定
  base: process.env["GITHUB_PAGES"] === "true" ? "/StudyFlow/" : "/",
  clearScreen: false,
  server: {
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env["TAURI_ENV_PLATFORM"] === "windows" ? "chrome105" : "safari13",
    minify: !process.env["TAURI_ENV_DEBUG"] ? "esbuild" : false,
    sourcemap: !!process.env["TAURI_ENV_DEBUG"],
    outDir: "dist",
  },
});
