/**
 * AppShell のテスト（tasks.md 1.3 / design.md「AppShell + Router + SpecActionSlot」）。
 *
 * - ヘッダにリポジトリ名（GET /api/repo の name）を厳密値で表示する
 * - スペックサイドバーに GET /api/specs の feature 名を NavLink として厳密値で列挙する
 * - 読込失敗は非致命的に扱う（シェル自体は描画され続ける）
 * - 書込操作 UI（button 等）が成功状態のシェルに存在しない（Requirement 8.1）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { routes } from "@/app/router";

const repoFixture: RepoInfo = { repoRoot: "/home/user/ghq/sdd-workshop", name: "sdd-workshop" };

function makeSpecSummary(feature: string): SpecSummary {
  return {
    feature,
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
}

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

function mockSuccess() {
  server.use(
    http.get("/api/repo", () => HttpResponse.json(repoFixture)),
    http.get("/api/specs", () =>
      HttpResponse.json([makeSpecSummary("sdd-review-ui"), makeSpecSummary("sdd-core")]),
    ),
    // SpecDocumentPage（3.2 で実装済み）がコンテンツ領域で取得する詳細の最小フィクスチャ
    http.get("/api/specs/:feature", ({ params }) =>
      HttpResponse.json({
        summary: makeSpecSummary(String(params.feature)),
        brief: null,
        requirements: { requirements: [], otherBlocks: [] },
        design: null,
        tasks: null,
        research: null,
        validations: [],
      } satisfies SpecDetail),
    ),
  );
}

function renderShell(initialEntry = "/specs", queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("AppShell", () => {
  it("ヘッダに GET /api/repo のリポジトリ名を厳密値で表示する", async () => {
    mockSuccess();
    renderShell();
    const repoName = await screen.findByTestId("repo-name");
    expect(repoName.textContent).toBe("sdd-workshop");
  });

  it("サイドバーに GET /api/specs の feature 名を NavLink として厳密値で列挙する", async () => {
    mockSuccess();
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "スペック一覧" });
    const links = await within(nav).findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["sdd-review-ui", "sdd-core"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/specs/sdd-review-ui",
      "/specs/sdd-core",
    ]);
  });

  it("リポジトリ情報の取得失敗は非致命的（シェルとコンテンツは描画され続ける）", async () => {
    server.use(
      http.get("/api/repo", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
      http.get("/api/specs", () => HttpResponse.json([makeSpecSummary("sdd-review-ui")])),
    );
    renderShell();
    // コンテンツ（/specs プレースホルダ）とサイドバーは生きている
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "sdd-review-ui" })).toBeTruthy();
  });

  it("スペック一覧の取得失敗はサイドバー内のエラー表示に留まる（シェルは描画され続ける）", async () => {
    server.use(
      http.get("/api/repo", () => HttpResponse.json(repoFixture)),
      http.get("/api/specs", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
    );
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "スペック一覧" });
    expect(await within(nav).findByRole("alert")).toBeTruthy();
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
  });

  it("成功状態のシェル全体に button が 1 つも存在しない（Requirement 8.1: 承認ボタン等の書込 UI なし）", async () => {
    mockSuccess();
    renderShell("/specs/sdd-review-ui/requirements");
    await screen.findByTestId("spec-document-page");
    await screen.findByTestId("repo-name");
    await screen.findByRole("link", { name: "sdd-core" });
    // ドキュメント詳細の読込完了（成功状態）まで待ってから全体を検査する
    await waitFor(() => {
      expect(screen.queryByTestId("loading-skeleton")).toBeNull();
    });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
