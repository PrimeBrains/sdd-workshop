import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PORT, createRepoContext } from "./config.js";
import { ErrorCode } from "./errors/codes.js";

const tempDirs: string[] = [];

function makeRepo(options: { withKiro: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), "sdd-core-config-"));
  tempDirs.push(dir);
  if (options.withKiro) {
    mkdirSync(join(dir, ".kiro"));
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("DEFAULT_PORT", () => {
  it("クライアント proxy(7411) と一致する文書化済みデフォルトポートを公開する", () => {
    expect(DEFAULT_PORT).toBe(7411);
  });
});

describe("createRepoContext", () => {
  it("相対パスを cwd 基準の絶対パスへ解決し .kiro パスを保持する", () => {
    const repo = makeRepo({ withKiro: true });
    const result = createRepoContext(".", undefined, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.repoRoot).toBe(repo);
    expect(isAbsolute(result.context.repoRoot)).toBe(true);
    expect(result.context.kiroDir).toBe(join(repo, ".kiro"));
  });

  it("ポート未指定時は DEFAULT_PORT を保持する", () => {
    const repo = makeRepo({ withKiro: true });
    const result = createRepoContext(repo, undefined, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.port).toBe(DEFAULT_PORT);
  });

  it("明示ポート指定時はその値を保持する", () => {
    const repo = makeRepo({ withKiro: true });
    const result = createRepoContext(repo, 7500, repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.port).toBe(7500);
  });

  it("存在しないパスでは解決後の絶対パスを含むエラーを返す", () => {
    const repo = makeRepo({ withKiro: true });
    const missing = join(repo, "no-such-repo");
    const result = createRepoContext(missing, undefined, repo);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.REPO_INVALID);
    expect(result.message).toContain(missing);
  });

  it("パスがディレクトリでない場合はエラーを返す", () => {
    const repo = makeRepo({ withKiro: true });
    const filePath = join(repo, "plain-file.txt");
    writeFileSync(filePath, "not a directory");
    const result = createRepoContext(filePath, undefined, repo);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(filePath);
  });

  it(".kiro/ を含まないディレクトリではパスと .kiro 不在を明示するエラーを返す", () => {
    const repo = makeRepo({ withKiro: false });
    const result = createRepoContext(repo, undefined, repo);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.REPO_INVALID);
    expect(result.message).toContain(repo);
    expect(result.message).toContain(".kiro");
  });
});
