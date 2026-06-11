/**
 * sdd-review-ui クライアントの Vite 設定。
 * dev proxy の対象ポート（sdd-core サーバー = 7411）の定義はこのファイル 1 箇所のみ
 * （design.md File Structure Plan / steering structure.md「Single Source of Truth」）。
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/** sdd-core サーバーのポート（server/src/config.ts DEFAULT_PORT と対） */
const SDD_CORE_SERVER_ORIGIN = "http://localhost:7411";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": SDD_CORE_SERVER_ORIGIN,
    },
  },
});
