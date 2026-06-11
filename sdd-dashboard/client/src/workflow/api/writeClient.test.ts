/**
 * writeClient（書込専用 fetch ラッパ）の結合テスト（tasks.md 1.2 / design.md WriteClient）。
 *
 * - 成功時に PUT/POST が 1 件だけ発行され、返却 SpecSummary がそのまま解決される
 * - 非 2xx は sdd-core ApiError 形をパースし NormalizedApiError へ正規化（厳密値）
 * - ネットワーク断は NETWORK_ERROR（status=null）へ正規化（review-ui client.ts と同一語彙）
 * - 解釈不能応答は UNEXPECTED_RESPONSE へ正規化
 * - 汎用 post/put を export しない（9.4 の構造的保証）
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SpecSummary } from "@contracts/spec";
import { NormalizedApiError } from "@/api/client";
import * as writeClientModule from "./writeClient";
import { rollback, updateApproval } from "./writeClient";

function makeSpecSummary(feature: string, overrides?: Partial<SpecSummary>): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "design",
    language: "ja",
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: false },
    },
    readyForImplementation: false,
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

const requests: { method: string; url: string; body: unknown }[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe("updateApproval（PUT /api/specs/:feature/approvals）", () => {
  it("成功時: PUT を 1 件だけ発行し、リクエストボディが { phase, approved } で、返却 SpecSummary を解決する", async () => {
    const updated = makeSpecSummary("foo", { phase: "tasks" });
    server.use(
      http.put("/api/specs/:feature/approvals", async ({ request, params }) => {
        requests.push({
          method: request.method,
          url: `/api/specs/${String(params.feature)}/approvals`,
          body: await request.json(),
        });
        return HttpResponse.json(updated);
      }),
    );

    const result = await updateApproval("foo", "tasks", true);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("PUT");
    expect(requests[0]?.url).toBe("/api/specs/foo/approvals");
    expect(requests[0]?.body).toEqual({ phase: "tasks", approved: true });
    expect(result).toEqual(updated);
  });

  it("feature を encodeURIComponent でエンコードする", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", ({ request }) => {
        requests.push({ method: request.method, url: new URL(request.url).pathname, body: null });
        return HttpResponse.json(makeSpecSummary("a/b"));
      }),
    );
    await updateApproval("a/b", "design", true);
    expect(requests[0]?.url).toBe("/api/specs/a%2Fb/approvals");
  });

  it("409 ApiError を NormalizedApiError(code/message/status=409) へ厳密に正規化し、リクエストは 1 件のみ", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", ({ request }) => {
        requests.push({ method: request.method, url: new URL(request.url).pathname, body: null });
        return HttpResponse.json(
          {
            error: {
              code: "APPROVAL_ORDER_VIOLATION",
              message: "design を承認する前に requirements を承認してください。",
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(updateApproval("foo", "design", true)).rejects.toMatchObject({
      name: "NormalizedApiError",
      code: "APPROVAL_ORDER_VIOLATION",
      message: "design を承認する前に requirements を承認してください。",
      status: 409,
    });
    await expect(updateApproval("foo", "design", true)).rejects.toBeInstanceOf(NormalizedApiError);
  });

  it("422 ApiError の fieldErrors を NormalizedApiError へ転記する", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "入力が不正です。",
              fieldErrors: { phase: ["未知のフェーズです。"] },
            },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(updateApproval("foo", "design", true)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
      fieldErrors: { phase: ["未知のフェーズです。"] },
    });
  });

  it("ApiError 形でない非 2xx 応答は UNEXPECTED_RESPONSE へ正規化する", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", () =>
        HttpResponse.json({ unexpected: true }, { status: 500 }),
      ),
    );
    await expect(updateApproval("foo", "design", true)).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 500,
    });
  });

  it("ネットワーク断は NETWORK_ERROR(status=null) へ正規化する（review-ui client.ts と同一）", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", () => HttpResponse.error()),
    );
    const error = await updateApproval("foo", "design", true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NormalizedApiError);
    expect((error as NormalizedApiError).code).toBe("NETWORK_ERROR");
    expect((error as NormalizedApiError).status).toBeNull();
    expect((error as NormalizedApiError).message.length).toBeGreaterThan(0);
  });
});

describe("rollback（POST /api/specs/:feature/rollback）", () => {
  it("成功時: POST を 1 件だけ発行し、ボディが { targetPhase } で、返却 SpecSummary を解決する", async () => {
    const updated = makeSpecSummary("foo", { phase: "requirements" });
    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request, params }) => {
        requests.push({
          method: request.method,
          url: `/api/specs/${String(params.feature)}/rollback`,
          body: await request.json(),
        });
        return HttpResponse.json(updated);
      }),
    );

    const result = await rollback("foo", "requirements");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.url).toBe("/api/specs/foo/rollback");
    expect(requests[0]?.body).toEqual({ targetPhase: "requirements" });
    expect(result).toEqual(updated);
  });

  it("404 ApiError を NormalizedApiError へ正規化する", async () => {
    server.use(
      http.post("/api/specs/:feature/rollback", () =>
        HttpResponse.json(
          { error: { code: "SPEC_NOT_FOUND", message: "スペックが見つかりません。" } },
          { status: 404 },
        ),
      ),
    );
    await expect(rollback("foo", "design")).rejects.toMatchObject({
      code: "SPEC_NOT_FOUND",
      message: "スペックが見つかりません。",
      status: 404,
    });
  });
});

describe("汎用書込メソッドの不在（9.4 の構造的保証）", () => {
  it("writeClient は updateApproval / rollback 以外（post / put）を export しない", () => {
    const exportedNames = Object.keys(writeClientModule).sort();
    expect(exportedNames).not.toContain("post");
    expect(exportedNames).not.toContain("put");
    // 公開面は 2 メソッド（+ 任意の WriteClient まとめオブジェクト）に限定される
    const callable = exportedNames.filter(
      (n) => typeof (writeClientModule as Record<string, unknown>)[n] === "function",
    );
    expect(callable).toEqual(["rollback", "updateApproval"]);
  });
});
