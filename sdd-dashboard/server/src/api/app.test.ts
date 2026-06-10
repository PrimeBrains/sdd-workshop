/**
 * アプリ統合（api/app.ts + index.ts 起動配線）の統合テスト — tasks.md 8.3。
 * 完了条件:
 * - 非 localhost オリジンが拒否される（CORS ヘッダーを付与しない。1.5）
 * - ハンドラ内で故意に throw しても 500 の構造化 JSON が返り、
 *   サーバーが応答し続ける（プロセス継続。13.1, 13.4）
 * - エントリポイント（startServer）から RepoContext・watcher・SSE・全ルートが配線される
 *   （readValidations seam・書込ルート・SSE 実チェーンを実 HTTP で検証）
 *
 * NOTE: ポートは必ずエフェメラル（port: 0）を使う。7411 は稼働中の
 * ウォーキングスケルトンが占有しているため絶対にバインドしない。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import { startServer, type ServerHandle } from "../index.js";
import { createEventBus } from "../watcher/event-bus.js";
import { createApp } from "./app.js";

/** 実 FS 監視 + 実 HTTP を含むテストがあるため余裕を持たせる */
const TEST_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// テストリソース管理
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
const handles: ServerHandle[] = [];
const aborts: AbortController[] = [];

afterEach(async () => {
  // SSE クライアント → サーバー（watcher 込み）→ 一時ディレクトリの順で解放
  while (aborts.length > 0) {
    aborts.pop()?.abort();
  }
  while (handles.length > 0) {
    await handles.pop()?.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// フィクスチャリポジトリ
// ---------------------------------------------------------------------------

const ALPHA_SPEC_JSON = JSON.stringify({
  feature_name: "alpha",
  phase: "requirements-generated",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: false },
    design: { generated: false, approved: false },
    tasks: { generated: false, approved: false },
  },
  ready_for_implementation: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
});

const ALPHA_REQUIREMENTS = [
  "# Requirements",
  "",
  "### Requirement 1: サンプル要件",
  "",
  "#### Acceptance Criteria",
  "",
  "1. The system shall integrate.",
  "",
].join("\n");

const ALPHA_VALIDATION_GAP = [
  "---",
  "type: gap",
  "feature: alpha",
  'date: "2026-06-01"',
  "---",
  "",
  "# Gap 分析",
  "",
  "本文。",
  "",
].join("\n");

/** 一時リポジトリ（.kiro/specs/alpha + .claude/skills/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-app-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  const specDir = join(kiroDir, "specs", "alpha");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "spec.json"), ALPHA_SPEC_JSON);
  writeFileSync(join(specDir, "requirements.md"), ALPHA_REQUIREMENTS);
  writeFileSync(join(specDir, "validation-gap.md"), ALPHA_VALIDATION_GAP);
  const context: RepoContext = { repoRoot, kiroDir, port: 0 };
  mkdirSync(resolveSkillsDir(context), { recursive: true });
  return context;
}

/** watcher なしの app 単体（CORS・エラーミドルウェアの検証用）。ログ・監査はテストでは無音化 */
function makeTestApp(context: RepoContext): Hono {
  return createApp({
    context,
    bus: createEventBus(),
    auditSink: () => undefined,
    logError: () => undefined,
  });
}

// ---------------------------------------------------------------------------
// CORS — localhost オリジン限定（1.5）
// ---------------------------------------------------------------------------

describe("CORS（localhost オリジン限定、1.5）", () => {
  it("http://localhost / http://127.0.0.1 オリジンには Access-Control-Allow-Origin を返す", async () => {
    const app = makeTestApp(makeRepo());
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:8080", "http://localhost"]) {
      const res = await app.request("/api/repo", { headers: { origin } });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });

  it("非 localhost オリジンには CORS ヘッダーを付与しない（ブラウザに拒否させる）", async () => {
    const app = makeTestApp(makeRepo());
    for (const origin of [
      "http://evil.example.com",
      "http://localhost.evil.example.com",
      "http://192.168.0.10:5173",
      "https://localhost:5173", // design.md は http:// のみを許可する
    ]) {
      const res = await app.request("/api/repo", { headers: { origin } });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("preflight（OPTIONS）も localhost のみ許可し、非 localhost には許可ヘッダーを返さない", async () => {
    const app = makeTestApp(makeRepo());
    const preflight = (origin: string) =>
      app.request("/api/specs/alpha/approvals", {
        method: "OPTIONS",
        headers: { origin, "access-control-request-method": "PUT" },
      });

    const allowed = await preflight("http://localhost:5173");
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(allowed.headers.get("access-control-allow-methods")).toBeTruthy();

    const denied = await preflight("http://evil.example.com");
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// エラーミドルウェア — AppError 変換・未知例外 500・プロセス継続（13.1, 13.4）
// ---------------------------------------------------------------------------

describe("エラーミドルウェア（13.1, 13.4）", () => {
  it("AppError を対応する HTTP ステータス + ApiError JSON へ変換する（13.1）", async () => {
    const app = makeTestApp(makeRepo());
    const res = await app.request("/api/specs/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
  });

  it("zod 検証失敗は 422 + error.fieldErrors を返す（AppError.details.fieldErrors の写像）", async () => {
    const app = makeTestApp(makeRepo());
    const res = await app.request("/api/specs/alpha/approvals", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: "unknown-phase", approved: "yes" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; fieldErrors?: Record<string, string[]> };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fieldErrors).toBeDefined();
    expect(Object.keys(body.error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["phase", "approved"]),
    );
  });

  it("ハンドラ内の未知例外は 500 INTERNAL_ERROR の構造化 JSON になり、サーバーは応答し続ける（13.4）", async () => {
    const app = makeTestApp(makeRepo());
    app.get("/api/boom", () => {
      throw new Error("故意の未知例外");
    });

    const boom = await app.request("/api/boom");
    expect(boom.status).toBe(500);
    const body = (await boom.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(typeof body.error.message).toBe("string");

    // プロセス継続: 直後のリクエストが正常応答する
    const after = await app.request("/api/specs");
    expect(after.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 起動配線スモーク — startServer が RepoContext・watcher・SSE・全ルートを配線する
// ---------------------------------------------------------------------------

describe("startServer（起動配線スモーク）", () => {
  it(
    "実 HTTP で 読取・validations seam・書込・SSE（watcher 実チェーン）がすべて動く",
    async () => {
      const context = makeRepo();
      const handle = await startServer(context);
      handles.push(handle);
      const base = `http://127.0.0.1:${handle.port}`;

      // 読取ルート（specs / resources）が配線されている
      const specs = (await (await fetch(`${base}/api/specs`)).json()) as Array<{
        feature: string;
      }>;
      expect(specs.map((entry) => entry.feature)).toEqual(["alpha"]);
      const repo = (await (await fetch(`${base}/api/repo`)).json()) as { repoRoot: string };
      expect(repo.repoRoot).toBe(context.repoRoot);

      // readValidations seam が本配線されている（validation-gap.md が detail に現れる）
      const detail = (await (await fetch(`${base}/api/specs/alpha`)).json()) as {
        validations: Array<{ type: string; feature: string }>;
      };
      expect(detail.validations).toHaveLength(1);
      expect(detail.validations[0]).toMatchObject({ type: "gap", feature: "alpha" });

      // 書込ルートが配線されている
      const approve = await fetch(`${base}/api/specs/alpha/approvals`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phase: "requirements", approved: true }),
      });
      expect(approve.status).toBe(200);
      const summary = (await approve.json()) as {
        approvals: { requirements: { approved: boolean } };
      };
      expect(summary.approvals.requirements.approved).toBe(true);

      // SSE + watcher 実チェーン: 接続 → FS 変更 → change イベント受信
      // （直前の承認 PUT による spec.json の change イベントも流れ得るため、
      //   design.md のイベントが現れるまで読み進める）
      const controller = new AbortController();
      aborts.push(controller);
      const sse = await fetch(`${base}/api/events`, {
        signal: controller.signal,
        headers: { accept: "text/event-stream" },
      });
      expect(sse.status).toBe(200);
      expect(sse.headers.get("content-type")).toContain("text/event-stream");
      const body = sse.body;
      if (body === null) {
        throw new Error("SSE response has no body");
      }
      const received = readUntilSse(body, ".kiro/specs/alpha/design.md", 5_000);
      // 接続確立後に FS を変更する（watcher → bus → SSE の配線を貫通させる）
      await sleep(100);
      writeFileSync(join(context.kiroDir, "specs", "alpha", "design.md"), "# Design\n");
      const frame = await received;
      expect(frame).toContain("event: change");
      expect(frame).toContain(".kiro/specs/alpha/design.md");
      controller.abort();

      // 故意の不正リクエスト後もサーバープロセスが応答し続ける（13.4 の実 HTTP 確認）
      const broken = await fetch(`${base}/api/specs/alpha/approvals`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "{ broken json",
      });
      expect(broken.status).toBe(422);
      const again = await fetch(`${base}/api/specs`);
      expect(again.status).toBe(200);
    },
    TEST_TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SSE ボディを marker 文字列が現れるまで読み、そこまでの生テキストを返す */
async function readUntilSse(
  body: ReadableStream<Uint8Array>,
  marker: string,
  timeoutMs: number,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const timer = setTimeout(() => void reader.cancel(), timeoutMs);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error(`${marker} 受信前にストリームが終了: ${JSON.stringify(buffer)}`);
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes(marker)) {
        return buffer;
      }
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
