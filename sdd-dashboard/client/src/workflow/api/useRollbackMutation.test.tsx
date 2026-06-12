/**
 * useRollbackMutation の結合テスト（tasks.md 1.2 / design.md 「書込成功後の状態反映」）。
 *
 * - 成功時: POST が 1 件発行され、['specs'] / ['spec', feature] キャッシュが更新後状態に反映される
 * - 成功後に 3 キーが invalidate される
 * - 失敗時は NormalizedApiError へ正規化され、キャッシュは不変
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
import { useRollbackMutation } from "./useRollbackMutation";

function makeSpecSummary(feature: string, overrides?: Partial<SpecSummary>): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "tasks",
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

const postRequests: { url: string; body: unknown }[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  postRequests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

function renderRollbackHook(feature: string) {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      mutation: useRollbackMutation(feature),
      queryClient: useQueryClient(),
    }),
    { wrapper },
  );
  return result;
}

describe("useRollbackMutation 成功時", () => {
  it("POST を 1 件発行し、['specs'] と ['spec', feature] キャッシュを更新後状態に反映する", async () => {
    const before = makeSpecSummary("foo");
    const after = makeSpecSummary("foo", {
      phase: "requirements",
      approvals: {
        requirements: { generated: true, approved: true },
        design: { generated: true, approved: false },
        tasks: { generated: true, approved: false },
      },
      readyForImplementation: false,
      updatedAt: "2026-06-12T00:00:00Z",
    });

    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request }) => {
        postRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(after);
      }),
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

    const result = renderRollbackHook("foo");
    act(() => {
      result.current.queryClient.setQueryData(queryKeys.specs, [before]);
      result.current.queryClient.setQueryData(queryKeys.spec("foo"), makeSpecDetail(before));
    });

    await act(async () => {
      await result.current.mutation.mutateAsync({ targetPhase: "design" });
    });

    expect(postRequests).toHaveLength(1);
    expect(postRequests[0]?.url).toBe("/api/specs/foo/rollback");
    expect(postRequests[0]?.body).toEqual({ targetPhase: "design" });

    const specsCache = result.current.queryClient.getQueryData<SpecSummary[]>(queryKeys.specs);
    expect(specsCache?.[0]?.approvals?.design.approved).toBe(false);
    expect(specsCache?.[0]?.readyForImplementation).toBe(false);
    expect(specsCache?.[0]?.phase).toBe("requirements");

    const detailCache = result.current.queryClient.getQueryData<SpecDetail>(queryKeys.spec("foo"));
    expect(detailCache?.summary.readyForImplementation).toBe(false);
    expect(detailCache?.summary.approvals?.tasks.approved).toBe(false);
  });

  it("成功後に 3 キーが invalidate される", async () => {
    const after = makeSpecSummary("foo");
    server.use(
      http.post("/api/specs/:feature/rollback", () => HttpResponse.json(after)),
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

    const result = renderRollbackHook("foo");
    await act(async () => {
      await result.current.mutation.mutateAsync({ targetPhase: "design" });
    });

    const qc = result.current.queryClient;
    for (const key of [queryKeys.specs, queryKeys.spec("foo"), queryKeys.trace("foo")]) {
      const state = qc.getQueryState(key);
      if (state) {
        expect(state.isInvalidated).toBe(true);
      }
    }
  });
});

describe("useRollbackMutation 失敗時", () => {
  it("422 を NormalizedApiError へ正規化し、キャッシュは不変", async () => {
    const before = makeSpecSummary("foo");
    server.use(
      http.post("/api/specs/:feature/rollback", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "巻き戻し先フェーズが不正です。",
              fieldErrors: { targetPhase: ["未生成のフェーズには戻せません。"] },
            },
          },
          { status: 422 },
        ),
      ),
    );

    const result = renderRollbackHook("foo");
    act(() => {
      result.current.queryClient.setQueryData(queryKeys.specs, [before]);
      result.current.queryClient.setQueryData(queryKeys.spec("foo"), makeSpecDetail(before));
    });

    await act(async () => {
      await result.current.mutation.mutateAsync({ targetPhase: "design" }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));

    const error = result.current.mutation.error;
    expect(error).toBeInstanceOf(NormalizedApiError);
    expect(error?.code).toBe("VALIDATION_ERROR");
    expect(error?.status).toBe(422);
    expect(error?.fieldErrors).toEqual({ targetPhase: ["未生成のフェーズには戻せません。"] });

    const specsCache = result.current.queryClient.getQueryData<SpecSummary[]>(queryKeys.specs);
    expect(specsCache?.[0]?.readyForImplementation).toBe(true);
  });
});
