/**
 * ルートレジストリのテスト（tasks.md 1.3 / design.md「ルート表（本スペックが定義する URL 空間）」）。
 *
 * - URL 直開き（リロード相当）で同じビュー構成が復元される（Requirement 1.4）
 * - 未知 URL は /specs へフォールバックする
 * - compare / matrix / validation ルートは汎用 `:document` より優先される
 * - 予約名前空間は定数 RESERVED_NAMESPACES の宣言のみ（ルート未実装 → フォールバック）
 * - プレースホルダ画面に書込操作 UI（button 等）が存在しない（Requirement 8.1）
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { createQueryClient } from "@/app/queryClient";
import { RESERVED_NAMESPACES, routes } from "@/app/router";

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

/** SpecOverviewPage（2.2 で実装済み）が取得する GET /api/specs/:feature の最小フィクスチャ */
function makeSpecDetail(feature: string): SpecDetail {
  return {
    summary: makeSpecSummary(feature),
    brief: null,
    requirements: { requirements: [], otherBlocks: [] },
    design: { sections: [], traceability: [], componentRequirements: [] },
    tasks: { tasks: [], otherBlocks: [] },
    research: null,
    validations: [],
  };
}

const server = setupServer(
  http.get("/api/repo", () => HttpResponse.json(repoFixture)),
  http.get("/api/specs", () => HttpResponse.json([makeSpecSummary("sdd-review-ui")])),
  // ComparePage（6.1）/ SpecDocumentPage（3.2）はペイン内 RefChip 用に trace グラフも取得する。
  // 空グラフでよい（RefChip は index から素のテキストへグレースフルに退避する）。
  http.get("/api/specs/:feature/trace", ({ params }) =>
    HttpResponse.json({
      feature: String(params.feature),
      nodes: { requirements: [], designElements: [], tasks: [] },
      edges: [],
      diagnostics: [],
    }),
  ),
  http.get("/api/specs/:feature", ({ params }) =>
    HttpResponse.json(makeSpecDetail(String(params.feature))),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** URL 直開き（= リロード・共有リンク）を createMemoryRouter で再現する */
function renderAt(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("ルートレジストリ（Requirement 1.4: URL によるビュー復元）", () => {
  it("/specs/foo/requirements を直接開くと SpecDocumentPage（3.2 で実装済み）が feature=foo, document=requirements で復元される", async () => {
    const router = renderAt("/specs/foo/requirements");
    await screen.findByTestId("spec-document-page");
    const heading = await screen.findByTestId("spec-document-heading");
    expect(heading.textContent).toBe("foo/requirements");
    expect(router.state.location.pathname).toBe("/specs/foo/requirements");
  });

  it("/specs を直接開くと SpecListPage（2.1 で実装済み）が表示される", async () => {
    renderAt("/specs");
    const page = await screen.findByTestId("spec-list-page");
    expect(page).toBeTruthy();
  });

  it("/specs/foo を直接開くと SpecOverviewPage（2.2 で実装済み）が feature=foo で復元される", async () => {
    renderAt("/specs/foo");
    await screen.findByTestId("spec-overview-page");
    const heading = await screen.findByTestId("spec-overview-heading");
    expect(heading.textContent).toBe("foo");
  });

  it("/ は /specs へリダイレクトされる", async () => {
    const router = renderAt("/");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs");
    });
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
  });

  it("未知 URL（/nope/xyz）は /specs へフォールバックする", async () => {
    const router = renderAt("/nope/xyz");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs");
    });
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
  });
});

describe("ルート優先順位（compare / matrix / validation は :document より先に一致する）", () => {
  it("/specs/foo/compare は ComparePage（6.1 で実装済み）に一致する（document=compare ではない）", async () => {
    renderAt("/specs/foo/compare");
    const page = await screen.findByTestId("compare-page");
    const heading = await screen.findByTestId("compare-page-heading");
    expect(heading.textContent).toBe("foo/compare");
    // 2 ペイン比較画面が描画される（プレースホルダではなく実ページに到達している）
    expect(await within(page).findByTestId("compare-pane-left")).toBeTruthy();
    expect(within(page).getByTestId("compare-pane-right")).toBeTruthy();
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });

  it("/specs/foo/matrix は MatrixPage（7.1 で実装済み）に一致する（document=matrix ではない）", async () => {
    renderAt("/specs/foo/matrix");
    const page = await screen.findByTestId("matrix-page");
    const heading = await screen.findByTestId("matrix-page-heading");
    expect(heading.textContent).toBe("foo/matrix");
    // 空グラフ（共通フィクスチャ）でもカバレッジグリッドに到達する（プレースホルダではない）
    expect(await within(page).findByTestId("matrix-grid")).toBeTruthy();
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });

  it("/specs/foo/validation/gap は ValidationReportPage（8.2 で実装済み）に一致する（type=gap）", async () => {
    renderAt("/specs/foo/validation/gap");
    // 実ページに到達する（プレースホルダではない）。共通フィクスチャは validations 空 = 未生成表示
    const page = await screen.findByTestId("validation-report-page");
    expect(await within(page).findByTestId("validation-report-not-generated")).toBeTruthy();
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });
});

describe("予約名前空間（workflow-ui 向け契約宣言）", () => {
  it("RESERVED_NAMESPACES は厳密に [/board, /help, /steering, /skills, /adr] である", () => {
    expect(RESERVED_NAMESPACES).toEqual(["/board", "/help", "/steering", "/skills", "/adr"]);
  });

  it("予約名前空間（/board）は本スペックではルート未実装であり /specs へフォールバックする", async () => {
    const router = renderAt("/board");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs");
    });
  });
});

describe("書込操作 UI の不在（Requirement 8.1）", () => {
  it("ドキュメント画面（SpecDocumentPage + シェル）に button が 1 つも存在しない", async () => {
    renderAt("/specs/foo/requirements");
    await screen.findByTestId("spec-document-page");
    // サイドバーのスペック一覧の読込完了まで待ってから全体を検査する
    await screen.findByRole("link", { name: "sdd-review-ui" });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
