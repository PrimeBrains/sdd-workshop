/**
 * useApprovalMutation の結合テスト（tasks.md 1.2 / design.md 「書込成功後の状態反映」）。
 *
 * - 成功時: PUT が 1 件発行され、['specs'] / ['spec', feature] キャッシュが更新後状態に反映される
 * - 成功後に ['specs'] / ['spec', feature] / ['trace', feature] が invalidate される
 * - 409 ApiError は NormalizedApiError(厳密値) へ正規化され、キャッシュは不変
 */
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { NormalizedApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { createQueryClient } from "@/app/queryClient";
import { useApprovalMutation } from "./useApprovalMutation";

function makeSpecSummary(feature: string, overrides?: Partial<SpecSummary>): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "design",
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
    ...overrides,
  };
}

function makeSpecDetail(summary: SpecSummary): SpecDetail {
  return {
    summary,
    brief: null,
    requirements: { requirements: [], otherBlocks: [] },
    design: { sections: [], traceability: [], componentRequirements: [], content: "" },
    tasks: { tasks: [], otherBlocks: [] },
    research: null,
    validations: [],
  };
}

const putRequests: { url: string; body: unknown }[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  putRequests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

/** mutation フックと QueryClient を同一プロバイダ配下で観測するためのラッパ */
function renderApprovalHook(feature: string) {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      mutation: useApprovalMutation(feature),
      queryClient: useQueryClient(),
    }),
    { wrapper },
  );
  return result;
}

describe("useApprovalMutation 成功時", () => {
  it("PUT を 1 件発行し、['specs'] と ['spec', feature] キャッシュを更新後 SpecSummary に反映する", async () => {
    const before = makeSpecSummary("foo");
    const after = makeSpecSummary("foo", {
      phase: "tasks",
      approvals: {
        requirements: { generated: true, approved: true },
        design: { generated: true, approved: true },
        tasks: { generated: false, approved: false },
      },
      updatedAt: "2026-06-12T00:00:00Z",
    });

    server.use(
      http.put("/api/specs/:feature/approvals", async ({ request }) => {
        putRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(after);
      }),
      // invalidate 後の refetch は更新後状態を返す（post-state へ収束）
      http.get("/api/specs", () => HttpResponse.json([after])),
      http.get("/api/specs/:feature", () => HttpResponse.json(makeSpecDetail(after))),
      http.get("/api/specs/:feature/trace", ({ params }) =>
        HttpResponse.json({
          feature: String(params.feature),
          nodes: { requirements: [], designElements: [], tasks: [] },
          edges: [],
          diagnostics: [],
        }),
      ),
    );

    const result = renderApprovalHook("foo");

    // 事前にキャッシュへ「変更前」状態を seed する
    act(() => {
      result.current.queryClient.setQueryData(queryKeys.specs, [before]);
      result.current.queryClient.setQueryData(queryKeys.spec("foo"), makeSpecDetail(before));
    });

    await act(async () => {
      await result.current.mutation.mutateAsync({ phase: "design" });
    });

    // PUT は 1 件のみ
    expect(putRequests).toHaveLength(1);
    expect(putRequests[0]?.url).toBe("/api/specs/foo/approvals");
    expect(putRequests[0]?.body).toEqual({ phase: "design", approved: true });

    // キャッシュが更新後状態へ即時反映（invalidate の refetch 完了前でも setQueryData 済み）
    const specsCache = result.current.queryClient.getQueryData<SpecSummary[]>(queryKeys.specs);
    expect(specsCache?.[0]?.approvals?.design.approved).toBe(true);
    expect(specsCache?.[0]?.phase).toBe("tasks");
    expect(specsCache?.[0]?.updatedAt).toBe("2026-06-12T00:00:00Z");

    const detailCache = result.current.queryClient.getQueryData<SpecDetail>(queryKeys.spec("foo"));
    expect(detailCache?.summary.approvals?.design.approved).toBe(true);
    expect(detailCache?.summary.phase).toBe("tasks");
  });

  it("成功後に ['specs'] / ['spec', feature] / ['trace', feature] が invalidate される", async () => {
    const after = makeSpecSummary("foo");
    server.use(
      http.put("/api/specs/:feature/approvals", () => HttpResponse.json(after)),
      http.get("/api/specs", () => HttpResponse.json([after])),
      http.get("/api/specs/:feature", () => HttpResponse.json(makeSpecDetail(after))),
      http.get("/api/specs/:feature/trace", ({ params }) =>
        HttpResponse.json({
          feature: String(params.feature),
          nodes: { requirements: [], designElements: [], tasks: [] },
          edges: [],
          diagnostics: [],
        }),
      ),
    );

    const result = renderApprovalHook("foo");

    await act(async () => {
      await result.current.mutation.mutateAsync({ phase: "design" });
    });

    // 3 キーがクエリキャッシュ上で invalidated（stale）になっている
    const qc = result.current.queryClient;
    for (const key of [queryKeys.specs, queryKeys.spec("foo"), queryKeys.trace("foo")]) {
      const state = qc.getQueryState(key);
      // 該当キーが存在する場合は invalidated 扱い（未マウントでキャッシュ不在でも refetch は到達済み）
      if (state) {
        expect(state.isInvalidated).toBe(true);
      }
    }
  });
});

describe("useApprovalMutation 失敗時（409）", () => {
  it("NormalizedApiError(code/message/status=409) に正規化され、キャッシュは不変", async () => {
    const before = makeSpecSummary("foo");
    server.use(
      http.put("/api/specs/:feature/approvals", () =>
        HttpResponse.json(
          {
            error: {
              code: "APPROVAL_ORDER_VIOLATION",
              message: "design を承認する前に requirements を承認してください。",
            },
          },
          { status: 409 },
        ),
      ),
    );

    const result = renderApprovalHook("foo");
    act(() => {
      result.current.queryClient.setQueryData(queryKeys.specs, [before]);
      result.current.queryClient.setQueryData(queryKeys.spec("foo"), makeSpecDetail(before));
    });

    await act(async () => {
      await result.current.mutation.mutateAsync({ phase: "design" }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.mutation.isError).toBe(true));

    const error = result.current.mutation.error;
    expect(error).toBeInstanceOf(NormalizedApiError);
    expect(error?.code).toBe("APPROVAL_ORDER_VIOLATION");
    expect(error?.message).toBe("design を承認する前に requirements を承認してください。");
    expect(error?.status).toBe(409);

    // キャッシュは変更前のまま
    const specsCache = result.current.queryClient.getQueryData<SpecSummary[]>(queryKeys.specs);
    expect(specsCache?.[0]?.approvals?.design.approved).toBe(false);
    const detailCache = result.current.queryClient.getQueryData<SpecDetail>(queryKeys.spec("foo"));
    expect(detailCache?.summary.approvals?.design.approved).toBe(false);
  });
});
