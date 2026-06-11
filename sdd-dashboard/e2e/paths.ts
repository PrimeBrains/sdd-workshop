/**
 * E2E の共有パス定数（playwright.config.ts / global-setup / global-teardown /
 * start-core-server / review.spec が同じ値を参照するための単一定義）。
 *
 * live-update シナリオ（10.1 シナリオ 2）はフィクスチャの requirements.md をディスク上で
 * 書き換えるため、コミット済みフィクスチャ（server/test/fixtures/repo）を汚さないよう
 * temp コピーへ向けて sdd-core を起動する。コピー先パスは globalSetup が決めて
 * TEMP_REPO_POINTER に書き出し、サーバー起動コマンドと spec がそれを読む。
 */
import { fileURLToPath } from "node:url";

/** e2e/ ディレクトリ絶対パス（このファイルの所在 = e2e/）。 */
export const E2E_DIR = fileURLToPath(new URL(".", import.meta.url));

/** sdd-dashboard ルート（e2e/ の親）。 */
export const DASHBOARD_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** コミット済みフィクスチャリポジトリ（複製元。書き換えない）。 */
export const FIXTURE_SOURCE_REPO = `${DASHBOARD_ROOT}server/test/fixtures/repo`;

/** sdd-core サーバーのポート（client/vite.config.ts の dev proxy 先と対）。 */
export const SDD_CORE_PORT = 7411;

/** クライアント（vite dev）のポート。baseURL の対象。 */
export const CLIENT_PORT = 5180;

/** baseURL（クライアント）。 */
export const BASE_URL = `http://localhost:${CLIENT_PORT}`;

/**
 * globalSetup が複製した temp フィクスチャの絶対パスを書き出すポインタファイル。
 * webServer の sdd-core 起動（start-core-server.ts）と spec が同じパスを参照する受け渡し点。
 */
export const TEMP_REPO_POINTER = `${E2E_DIR}.tmp-repo-path`;
