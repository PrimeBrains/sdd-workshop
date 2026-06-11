/**
 * タスク 1.2 完了条件の結合テスト（Requirement 1.5）:
 * msw でモックした 500 + `ApiError` 応答に対し、ErrorPanel にエラーコードと
 * メッセージの厳密値が表示され、再試行ボタンで再取得（実際の 2 回目のネットワーク
 * リクエスト）が発火して復旧データが描画されることを検証する。
 * 偽 pass 防止: 再試行前にリクエスト数が 1 のままであることを先に確認する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecSummary } from "@contracts/spec";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { useSpecs } from "@/api/useSpecs";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const recoveredSpec: SpecSummary = {
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

/** useSpecs + ErrorPanel の最小結合ハーネス（エラー時は ErrorPanel、成功時は一覧） */
function SpecsHarness() {
  const query = useSpecs();
  if (query.isError) {
    return (
      <ErrorPanel
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (!query.isSuccess) {
    return <p>読み込み中</p>;
  }
  return (
    <ul>
      {query.data.map((spec) => (
        <li key={spec.feature}>{spec.feature}</li>
      ))}
    </ul>
  );
}

describe("500 + ApiError → ErrorPanel → 再試行（タスク 1.2 完了条件）", () => {
  it("エラーコードとメッセージの厳密値が表示され、再試行ボタンで 2 回目のリクエストが発火して復旧する", async () => {
    let requestCount = 0;
    server.use(
      http.get("/api/specs", () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
            { status: 500 },
          );
        }
        return HttpResponse.json([recoveredSpec]);
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SpecsHarness />
      </QueryClientProvider>,
    );

    // 1 回目の取得が失敗し、ErrorPanel に code / message の厳密値が出る
    const code = await screen.findByText("INTERNAL_ERROR");
    expect(code.textContent).toBe("INTERNAL_ERROR");
    expect(screen.getByText("想定外のエラーが発生しました").textContent).toBe(
      "想定外のエラーが発生しました",
    );

    // 偽 pass 防止: 再試行ボタンを押すまでネットワークリクエストは 1 回のまま
    expect(requestCount).toBe(1);

    // 再試行ボタン → 実際の 2 回目のリクエストが発火し、復旧データが描画される
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    const item = await screen.findByText("sdd-review-ui");
    expect(item.textContent).toBe("sdd-review-ui");
    expect(requestCount).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
