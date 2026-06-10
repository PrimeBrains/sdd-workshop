/**
 * SseEndpoint — `GET /api/events` の SSE 配信ルート
 * （design.md API 層 SseEndpoint。Requirements 8.2, 8.4, 8.5, 8.6）。
 *
 * - 接続時に EventBus を subscribe し、ChangeEvent を `event: change` + JSON data で配信する（8.2）
 * - 15 秒間隔でコメント行 `: ping` の keepalive を送信する（8.4）。間隔はテスト用に注入可能
 * - 切断時は onAbort で unsubscribe + タイマー解除する（8.5）。
 *   Hono の abort 検知が遅れるケースに備え、書込失敗時にも防御的に後始末する
 * - 同一イベントを全接続へファンアウトするのは EventBus の subscribe（8.6）
 *
 * アプリ全体への組み込み（`app.route("/api/events", ...)`）は api/app.ts（task 8.3）の責務。
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ChangeEvent } from "../types/events.js";
import type { EventBus } from "../watcher/event-bus.js";

/** keepalive ping のデフォルト間隔（design.md: 15 秒毎にコメント行 `: ping`） */
export const KEEPALIVE_INTERVAL_MS = 15_000;

export interface EventsRouteOptions {
  /** keepalive ping の送信間隔（ms）。省略時 KEEPALIVE_INTERVAL_MS */
  readonly keepaliveIntervalMs?: number;
}

/**
 * SSE 配信ルート（`GET /`）を持つ Hono サブアプリを生成する。
 * 呼び出し側が `/api/events` にマウントする。
 * Postcondition: 接続が閉じた後、その接続の subscriber とタイマーは残らない。
 */
export function createEventsRoute(bus: EventBus, options: EventsRouteOptions = {}): Hono {
  const keepaliveIntervalMs = options.keepaliveIntervalMs ?? KEEPALIVE_INTERVAL_MS;
  const app = new Hono();

  app.get("/", (c) =>
    streamSSE(c, async (stream) => {
      let cleanedUp = false;
      let release!: () => void;
      const closed = new Promise<void>((resolve) => {
        release = resolve;
      });

      /** unsubscribe + タイマー解除（8.5）。多重呼び出しは no-op */
      const cleanup = (): void => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        unsubscribe();
        clearInterval(keepaliveTimer);
        release();
      };

      /** 切断済みクライアントへの書込失敗を abort 検知の補完として扱う（防御的後始末） */
      const guarded = (write: () => Promise<unknown>): void => {
        if (cleanedUp) {
          return;
        }
        write().catch(() => cleanup());
      };

      const unsubscribe = bus.subscribe((event: ChangeEvent) => {
        guarded(() => stream.writeSSE({ event: "change", data: JSON.stringify(event) }));
      });

      const keepaliveTimer = setInterval(() => {
        guarded(() => stream.write(": ping\n\n"));
      }, keepaliveIntervalMs);

      stream.onAbort(cleanup);
      // Hono の abort 検知が効かない経路への防御（request signal を直接監視）
      c.req.raw.signal.addEventListener("abort", cleanup, { once: true });

      // コールバックが返るとストリームが閉じられるため、切断まで待機する
      await closed;
    }),
  );

  return app;
}
