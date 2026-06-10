/**
 * SSE エンドポイント（GET /api/events）の結合テスト — 実 HTTP サーバー + 実 FS 監視。
 * 完了条件（tasks.md 6.2）:
 * - 複数同時接続クライアントが同一イベントを受信する（8.2, 8.6）
 * - ファイル変更から 2 秒以内に受信完了する（8.2）
 * - 切断後に subscriber 数が 0 へ戻る（8.5）
 * - keepalive ping が一定間隔で送信される（8.4）
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import type { ChangeEvent } from "../types/events.js";
import { createEventBus, type EventBus } from "../watcher/event-bus.js";
import { startKiroWatcher, type KiroWatcher } from "../watcher/kiro-watcher.js";
import { createEventsRoute } from "./events.js";

/** 実 FS 監視 + 実 HTTP を含むためテスト毎に余裕を持たせる */
const TEST_TIMEOUT = 15_000;

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

/** 一時リポジトリ（.kiro/ + .claude/skills/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-events-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(join(kiroDir, "specs"), { recursive: true });
  const context: RepoContext = { repoRoot, kiroDir, port: 0 };
  mkdirSync(resolveSkillsDir(context), { recursive: true });
  return context;
}

/** events ルートをマウントした Hono アプリをエフェメラルポートで起動し、ポートを返す */
async function startEventsServer(
  bus: EventBus,
  options?: { keepaliveIntervalMs?: number },
): Promise<{ url: string }> {
  const app = new Hono().route("/api/events", createEventsRoute(bus, options));
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

/** 生フレームを event/data とコメント行に分解して蓄積する */
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

describe("GET /api/events (SSE)", () => {
  it(
    "複数同時接続クライアントが同一の change イベントをファイル変更から 2 秒以内に受信し、切断後に subscriber 数が 0 へ戻る（8.2, 8.5, 8.6）",
    async () => {
      // 実チェーン: FS 変更 → KiroWatcher → EventBus → SSE → 複数クライアント
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", "demo-feature");
      mkdirSync(specDir);
      const bus = createEventBus();
      const watcher = await startKiroWatcher(context, bus);
      watchers.push(watcher);
      const { url } = await startEventsServer(bus);

      const clientA = await connectSseClient(url);
      const clientB = await connectSseClient(url);
      const clientC = await connectSseClient(url);
      // 全クライアントが subscribe 済みになるのを待つ
      await waitFor(() => bus.subscriberCount() === 3);
      expect(bus.subscriberCount()).toBe(3);

      const startedAt = Date.now();
      writeFileSync(join(specDir, "requirements.md"), "# Requirements\n");

      const all = [clientA, clientB, clientC];
      const hasChange = (client: SseClient): boolean =>
        client.frames.some((frame) => frame.event === "change");
      await waitFor(() => all.every(hasChange), 3_000);
      const receivedAt = Date.now();

      // 2 秒以内に全クライアントが受信完了する（8.2）
      expect(all.every(hasChange)).toBe(true);
      expect(receivedAt - startedAt).toBeLessThan(2_000);

      // 全クライアントが同一ペイロードを受信する（8.6）
      const payloads = all.map(
        (client) => client.frames.find((frame) => frame.event === "change")?.data,
      );
      expect(payloads[0]).toBeDefined();
      expect(payloads[1]).toBe(payloads[0]);
      expect(payloads[2]).toBe(payloads[0]);
      const event = JSON.parse(payloads[0] ?? "") as ChangeEvent;
      expect(event).toMatchObject({
        type: "add",
        path: ".kiro/specs/demo-feature/requirements.md",
        category: "spec",
        feature: "demo-feature",
      });

      // 切断 → onAbort で unsubscribe され subscriber 数が 0 へ戻る（8.5）
      for (const client of all) {
        client.close();
        await client.done;
      }
      await waitFor(() => bus.subscriberCount() === 0);
      expect(bus.subscriberCount()).toBe(0);
    },
    TEST_TIMEOUT,
  );

  it(
    "EventBus へ publish された ChangeEvent が `event: change` + JSON data として配信される（8.2）",
    async () => {
      const bus = createEventBus();
      const { url } = await startEventsServer(bus);
      const client = await connectSseClient(url);
      await waitFor(() => bus.subscriberCount() === 1);

      const change: ChangeEvent = {
        type: "change",
        path: ".kiro/steering/product.md",
        category: "steering",
        feature: null,
        at: "2026-06-10T00:00:00.000Z",
      };
      bus.publish(change);

      await waitFor(() => client.frames.length > 0);
      expect(client.frames[0]?.event).toBe("change");
      expect(JSON.parse(client.frames[0]?.data ?? "")).toEqual(change);
    },
    TEST_TIMEOUT,
  );

  it(
    "keepalive ping が設定間隔で繰り返し送信される（8.4）",
    async () => {
      const bus = createEventBus();
      // 間隔は注入可能（本番デフォルト 15 秒をテストでは 40ms に短縮）
      const { url } = await startEventsServer(bus, { keepaliveIntervalMs: 40 });
      const client = await connectSseClient(url);

      await waitFor(() => client.comments.filter((line) => line.includes("ping")).length >= 3);
      expect(
        client.comments.filter((line) => line.includes("ping")).length,
      ).toBeGreaterThanOrEqual(3);
    },
    TEST_TIMEOUT,
  );

  it(
    "切断後は keepalive タイマーも解除され、以後の publish がクライアントへ届かない（8.5）",
    async () => {
      const bus = createEventBus();
      const { url } = await startEventsServer(bus, { keepaliveIntervalMs: 40 });
      const client = await connectSseClient(url);
      await waitFor(() => bus.subscriberCount() === 1);

      client.close();
      await client.done;
      await waitFor(() => bus.subscriberCount() === 0);
      expect(bus.subscriberCount()).toBe(0);

      const framesBefore = client.frames.length;
      bus.publish({
        type: "unlink",
        path: ".kiro/steering/tech.md",
        category: "steering",
        feature: null,
        at: new Date().toISOString(),
      });
      await sleep(150);
      expect(client.frames.length).toBe(framesBefore);
    },
    TEST_TIMEOUT,
  );
});
