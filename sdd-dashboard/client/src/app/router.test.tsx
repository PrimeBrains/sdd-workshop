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
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecSummary } from "@contracts/spec";
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

const server = setupServer(
  http.get("/api/repo", () => HttpResponse.json(repoFixture)),
  http.get("/api/specs", () => HttpResponse.json([makeSpecSummary("sdd-review-ui")])),
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
  it("/specs/foo/requirements を直接開くと SpecDocumentPage プレースホルダが feature=foo, document=requirements で復元される", async () => {
    const router = renderAt("/specs/foo/requirements");
    const page = await screen.findByTestId("spec-document-page");
    expect(page.textContent).toBe("foo/requirements");
    expect(router.state.location.pathname).toBe("/specs/foo/requirements");
  });

  it("/specs を直接開くと SpecListPage（2.1 で実装済み）が表示される", async () => {
    renderAt("/specs");
    const page = await screen.findByTestId("spec-list-page");
    expect(page).toBeTruthy();
  });

  it("/specs/foo を直接開くと SpecOverviewPage プレースホルダが feature=foo で復元される", async () => {
    renderAt("/specs/foo");
    const page = await screen.findByTestId("spec-overview-page");
    expect(page.textContent).toBe("foo");
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
  it("/specs/foo/compare は ComparePage プレースホルダに一致する（document=compare ではない）", async () => {
    renderAt("/specs/foo/compare");
    const page = await screen.findByTestId("compare-page");
    expect(page.textContent).toBe("foo/compare");
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });

  it("/specs/foo/matrix は MatrixPage プレースホルダに一致する", async () => {
    renderAt("/specs/foo/matrix");
    const page = await screen.findByTestId("matrix-page");
    expect(page.textContent).toBe("foo/matrix");
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });

  it("/specs/foo/validation/gap は ValidationReportPage プレースホルダに一致する（type=gap）", async () => {
    renderAt("/specs/foo/validation/gap");
    const page = await screen.findByTestId("validation-report-page");
    expect(page.textContent).toBe("foo/validation/gap");
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
  it("ドキュメント画面（プレースホルダ + シェル）に button が 1 つも存在しない", async () => {
    renderAt("/specs/foo/requirements");
    await screen.findByTestId("spec-document-page");
    // サイドバーのスペック一覧の読込完了まで待ってから全体を検査する
    await screen.findByRole("link", { name: "sdd-review-ui" });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
