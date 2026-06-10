/**
 * 監視 → SSE データフロー結合テスト — tasks.md 9.2。
 * （design.md Testing Strategy「Integration Tests 4・5」。Requirements 8.1, 8.2, 8.5, 8.6）
 *
 * 実ファイル変更（追加・変更・削除）→ chokidar 検知 → SSE 受信までを 1 つの
 * 自動テストで担保する。組み立ては本番の startServer（src/index.ts）と同一配線
 * （createRepoContext → createEventBus → createApp → startKiroWatcher → serve）を
 * 使うが、切断後のリーク検証（bus.subscriberCount() === 0。8.5）のために
 * EventBus をテスト側で保持する。
 *
 * 偽 pass 防止（steering testing-conventions.md / design.md Integration Tests 5）:
 * 変更を加えない静止区間を先に置き、keepalive ping は届く（接続は生きている）のに
 * change イベントは 0 件であることを確認してから本シナリオ（add → change → unlink）へ進む。
 *
 * 各ステージは writeFile/unlink の時刻からイベント受信までの経過を実測し
 * 2 秒以内（8.2）を厳密にアサートする。ステージ間には awaitWriteFinish(100ms) +
 * デバウンス(100ms) を確実に跨ぐ静止待ちを挟み、add と change が 1 イベントに
 * 集約されない（= ステージごとにちょうど 1 件届く）ことも厳密件数で検証する。
 */
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/api/app.js";
import { createRepoContext, resolveSkillsDir, type RepoContext } from "../src/config.js";
import type { ChangeEvent } from "../src/types/events.js";
import { createEventBus, type EventBus } from "../src/watcher/event-bus.js";
import { startKiroWatcher, type KiroWatcher } from "../src/watcher/kiro-watcher.js";

/** 実 FS 監視 + 実 HTTP の 4 ステージ構成のため余裕を持たせる（実測は ~3 秒） */
const TEST_TIMEOUT = 15_000;

/** 各ステージの受信期限（8.2 の厳密アサートは 2 秒。waitFor 自体は少し長く待って elapsed 側で落とす） */
const STAGE_DEADLINE_MS = 2_000;

/**
 * 静止待ち: awaitWriteFinish stabilityThreshold(100ms) + デバウンス(100ms) を
 * 確実に跨ぎ、前ステージの pending が flush 済みであることを保証する
 */
const SETTLE_MS = 400;

/** 偽 pass 防止の無変更観察窓（SETTLE_MS より長く、ping が複数回届く長さ） */
const QUIET_WINDOW_MS = 600;

/** テスト用 keepalive 間隔: 静止窓の間も ping が届き「接続は生きている」ことを示す */
const KEEPALIVE_MS = 100;

const FEATURE = "flow-feature";
/** ChangeEvent.path はリポジトリルートからの相対 posix パス */
const REL_PATH = `.kiro/specs/${FEATURE}/requirements.md`;

// ---------------------------------------------------------------------------
// テストリソース管理（afterEach で必ず解放し、スイートがハンドルリークしないようにする）
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
const watchers: KiroWatcher[] = [];
const servers: Array<() => Promise<void>> = [];
const clients: SseClient[] = [];

afterEach(async () => {
  // クライアント → サーバー → 監視 → 一時ディレクトリの順で解放
  while (clients.length > 0) {
    const client = clients.pop();
    client?.close();
    await client?.done;
  }
  while (servers.length > 0) {
    await servers.pop()?.();
  }
  while (watchers.length > 0) {
    await watchers.pop()?.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/**
 * 一時リポジトリ（.kiro/specs + スキルディレクトリ付き）を作り、
 * 本番のコンテキスト解決（createRepoContext）を通した RepoContext を返す
 */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-flow-"));
  tempDirs.push(repoRoot);
  mkdirSync(join(repoRoot, ".kiro", "specs"), { recursive: true });
  mkdirSync(join(repoRoot, ".claude", "skills"), { recursive: true });
  const result = createRepoContext(repoRoot, 0);
  if (!result.ok) {
    throw new Error(`一時リポジトリが不正です: ${result.message}`);
  }
  // resolveSkillsDir が watcher の監視ルートと一致することの前提確認
  expect(resolveSkillsDir(result.context)).toBe(join(repoRoot, ".claude", "skills"));
  return result.context;
}

/**
 * 本番組み立て（createApp の全ルート）をエフェメラルポートで起動する。
 * startServer（src/index.ts）と同一配線だが、bus を注入してリーク検証可能にする。
 */
async function startProductionApp(context: RepoContext, bus: EventBus): Promise<{ url: string }> {
  const app = createApp({
    context,
    bus,
    keepaliveIntervalMs: KEEPALIVE_MS,
    auditSink: () => undefined,
    logError: () => undefined,
  });
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info) => {
      servers.push(
        () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      );
      resolve({ url: `http://127.0.0.1:${info.port}/api/events` });
    });
  });
}

/** 受信した SSE フレーム（event/data の組）とコメント行 */
interface SseFrame {
  event: string | null;
  data: string;
}

interface SseClient {
  frames: SseFrame[];
  comments: string[];
  close: () => void;
  done: Promise<void>;
}

/** 生フレームを event/data とコメント行（ping 等）に分解して蓄積する */
function parseFrame(raw: string, frames: SseFrame[], comments: string[]): void {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) {
      comments.push(line);
    } else if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (event !== null || dataLines.length > 0) {
    frames.push({ event, data: dataLines.join("\n") });
  }
}

