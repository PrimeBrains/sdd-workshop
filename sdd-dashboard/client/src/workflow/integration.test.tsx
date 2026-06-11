/**
 * Workflow ShellIntegration（design.md「WorkflowRoutes + ShellIntegration」, Requirements 8.1 / 8.3）の結合テスト。
 *
 * 偽 EventSource を差し替え、`appChangeEventsMap` を注入した review-ui の SseInvalidationBridge
 * （useChangeEvents）経由で、ワークフロー・カテゴリのイベントが正しいクエリキー無効化に橋渡し
 * されることを検証する。検証はすべて厳密キー（Testing Strategy / 完了条件）。
 *
 * - 偽 pass 防止: イベント無しでは workflow 無効化（['steering'] 等）が一切起きないことを先に確認
 * - steering イベント → ['steering'] 無効化（8.1）
 * - other イベント → 無効化なし（8.3）
 * - spec イベント → ['specs'] 無効化が依然発火（merge-not-replace の回帰）
 * - registerWorkflow は unregister 関数を返し、SpecActionSlot へ 4.1 までは何も描画しないレンダラを登録する
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeEvent } from "@contracts/events";
import { useChangeEvents } from "@/api/sse/useChangeEvents";
import type { SpecActionSlotApi } from "@/app/SpecActionSlot";
import { appChangeEventsMap, registerWorkflow } from "@/workflow/integration";

/** フェイク EventSource: 生成インスタンスを記録し、テストから change を emit できる */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset() {
    FakeEventSource.instances = [];
  }

  url: string;
  readyState = 0;
  closeCalls = 0;
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

  emitChange(payload: ChangeEvent): void {
    const event = new MessageEvent("change", { data: JSON.stringify(payload) });
    for (const listener of this.changeListeners) listener(event);
  }
}

function changeEvent(over: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    type: "change",
    path: ".kiro/steering/product.md",
    category: "steering",
    feature: null,
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

/** spy.mock.calls から指定 queryKey に厳密一致する invalidate 呼び出しのみ抽出する */
function callsForKey(spy: { mock: { calls: unknown[][] } }, key: readonly unknown[]) {
  return spy.mock.calls.filter(([arg]) => {
    const queryKey = (arg as { queryKey?: unknown } | undefined)?.queryKey;
    return JSON.stringify(queryKey) === JSON.stringify(key);
  });
}

describe("appChangeEventsMap を注入した SseInvalidationBridge", () => {
  it("偽 pass 防止: イベント無しでは ['steering'] 無効化は 1 度も起きない", () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(appChangeEventsMap), { wrapper: Wrapper });
    onlyInstance();

    expect(callsForKey(invalidateSpy, ["steering"])).toHaveLength(0);
  });

  it("category=steering イベントで ['steering'] が無効化される（8.1）", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(appChangeEventsMap), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(changeEvent({ category: "steering", feature: null }));
      await Promise.resolve();
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["steering"], refetchType: "active" });
  });

  it("category=other イベントでは一切無効化しない（8.3）", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(appChangeEventsMap), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(changeEvent({ category: "other", feature: null }));
      await Promise.resolve();
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("merge-not-replace 回帰: spec イベントで ['specs'] 無効化が依然発火する", async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useChangeEvents(appChangeEventsMap), { wrapper: Wrapper });
    const es = onlyInstance();

    await act(async () => {
      es.emitChange(
        changeEvent({
          category: "spec",
          feature: "sdd-review-ui",
          path: ".kiro/specs/sdd-review-ui/requirements.md",
        }),
      );
      await Promise.resolve();
    });

    expect(callsForKey(invalidateSpy, ["specs"])).toHaveLength(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["specs"], refetchType: "active" });
  });
});

describe("registerWorkflow", () => {
  it("SpecActionSlot へレンダラを登録し、unregister 関数を返す", () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    const slot: SpecActionSlotApi = { register };

    const returned = registerWorkflow(slot);

    expect(register).toHaveBeenCalledTimes(1);
    expect(returned).toBe(unregister);
  });

  it("4.1 実装までは何も描画しないレンダラを登録する（null を返す）", () => {
    let captured: ((ctx: unknown) => unknown) | undefined;
    const slot: SpecActionSlotApi = {
      register: (render) => {
        captured = render as (ctx: unknown) => unknown;
        return () => {};
      },
    };

    registerWorkflow(slot);

    expect(captured).toBeDefined();
    expect(captured?.({ feature: "f", document: null })).toBeNull();
  });
});
