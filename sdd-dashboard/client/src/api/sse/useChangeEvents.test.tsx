/**
 * SseInvalidationBridge（api/sse/useChangeEvents.ts, tasks.md 9.1）の結合テスト。
 *
 * design.md「SseInvalidationBridge / Event Contract」「SSE 変更反映フロー」、
 * Requirements 7.1（表示中ビューの自動最新化）/ 7.4（無関係ビューの非破壊）に対応。
 *
 * - jsdom には EventSource が無いため、本テストはグローバル `EventSource` を
 *   制御可能なフェイク実装に差し替える（emit で `change` を発火できる）
 * - 検証はすべて厳密値（Testing Strategy Integration #4 / 完了条件）
 * - RTL auto-cleanup 無効のため afterEach(cleanup)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeEvent } from "@contracts/events";
import { useSpecDetail } from "@/api/useSpecDetail";
import {
  DEFAULT_INVALIDATION_MAP,
  type InvalidationMap,
  useChangeEvents,
} from "@/api/sse/useChangeEvents";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** フェイク EventSource: 生成インスタンスを記録し、テストから change を emit できる */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset() {
    FakeEventSource.instances = [];
  }

  url: string;
  readyState = 0;
  closeCalls = 0;
  // EventSource 標準のプロパティハンドラ（onerror→reconnecting / onopen→connected を 9.2 で検証）
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  private changeListeners = new Set<(event: MessageEvent) => void>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === "change") this.changeListeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === "change") this.changeListeners.delete(listener);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = 2;
  }

  /** SSE `event: change` を 1 件発火する */
  emitChange(payload: ChangeEvent): void {
    const event = new MessageEvent("change", { data: JSON.stringify(payload) });
    for (const listener of this.changeListeners) listener(event);
  }

  /** 接続断（ブラウザの EventSource は内部で自動再接続する） */
  emitError(): void {
    this.readyState = 0;
    this.onerror?.(new Event("error"));
  }

  /** 接続確立（初回 open または再接続成功） */
  emitOpen(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
}

function changeEvent(over: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    type: "change",
    path: ".kiro/specs/sdd-review-ui/requirements.md",
    category: "spec",
    feature: "sdd-review-ui",
    at: "2026-06-11T00:00:00Z",
    ...over,
  };
}

let restoreEventSource: (() => void) | undefined;

