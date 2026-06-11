/**
 * start-core-server — webServer から sdd-core サーバーを「temp フィクスチャコピー」へ向けて
 * 起動するランチャ（tasks.md 10.1 / Environment facts:「LIVE-UPDATE needs a WRITABLE fixture」）。
 *
 * Playwright は globalSetup より「先に」webServer を起動するため、フィクスチャの複製はこの
 * ランチャ自身が行う（globalSetup に置くと起動時にコピー先が未確定になる）。手順:
 *   1. コミット済みフィクスチャ（FIXTURE_SOURCE_REPO）を temp ディレクトリへ複製する。
 *   2. 複製先の絶対パスを TEMP_REPO_POINTER へ書き出す（review.spec がここを書き換える）。
 *   3. server/src/index.ts の本番経路 `runCli` を repoPath + `--port 7411` で起動する。
 *
 * これにより sdd-core の chokidar はコピー側を監視し、spec のディスク書換が SSE change を発火する。
 * temp の後始末（削除）は global-teardown が TEMP_REPO_POINTER 経由で行う。
 */
import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../server/src/index.js";
import { FIXTURE_SOURCE_REPO, SDD_CORE_PORT, TEMP_REPO_POINTER } from "./paths";

/** コミット済みフィクスチャを temp へ複製し、複製先（repo ディレクトリ）の絶対パスを返す。 */
async function prepareWritableFixture(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "sdd-review-ui-e2e-"));
  const tempRepo = join(tempRoot, "repo");
  await cp(FIXTURE_SOURCE_REPO, tempRepo, { recursive: true });
  // review.spec / global-teardown が同じコピー先を参照できるよう絶対パスを共有する。
  await writeFile(TEMP_REPO_POINTER, tempRepo, "utf8");
  return tempRepo;
}

async function main(): Promise<void> {
  const repoPath = await prepareWritableFixture();
  const result = await runCli([repoPath, "--port", String(SDD_CORE_PORT)]);
  if (result.kind === "error") {
    process.exit(result.exitCode);
  }
  // 終了シグナルでサーバー（watcher + HTTP）を解放する。webServer は SIGTERM で停止する。
  const shutdown = (): void => {
    void result.close().finally(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

void main();
