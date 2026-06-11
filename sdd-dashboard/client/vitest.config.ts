/**
 * Vitest 設定 — vite.config.ts を継承し、jsdom 環境で src 配下の
 * コロケーションテスト（*.test.ts / *.test.tsx）を実行する。
 */
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      // jsdom に無い EventSource の既定スタブを注入（SSE 駆動テストは各自で上書き）
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