beforeEach(() => {
  FakeEventSource.reset();
  const original = (globalThis as { EventSource?: unknown }).EventSource;
  (globalThis as { EventSource?: unknown }).EventSource =
    FakeEventSource as unknown as typeof EventSource;
  restoreEventSource = () => {
    (globalThis as { EventSource?: unknown }).EventSource = original;
  };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  restoreEventSource?.();
  vi.restoreAllMocks();
  cleanup();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

function onlyInstance(): FakeEventSource {
  expect(FakeEventSource.instances).toHaveLength(1);
  const instance = FakeEventSource.instances[0];
  if (instance === undefined) throw new Error("FakeEventSource instance not created");
  return instance;
}

describe("useChangeEvents", () => {
  it("/api/events に EventSource 接続し、初期 status は connected", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChangeEvents(), { wrapper: Wrapper });

    const es = onlyInstance();
    expect(es.url).toBe("/api/events");
    expect(result.current.status).toBe("connected");
  });

  it("偽 pass 防止: イベントが無ければ invalidateQueries は 1 度も呼ばれない", () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    onlyInstance(); // 接続はする

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("完了条件: 表示中スペックの spec change で specs/spec/trace を無効化し再取得→新データ描画", async () => {
    const { queryClient } = createWrapper();

    // 再取得で更新後のフェーズを返す（初回 requirements → 再取得 implementation）
    let phase = "requirements";
    const detail = () => ({
      summary: {
        feature: "sdd-review-ui",
        app: "sdd-dashboard",
        phase,
        language: "ja",
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: false },
          tasks: { generated: false, approved: false },
        },
        readyForImplementation: false,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-11T00:00:00Z",
        artifacts: {
          brief: false,
          requirements: true,
          design: true,
          tasks: false,
          research: false,
          validationGap: false,
          validationDesign: false,
          validationImpl: false,
        },
        diagnostics: [],
      },
      brief: null,
      requirements: null,
      design: null,
      tasks: null,
      research: null,
      validations: [],
    });
    server.use(http.get("/api/specs/sdd-review-ui", () => HttpResponse.json(detail())));

    // 表示中ビュー（active observer）として useSpecDetail を購読し、bridge も同時に張る
    function Harness() {
      const detailQuery = useSpecDetail("sdd-review-ui");
      useChangeEvents();
      return <div data-testid="phase">{detailQuery.data?.summary.phase ?? "loading"}</div>;
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("phase").textContent).toBe("requirements"));

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    phase = "implementation"; // 次回再取得で更新される

    const es = onlyInstance();
    await act(async () => {
      es.emitChange(changeEvent({ feature: "sdd-review-ui" }));
      await Promise.resolve();
    });

    // 1 つの spec イベント → 一意 3 キー（specs / spec / trace）を 1 マイクロタスクで invalidate
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["spec", "sdd-review-ui"],
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trace", "sdd-review-ui"],
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["specs"], refetchType: "active" });

    await waitFor(() => expect(screen.getByTestId("phase").textContent).toBe("implementation"));
  });

  it("7.4: category=steering の change では一切無効化しない", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(changeEvent({ category: "steering", feature: null }));
      await Promise.resolve();
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("同一マイクロタスク内の連続 spec イベントはキー集合に集約して invalidate を 1 回にまとめる", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(changeEvent({ feature: "sdd-review-ui" }));
      es.emitChange(changeEvent({ feature: "other-feature" }));
      await Promise.resolve();
    });

    // 2 features ×（specs + spec + trace）の和集合 = 5 キー。invalidate 呼び出しは
    // バーストごとに 1 microtask フラッシュ → 1 回あたり一意キー数だけ呼ぶが、
    // 重複 ['specs'] は集約されるため specs は 1 回だけ
    const specsCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => JSON.stringify((arg as { queryKey: unknown }).queryKey) === JSON.stringify(["specs"]),
    );
    expect(specsCalls).toHaveLength(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(5);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["spec", "sdd-review-ui"],
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["spec", "other-feature"],
      refetchType: "active",
    });
  });

  it("InvalidationMap は export され拡張可能: 渡したカテゴリ写像が適用される（workflow-ui 拡張点）", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const customMap: InvalidationMap = {
      steering: () => [["steering"]],
    };
    renderHook(() => useChangeEvents(customMap), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(changeEvent({ category: "steering", feature: null }));
      await Promise.resolve();
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["steering"], refetchType: "active" });
  });

  it("DEFAULT_INVALIDATION_MAP は spec のみを 3 キーへ写像し、他カテゴリは未定義", () => {
    expect(Object.keys(DEFAULT_INVALIDATION_MAP)).toEqual(["spec"]);
    const keys = DEFAULT_INVALIDATION_MAP.spec?.(changeEvent({ feature: "f" }));
    expect(keys).toEqual([["specs"], ["spec", "f"], ["trace", "f"]]);
  });

  it("アンマウントで EventSource.close() が呼ばれる", () => {
    const { Wrapper } = createWrapper();
    const { unmount } = renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    expect(es.closeCalls).toBe(0);
    unmount();
    expect(es.closeCalls).toBe(1);
  });

  // --- 9.2: 接続状態・再接続・取りこぼし回復（Requirements 7.3） ---

  it("9.2: onerror で status が reconnecting になり、onopen 復帰で connected に戻る", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    expect(result.current.status).toBe("connected");

    act(() => {
      es.emitError();
    });
    expect(result.current.status).toBe("reconnecting");

    act(() => {
      es.emitOpen();
    });
    expect(result.current.status).toBe("connected");
  });

  it("9.2: onopen 復帰時に全キーを invalidate して切断中の取りこぼしを回復する（7.3）", async () => {
    const { queryClient, Wrapper } = createWrapper();
    renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    // 切断
    act(() => {
      es.emitError();
    });

    // 復帰: 全キー invalidate（表示中の active クエリは再取得される）
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await act(async () => {
      es.emitOpen();
      await Promise.resolve();
    });

    // キーを限定しない広域 invalidate（= 全キー）が refetchType: 'active' で 1 回発火する
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ refetchType: "active" });
  });

  it("9.2: 初回 onopen（接続確立のみ。直前に切断なし）でも全キー invalidate して収束させる", async () => {
    const { queryClient, Wrapper } = createWrapper();
    renderHook(() => useChangeEvents(), { wrapper: Wrapper });
    const es = onlyInstance();

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await act(async () => {
      es.emitOpen();
      await Promise.resolve();
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ refetchType: "active" });
  });
});
