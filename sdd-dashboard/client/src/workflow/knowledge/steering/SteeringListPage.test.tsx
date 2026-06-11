/**
 * SteeringListPage テスト（tasks.md 6.1 / requirements 5.1 / design.md「Feature: knowledge → SteeringListPage」）。
 *
 * - 5.1: useSteeringList の全 steering 文書を一覧表示する（フィクスチャ 3 件が ALL 表示される）。
 *   タイトル/名前は厳密値で検証し、空配列で pass しないようにする（偽 pass 防止）。
 * - 各エントリは /steering/:name へのリンクで、href を厳密値で検証する。
 * - 失敗パス: msw 500 → ErrorPanel（厳密 code）+ 再試行で refetch → 成功データ描画。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SteeringDocSummary } from "@contracts/resources";
import { SteeringListPage } from "./SteeringListPage";

const listFixture: SteeringDocSummary[] = [
  { name: "product", title: "Product Overview" },
  { name: "tech", title: "Tech Stack" },
  { name: "structure", title: null },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** retry: false で失敗を即座に ErrorPanel へ surfacing する（createQueryClient は retry: 1） */
function renderPage() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SteeringListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SteeringListPage 一覧表示（Requirement 5.1: 全 steering 文書を表示）", () => {
  it("フィクスチャ 3 件の steering 文書が ALL 表示され、各リンクが /steering/:name を指す", async () => {
    server.use(http.get("/api/steering", () => HttpResponse.json(listFixture)));
    renderPage();

    const list = await screen.findByTestId("steering-list");
    const links = within(list).getAllByRole("link");
    // ALL 3 件（欠落なし）
    expect(links).toHaveLength(3);
    // 表示テキストは title ?? name（structure は title が null のため name を表示）
    expect(links.map((l) => l.textContent)).toEqual([
      "Product Overview",
      "Tech Stack",
      "structure",
    ]);
    // 各リンク href は /steering/:name（厳密値）
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/steering/product",
      "/steering/tech",
      "/steering/structure",
    ]);
  });

  it("loading 中は LoadingSkeleton を表示する", () => {
    server.use(http.get("/api/steering", () => new Promise(() => {})));
    renderPage();
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});

describe("SteeringListPage 失敗パス（Requirement 9.6: code/message + 再試行）", () => {
  it("500 → ErrorPanel が厳密 code を表示し、再試行で refetch して成功データを描画する", async () => {
    // retry: false なので初回ロードは 1 回の失敗で ErrorPanel に到達する。
    // 手動の再試行ボタン押下（2 回目）で成功させる（偽 pass 防止: 自動 retry で勝手に成功しない）。
    let calls = 0;
    server.use(
      http.get("/api/steering", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "boom" } },
            { status: 500 },
          );
        }
        return HttpResponse.json(listFixture);
      }),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "再試行" }));

    const list = await screen.findByTestId("steering-list");
    await waitFor(() => expect(within(list).getAllByRole("link")).toHaveLength(3));
  });
});
