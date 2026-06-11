/**
 * globalTeardown — globalSetup が作成した temp フィクスチャコピーとポインタファイルを削除する
 * （tasks.md 10.1「Clean up temp repo + servers in teardown」）。temp ディレクトリは
 * mkdtemp 由来の親ごと削除する。失敗しても teardown は致命扱いにしない。
 */
import { readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { TEMP_REPO_POINTER } from "./paths";

export default async function globalTeardown(): Promise<void> {
  let tempRepo: string | null = null;
  try {
    tempRepo = (await readFile(TEMP_REPO_POINTER, "utf8")).trim();
  } catch {
    tempRepo = null;
  }
  if (tempRepo !== null && tempRepo !== "") {
    // mkdtemp で作った親（…/sdd-review-ui-e2e-XXXX）ごと削除する（repo はその子）。
    await rm(dirname(tempRepo), { recursive: true, force: true });
  }
  await rm(TEMP_REPO_POINTER, { force: true });
}
