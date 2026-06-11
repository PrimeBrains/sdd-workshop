/**
 * MatrixPage の結合テスト（tasks.md 7.1 / Requirements 5.1, 5.5 /
 * design.md「MatrixPage + MatrixGrid」・ルート表 `/specs/:feature/matrix`）。
 *
 * - `/specs/foo/matrix` で MatrixPage が描画され、TraceIndex 由来のグリッドが現れる（5.1 結合）
 * - loading → LoadingSkeleton、error → ErrorPanel + 再試行（1.5）
 *
 * 実際のルート登録（router.tsx の matrix ルートが MatrixPage に差し替わっていること）は
 * router.test.tsx 側で検証する。ここでは MatrixPage 単体のデータフロー（取得 → グリッド）を見る。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TraceGraph } from "@contracts/trace";
import { MatrixPage } from "./MatrixPage";

const graphFixture: TraceGraph = {
  feature: "foo",
  nodes: {
    requirements: [{ type: "requirement", id: "1.1" }],
    designElements: [{ type: "design", name: "TraceIndex" }],
    tasks: [{ type: "task", id: "5.1" }],
  },
  edges: [
    {
      from: { type: "requirement", id: "1.1" },
      to: { type: "task", id: "5.1" },
      source: "task-annotation",
      legacyExpanded: false,
    },
  ],
  diagnostics: [],
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** `/specs/:feature/matrix` を直接開いて MatrixPage を描画する */
function renderMatrix(url: string) {
  const router = createMemoryRouter(
    [{ path: "/specs/:feature/matrix", element: <MatrixPage /> }],
    { initialEntries: [url] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe("MatrixPage（/specs/:feature/matrix の結合）", () => {
  it("グラフ取得後にカバレッジグリッドが描画される", async () => {
    server.use(http.get("/api/specs/foo/trace", () => HttpResponse.json(graphFixture)));
    renderMatrix("/specs/foo/matrix");

    expect(await screen.findByTestId("matrix-page")).toBeTruthy();
    // グリッドの行（要件 1.1）とマーク（task:5.1）が描画される
    await screen.findByTestId("matrix-grid");
    expect(screen.getByTestId("matrix-row-1.1")).toBeTruthy();
    expect(screen.getByTestId("matrix-cell-mark-1.1-task:5.1")).toBeTruthy();
  });

  it("loading 中は LoadingSkeleton を表示する", async () => {
    server.use(http.get("/api/specs/foo/trace", () => new Promise(() => {})));
    renderMatrix("/specs/foo/matrix");

    expect(await screen.findByTestId("loading-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("matrix-grid")).toBeNull();
  });

  it("error 時は ErrorPanel + 再試行を表示する（1.5）", async () => {
    server.use(
      http.get("/api/specs/foo/trace", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "失敗" } },
          { status: 500 },
        ),
      ),
    );
    renderMatrix("/specs/foo/matrix");

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
    expect(screen.queryByTestId("matrix-grid")).toBeNull();
  });
});