/** fetch + ReadableStream reader で SSE 接続し、受信フレームを蓄積するクライアント */
async function connectSseClient(url: string): Promise<SseClient> {
  const controller = new AbortController();
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { accept: "text/event-stream" },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const body = response.body;
  if (body === null) {
    throw new Error("SSE response has no body");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const frames: SseFrame[] = [];
  const comments: string[] = [];
  let buffer = "";
  const done = (async () => {
    try {
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          parseFrame(buffer.slice(0, separator), frames, comments);
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // クライアント側 abort による中断は正常系
    }
  })();
  const client: SseClient = { frames, comments, close: () => controller.abort(), done };
  clients.push(client);
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 条件成立までポーリングする（上限付き）。成立しなければそのまま返り、expect 側で落とす */
async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(20);
  }
}

/** change イベントフレームのみ抽出する（keepalive ping はコメント行のため frames に混入しない） */
function changeFrames(client: SseClient): SseFrame[] {
  return client.frames.filter((frame) => frame.event === "change");
}

/**
 * 1 ステージ（add / change / unlink）を実行して検証する:
 * - trigger 実行時刻からの経過を実測し、全クライアント受信まで 2 秒未満（8.2）
 * - 累計 change フレーム数が expectedTotal ちょうど（前ステージとの集約・重複発行なし）
 * - 全クライアントが同一ペイロードを受信（8.6）
 * - ペイロードの type / path / category / feature を厳密値一致、`at` は有効な ISO 時刻
 */
async function runStage(
  allClients: readonly SseClient[],
  expectedTotal: number,
  trigger: () => void,
  expected: Omit<ChangeEvent, "at">,
): Promise<void> {
  const startedAt = Date.now();
  trigger();
  await waitFor(
    () => allClients.every((client) => changeFrames(client).length >= expectedTotal),
    STAGE_DEADLINE_MS + 1_000,
  );
  const elapsed = Date.now() - startedAt;
  // 変更から 2 秒以内に全クライアントが受信完了する（8.2）
  expect(allClients.every((client) => changeFrames(client).length >= expectedTotal)).toBe(true);
  expect(elapsed).toBeLessThan(STAGE_DEADLINE_MS);
  // ステージごとにちょうど 1 イベント（デバウンスによる add+change 集約や重複発行がない）
  for (const client of allClients) {
    expect(changeFrames(client).length).toBe(expectedTotal);
  }
  // 全クライアントが同一ペイロードを受信する（8.6）
  const payloads = allClients.map((client) => changeFrames(client)[expectedTotal - 1]?.data);
  expect(payloads[0]).toBeDefined();
  for (const payload of payloads) {
    expect(payload).toBe(payloads[0]);
  }
  // type / path / category / feature の厳密値一致（8.2: 変更種別・パス・カテゴリの特定）
  const { at, ...rest } = JSON.parse(payloads[0] ?? "") as ChangeEvent;
  expect(rest).toEqual(expected);
  expect(Number.isNaN(Date.parse(at))).toBe(false);
}

describe("監視 → SSE データフロー結合（tasks 9.2）", () => {
  it(
    "無変更では change イベントが届かず、実ファイルの追加・変更・削除がそれぞれ 2 秒以内に厳密な ChangeEvent として全クライアントへ届き、切断後にリークしない（8.1, 8.2, 8.5, 8.6）",
    async () => {
      // 本番と同一配線: RepoContext → EventBus → KiroWatcher → createApp → HTTP
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", FEATURE);
      mkdirSync(specDir);
      const bus = createEventBus();
      const watcher = await startKiroWatcher(context, bus);
      watchers.push(watcher);
      const { url } = await startProductionApp(context, bus);

      const clientA = await connectSseClient(url);
      const clientB = await connectSseClient(url);
      const all = [clientA, clientB];
      await waitFor(() => bus.subscriberCount() === 2);
      expect(bus.subscriberCount()).toBe(2);

      // --- (0) 偽 pass 防止: 変更を加えない静止窓では change イベントが 1 件も届かない ---
      // 接続が生きている証拠として keepalive ping の受信を先に確認する（緩い「つながってるだけ」検証の回避）
      await waitFor(() =>
        all.every((client) => client.comments.some((line) => line.includes("ping"))),
      );
      await sleep(QUIET_WINDOW_MS);
      for (const client of all) {
        expect(client.comments.some((line) => line.includes("ping"))).toBe(true);
        expect(changeFrames(client)).toEqual([]);
      }

      // --- (1) 追加: 新規 spec ファイル → add イベント（8.1, 8.2） ---
      const filePath = join(specDir, "requirements.md");
      await runStage(all, 1, () => writeFileSync(filePath, "# Requirements v1\n"), {
        type: "add",
        path: REL_PATH,
        category: "spec",
        feature: FEATURE,
      });
      await sleep(SETTLE_MS);

      // --- (2) 変更: 同一ファイルの上書き → change イベント（8.1, 8.2） ---
      await runStage(all, 2, () => writeFileSync(filePath, "# Requirements v2 (updated)\n"), {
        type: "change",
        path: REL_PATH,
        category: "spec",
        feature: FEATURE,
      });
      await sleep(SETTLE_MS);

      // --- (3) 削除: ファイル削除 → unlink イベント（8.1, 8.2） ---
      await runStage(all, 3, () => unlinkSync(filePath), {
        type: "unlink",
        path: REL_PATH,
        category: "spec",
        feature: FEATURE,
      });

      // --- (4) 切断 → SSE 接続リークがない: subscriber 数が 0 へ戻る（8.5） ---
      for (const client of all) {
        client.close();
        await client.done;
      }
      await waitFor(() => bus.subscriberCount() === 0);
      expect(bus.subscriberCount()).toBe(0);
    },
    TEST_TIMEOUT,
  );
});
