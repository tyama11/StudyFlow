import { defineConfig, type Plugin } from "vite";

// CDN 切り替え対象の外部ライブラリ定義
// - GitHub Pages ビルド時: CDN (jsDelivr) から読み込み、バンドルから除外して軽量化
// - デスクトップ (Tauri) ビルド時: node_modules からローカルに付属（同梱）して完全オフライン動作
const CDN_LIBRARIES: Record<string, { global: string; url: string }> = {
  "chart.js": {
    global: "Chart",
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js",
  },
  "chart.js/auto": {
    global: "Chart",
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js",
  },
  "canvas-confetti": {
    global: "confetti",
    url: "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js",
  },
};

function cdnResolverPlugin(isPages: boolean): Plugin {
  return {
    name: "studyflow-cdn-resolver",
    enforce: "pre",
    resolveId(id: string) {
      if (isPages && CDN_LIBRARIES[id]) {
        return `\0cdn-virtual:${id}`;
      }
      return null;
    },
    load(id: string) {
      if (isPages && id.startsWith("\0cdn-virtual:")) {
        const rawId = id.replace("\0cdn-virtual:", "");
        const lib = CDN_LIBRARIES[rawId];
        if (lib) {
          return `
            const globalLib = typeof window !== 'undefined' ? window.${lib.global} : undefined;
            export default globalLib;
            export const ${lib.global} = globalLib;
          `;
        }
      }
      return null;
    },
    transformIndexHtml(html: string) {
      if (!isPages) {
        // デスクトップ環境: CDNスクリプトタグは注入せず、すべてローカルにバンドル（付属）
        return html.replace("<!-- CDN_SCRIPTS -->", "");
      }
      // GitHub Pages 環境: CDNからライブラリを取得するスクリプトタグを注入
      const uniqueUrls = Array.from(new Set(Object.values(CDN_LIBRARIES).map((l) => l.url)));
      const tags = uniqueUrls
        .map((url) => `    <script src="${url}"></script>`)
        .join("\n");
      return html.replace(
        "<!-- CDN_SCRIPTS -->",
        `<!-- CDN Libraries (Loaded on GitHub Pages for performance & caching) -->\n${tags}`
      );
    },
  };
}

export default defineConfig(() => {
  const isPages = process.env["GITHUB_PAGES"] === "true";

  return {
    // GitHub Pages では /StudyFlow/、デスクトップ (Tauri) では ./ (相対パス)
    base: isPages ? "/StudyFlow/" : "./",
    clearScreen: false,
    server: {
      strictPort: true,
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    define: {
      __IS_PAGES__: JSON.stringify(isPages),
    },
    plugins: [cdnResolverPlugin(isPages)],
  };
});
