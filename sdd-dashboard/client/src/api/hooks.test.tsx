/**
 * QueryHooks（useRepoInfo / useSpecs / useSpecDetail / useTraceGraph）のテスト（tasks.md 1.2）。
 * - フックは useQuery の薄ラッパであり、サーバー応答を変換・解釈せずそのまま data に返す
 * - キャッシュは queryKeys.ts の厳密キー（['repo'] / ['specs'] / ['spec', f] / ['trace', f]）に格納される
 * - エラーは NormalizedApiError として error state に現れる（Requirement 1.5 の前提）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import type { TraceGraph } from "@contracts/trace";
import { NormalizedApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useRepoInfo } from "@/api/useRepoInfo";
import { useSpecs } from "@/api/useSpecs";
import { useSpecDetail } from "@/api/useSpecDetail";
import { useTraceGraph } from "@/api/useTraceGraph";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const repoFixture: RepoInfo = { repoRoot: "/home/user/ghq/sdd-workshop", name: "sdd-workshop" };

const specSummaryFixture: SpecSummary = {
  feature: "sdd-review-ui",
  app: "sdd-dashboard",
  phase: "implementation",
  language: "ja",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: true },
  },
  readyForImplementation: true,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-11T00:00:00Z",
  artifacts: {
    brief: false,
    requirements: true,
    design: true,
    tasks: true,
    research: true,
    validationGap: false,
    validationDesign: true,
    validationImpl: false,
  },
  diagnostics: [],
};

const specDetailFixture: SpecDetail = {
  summary: specSummaryFixture,
  brief: null,
  requirements: null,
  design: null,
  tasks: null,
  research: null,
  validations: [],
};

const traceGraphFixture: TraceGraph = {
  feature: "sdd-review-ui",
  nodes: {
    requirements: [{ type: "requirement", id: "1.5" }],
    designElements: [{ type: "design", name: "ApiClient + QueryHooks" }],
    tasks: [{ type: "task", id: "1.2" }],
  },
  edges: [
    {
      from: { type: "design", name: "ApiClient + QueryHooks" },
      to: { type: "requirement", id: "1.5" },
      source: "design-table",
      legacyExpanded: false,
    },
  ],
  diagnostics: [],
};

/** テスト用 QueryClient（retry 無効化でエラー状態を決定的にする） */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

describe("useRepoInfo", () => {
  it("GET /api/repo の応答を変換せず data に返し、['repo'] キーでキャッシュする", async () => {
    server.use(http.get("/api/repo", () => HttpResponse.json(repoFixture)));
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useRepoInfo(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(repoFixture);
    expect(queryClient.getQueryData(queryKeys.repo)).toEqual(repoFixture);
  });
});

describe("useSpecs", () => {
  it("GET /api/specs の応答を変換せず data に返し、['specs'] キーでキャッシュする", async () => {
    server.use(http.get("/api/specs", () => HttpResponse.json([specSummaryFixture])));
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useSpecs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([specSummaryFixture]);
    expect(queryClient.getQueryData(queryKeys.specs)).toEqual([specSummaryFixture]);
  });

  it("500 + ApiError 応答で error が NormalizedApiError（code / message 厳密値）になる", async () => {
    server.use(
      http.get("/api/specs", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
          { status: 500 },
        ),
      ),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSpecs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NormalizedApiError);
    expect(result.current.error?.code).toBe("INTERNAL_ERROR");
    expect(result.current.error?.message).toBe("想定外のエラーが発生しました");
    expect(result.current.error?.status).toBe(500);
  });
});

describe("useSpecDetail", () => {
  it("GET /api/specs/:feature の応答を変換せず data に返し、['spec', feature] キーでキャッシュする", async () => {
    server.use(
      http.get("/api/specs/sdd-review-ui", () => HttpResponse.json(specDetailFixture)),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useSpecDetail("sdd-review-ui"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(specDetailFixture);
    expect(queryClient.getQueryData(queryKeys.spec("sdd-review-ui"))).toEqual(specDetailFixture);
  });
});

describe("useTraceGraph", () => {
  it("GET /api/specs/:feature/trace の応答を変換せず data に返し、['trace', feature] キーでキャッシュする", async () => {
    server.use(
      http.get("/api/specs/sdd-review-ui/trace", () => HttpResponse.json(traceGraphFixture)),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useTraceGraph("sdd-review-ui"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(traceGraphFixture);
    expect(queryClient.getQueryData(queryKeys.trace("sdd-review-ui"))).toEqual(traceGraphFixture);
  });
});
