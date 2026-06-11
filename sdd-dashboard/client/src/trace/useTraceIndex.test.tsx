/**
 * useTraceIndex の単体テスト（tasks.md 5.1 / design.md Testing Strategy Unit #1 末項）。
 *
 * useTraceGraph（msw でモックした GET /api/specs/:feature/trace）と buildTraceIndex の合成を検証する:
 *  - グラフ取得後、index が buildTraceIndex(graph) と同等の結果を返す
 *  - loading 中は index === null（グレースフルに扱える）
 *  - error 時も index === null で query.error が伝播する
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceGraph } from "@contracts/trace";
import { buildTraceIndex } from "./traceIndex";
import { useTraceIndex } from "./useTraceIndex";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const graphFixture: TraceGraph = {
  feature: "sdd-review-ui",
  nodes: {
    requirements: [{ type: "requirement", id: "1.2" }],
    designElements: [{ type: "design", name: "TraceIndex" }],
    tasks: [{ type: "task", id: "5.1" }],
  },
  edges: [
    {
      from: { type: "requirement", id: "1.2" },
      to: { type: "task", id: "5.1" },
      source: "task-annotation",
      legacyExpanded: false,
    },
  ],
  diagnostics: [{ kind: "design-uncovered", requirementId: "1.2" }],
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper };
}

describe("useTraceIndex", () => {
  it("グラフ取得後に buildTraceIndex(graph) と同等の index を返す", async () => {
    server.use(
      http.get("/api/specs/sdd-review-ui/trace", () => HttpResponse.json(graphFixture)),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTraceIndex("sdd-review-ui"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    const index = result.current.index;
    expect(index).not.toBeNull();

    const expected = buildTraceIndex(graphFixture);
    expect(index?.coverOf("1.2")).toEqual(expected.coverOf("1.2"));
    expect([...(index?.uncovered.design ?? [])]).toEqual(["1.2"]);
    // allDiagnostics は取得した data の diagnostics と同一参照
    expect(index?.allDiagnostics).toBe(result.current.query.data?.diagnostics);
  });

  it("loading 中は index === null", () => {
    server.use(
      http.get(
        "/api/specs/sdd-review-ui/trace",
        () => new Promise(() => {}), // 解決しない → loading のまま
      ),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTraceIndex("sdd-review-ui"), { wrapper: Wrapper });

    expect(result.current.query.isLoading).toBe(true);
    expect(result.current.index).toBeNull();
  });

  it("error 時も index === null で query.error が伝播する", async () => {
    server.use(
      http.get("/api/specs/sdd-review-ui/trace", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "失敗" } },
          { status: 500 },
        ),
      ),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTraceIndex("sdd-review-ui"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.index).toBeNull();
    expect(result.current.query.error?.code).toBe("INTERNAL_ERROR");
  });
});
