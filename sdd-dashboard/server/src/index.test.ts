import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PACKAGE_NAME, parseCliArgs, runCli } from "./index.js";

const tempDirs: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

function makeRepo(options: { withKiro: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), "sdd-core-entry-"));
  tempDirs.push(dir);
  if (options.withKiro) {
    mkdirSync(join(dir, ".kiro"));
  }
  return dir;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup !== undefined) {
      await cleanup();
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("package scaffolding", () => {
  it("src の実エクスポートを厳密値で検証できる", () => {
    expect(PACKAGE_NAME).toBe("sdd-core-server");
  });
});

describe("parseCliArgs", () => {
  it("位置引数のリポジトリパスを受け取る（ポート未指定は undefined）", () => {
    const parsed = parseCliArgs(["/some/repo"]);
    expect(parsed).toEqual({ ok: true, repoPath: "/some/repo", port: undefined });
  });

  it("--port を数値として解釈する", () => {
    const parsed = parseCliArgs(["/some/repo", "--port", "7500"]);
    expect(parsed).toEqual({ ok: true, repoPath: "/some/repo", port: 7500 });
  });

  it("リポジトリパス未指定はエラーになる", () => {
    const parsed = parseCliArgs([]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("repository path");
  });

  it("--port の値が数値でない場合はエラーになる", () => {
    const parsed = parseCliArgs(["/some/repo", "--port", "abc"]);
    expect(parsed.ok).toBe(false);
  });

  it("--port の値が欠けている場合はエラーになる", () => {
    const parsed = parseCliArgs(["/some/repo", "--port"]);
    expect(parsed.ok).toBe(false);
  });
});

describe("runCli", () => {
  it("不正パスでは exit code 1 と不正パスを含むエラーメッセージを返す", async () => {
    const repo = makeRepo({ withKiro: true });
    const missing = join(repo, "no-such-repo");
    const stderrLines: string[] = [];
    const result = await runCli([missing], {
      stderr: (line) => stderrLines.push(line),
      stdout: () => undefined,
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.exitCode).toBe(1);
    expect(stderrLines.join("\n")).toContain(missing);
  });

  it(".kiro/ 不在のパスでも exit code 1 になる", async () => {
    const repo = makeRepo({ withKiro: false });
    const stderrLines: string[] = [];
    const result = await runCli([repo], {
      stderr: (line) => stderrLines.push(line),
      stdout: () => undefined,
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.exitCode).toBe(1);
    expect(stderrLines.join("\n")).toContain(repo);
  });

  it("正常リポジトリ指定で指定ポートの HTTP サーバーが待ち受ける", async () => {
    const repo = makeRepo({ withKiro: true });
    const stdoutLines: string[] = [];
    // ポート 0 = OS にエフェメラルポートを割り当てさせる（稼働中プロセスとの衝突回避）
    const result = await runCli([repo, "--port", "0"], {
      stderr: () => undefined,
      stdout: (line) => stdoutLines.push(line),
    });
    expect(result.kind).toBe("running");
    if (result.kind !== "running") return;
    cleanups.push(result.close);
    expect(result.port).toBeGreaterThan(0);
    expect(result.context.repoRoot).toBe(repo);
    expect(stdoutLines.join("\n")).toContain(String(result.port));

    // 実ルート（GET /api/repo）で配線済みサーバーが応答する
    const response = await fetch(`http://127.0.0.1:${result.port}/api/repo`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { repoRoot: string; name: string };
    expect(body.repoRoot).toBe(repo);
  });
});
