/**
 * Vitest グローバルセットアップ。
 *
 * jsdom には `EventSource` が存在しないため、AppShell が常駐させる SseInvalidationBridge
 * （useChangeEvents / tasks.md 9.2）を含むビューを `render` するだけでテストがクラッシュする。
 * ここでは「何もしない最小スタブ」を既定として globalThis に注入し、SSE を駆動しないテスト
 * （router / SpecActionSlot など）が無害に動くようにする。
 *
 * SSE 接続状態シナリオを検証するテスト（useChangeEvents.test / AppShell.test）は、各自で
 * 制御可能なフェイク EventSource を `beforeEach` で差し替えるため、このスタブを上書きする。
 */
class NoopEventSource {
  url: string;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

if ((globalThis as { EventSource?: unknown }).EventSource === undefined) {
  (globalThis as { EventSource?: unknown }).EventSource =
    NoopEventSource as unknown as typeof EventSource;
}
