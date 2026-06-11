/**
 * Playwright 設定（sdd-review-ui E2E / tasks.md 10.1 / design.md「Testing Strategy」E2E Tests・
 * File Structure Plan `sdd-dashboard/e2e/`）。
 *
 * 実 sdd-core サーバー + フィクスチャリポジトリに対して実行する。webServer で 2 つのサーバーを
 * 起動する:
 *   1. sdd-core サーバー（server/src/index.ts）をフィクスチャ「コピー」へ向けてポート 7411 で起動。
 *      live-update シナリオ（10.1 シナリオ 2）が requirements.md をディスク上で書き換えるため、
 *      コミット済みフィクスチャを汚さないよう start-core-server.ts が temp ディレクトリへ複製する
 *      （Playwright は globalSetup より先に webServer を起動するため複製はランチャ側に置く）。
 *   2. クライアント（vite dev）をポート 5180 で起動。vite.config.ts の dev proxy が `/api` を
 *      7411 の sdd-core へ転送するため、両ポートは固定で対にする。
 *
 * baseURL はクライアント（5180）。SSE 駆動のライブ更新を待つため expect/action のタイムアウトは
 * 既定より緩める（ローカル実サーバー前提）。
 */
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, CLIENT_PORT, DASHBOARD_ROOT, E2E_DIR, SDD_CORE_PORT } from "./paths";

export default defineConfig({
  testDir: E2E_DIR,
  // sdd-core / client 双方の起動を含めローカル実サーバー前提で余裕を持たせる。
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  outputDir: `${E2E_DIR}test-results`,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // フィクスチャ temp コピー作成 → TEMP_REPO_POINTER へパス書き出しは start-core-server.ts が
  // 担う（Playwright は globalSetup より先に webServer を起動するため）。teardown で temp を削除。
  globalTeardown: `${E2E_DIR}global-teardown.ts`,
  webServer: [
    {
      // sdd-core を temp フィクスチャコピーへ向けて起動する（複製 + TEMP_REPO_POINTER 書き出しは
      // ランチャ自身が行う）。tsx は e2e/node_modules にあるため cwd=E2E_DIR で起動する。
      // reuseExistingServer は常に false: 7411 に居るかもしれない開発用サーバーは別リポジトリを
      // 指すため再利用すると live-update が成立しない。必ず本ランチャで temp フィクスチャを起動する。
      command: `node --import tsx start-core-server.ts`,
      url: `http://127.0.0.1:${SDD_CORE_PORT}/api/repo`,
      cwd: E2E_DIR,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npm run dev -- --port ${CLIENT_PORT} --strictPort`,
      url: BASE_URL,
      cwd: `${DASHBOARD_ROOT}client`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
