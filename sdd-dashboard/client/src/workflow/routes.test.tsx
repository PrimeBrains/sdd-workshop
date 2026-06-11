/**
 * workflowRoutes のルート結合テスト（tasks.md 1.1 / design.md「ルート表」「Shell Integration 層」）。
 *
 * - 予約名前空間（/board /help /steering /steering/:name /skills /skills/:name /adr /adr/:id）を
 *   直接開く（= リロード・共有リンク相当）と、対応するプレースホルダが復元される（Requirement 1.5, 9.1）
 * - 既存 /specs/** ルートは workflowRoutes 連結後も変わらず描画される（Requirement 9.2）
 * - 共通ナビゲーション（AppShell）から各 workflow ルートへ到達できる（Requirement 4.3, 9.1）
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecSummary } from "@contracts/spec";
import { createQueryClient } from "@/app/queryClient";
import { routes } from "@/app/router";

/** jsdom には EventSource が無いため、AppShell 常駐の SseInvalidationBridge がクラッシュしないよう差し替える */
class FakeEventSource {
  url: string;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

/** ReactFlow（board ルート）が要求する ResizeObserver は jsdom に無いため最小スタブを注入する。 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
beforeAll(() => {
  if ((globalThis as { ResizeObserver?: unknown }).ResizeObserver === undefined) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

let restoreEventSource: (() => void) | undefined;
beforeEach(() => {
  const original = (globalThis as { EventSource?: unknown }).EventSource;
  (globalThis as { EventSource?: unknown }).EventSource =
    FakeEventSource as unknown as typeof EventSource;
  restoreEventSource = () => {
    (globalThis as { EventSource?: unknown }).EventSource = original;
  };
});
afterEach(() => {
  restoreEventSource?.();
});

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
  // 6.1 で steering ルートが実画面（データ取得あり）に差し替わったため、最小フィクスチャを供給する。
  http.get("/api/steering", () => HttpResponse.json([{ name: "product", title: "Product" }])),
  http.get("/api/steering/:name", ({ params }) =>
    HttpResponse.json({ name: String(params.name), content: "# Product\n本文", sections: [] }),
  ),
  // 6.2 で skills ルートが実画面（データ取得あり）に差し替わったため、最小フィクスチャを供給する。
  http.get("/api/skills", () =>
    HttpResponse.json([{ name: "kiro-review", hasEn: true, hasJa: true, origin: "cc-sdd" }]),
  ),
  http.get("/api/skills/:name", ({ params }) =>
    HttpResponse.json({
      name: String(params.name),
      en: { content: "# Skill\nEN body", sections: [] },
      ja: { content: "# スキル\nJA body", sections: [] },
      origin: "cc-sdd",
    }),
  ),
  // 6.3 で adr ルートが実画面（データ取得あり）に差し替わったため、最小フィクスチャを供給する。
  http.get("/api/adr", () =>
    HttpResponse.json([
      {
        name: "0001-sample-decision",
        frontmatter: {
          id: 1,
          title: "Sample decision",
          status: "accepted",
          date: "2026-06-01",
          app: "sdd-dashboard",
          specs: ["sdd-review-ui"],
          requirements: [],
          supersedes: null,
          superseded_by: null,
        },
        diagnostics: [],
      },
    ]),
  ),
  http.get("/api/adr/:id", ({ params }) =>
    HttpResponse.json({
      name: String(params.id),
      frontmatter: {
        id: 1,
        title: "Sample decision",
        status: "accepted",
        date: "2026-06-01",
        app: "sdd-dashboard",
        specs: ["sdd-review-ui"],
        requirements: [],
        supersedes: null,
        superseded_by: null,
      },
      content: "## Context\n背景\n## Decision\n決定",
      sections: [],
      diagnostics: [],
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
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

describe("workflowRoutes（Requirement 1.5: URL によるビュー復元 / 9.1: 同一 SPA 統合）", () => {
  it("/board を直接開くと board 画面（遅延ロード）が復元される", async () => {
    const router = renderAt("/board");
    // React.lazy + Suspense 経由で BoardPage が描画され、見出し「Board」を含む。
    const page = await screen.findByTestId("workflow-board-page");
    expect(within(page).getByRole("heading", { name: "Board" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/board");
  });

  it("/help を直接開くと HelpPage（フロー解説）が復元される", async () => {
    const router = renderAt("/help");
    const page = await screen.findByTestId("workflow-help-page");
    expect(within(page).getByRole("heading", { level: 1 })).toBeTruthy();
    // フロー解説の 8 ステップが描画される（プレースホルダではない実画面である証跡）。
    expect(within(page).getAllByTestId("help-flow-step")).toHaveLength(8);
    expect(router.state.location.pathname).toBe("/help");
  });

  it("/adr を直接開くと AdrListPage（実画面・一覧リンク）が復元される", async () => {
    const router = renderAt("/adr");
    const page = await screen.findByTestId("workflow-adr-list-page");
    // プレースホルダではなく実画面である証跡（一覧リンクが描画される）。
    expect(within(page).getByRole("link", { name: /Sample decision/ })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/adr");
  });

  it("/adr/:id を直接開くと AdrDetailPage（実画面・本文描画）が復元される", async () => {
    const router = renderAt("/adr/0001-sample-decision");
    const page = await screen.findByTestId("adr-detail-page");
    // MarkdownDoc 経由で本文の見出しが描画される（プレースホルダではない証跡）。
    expect(within(page).getByRole("heading", { name: "Context" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/adr/0001-sample-decision");
  });

  it("/skills を直接開くと SkillListPage（実画面）が復元される", async () => {
    const router = renderAt("/skills");
    const page = await screen.findByTestId("workflow-skill-list-page");
    // プレースホルダではなく実画面である証跡（一覧リンクが描画される）。
    expect(within(page).getByRole("link", { name: /kiro-review/ })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/skills");
  });

  it("/skills/:name を直接開くと SkillDocPage（実画面・origin バッジ）が復元される", async () => {
    const router = renderAt("/skills/kiro-review");
    const page = await screen.findByTestId("skill-doc-page");
    // プレースホルダではなく実画面である証跡（origin バッジが描画される）。
    expect(within(page).getByTestId("origin-badge").textContent).toBe("cc-sdd 標準");
    expect(router.state.location.pathname).toBe("/skills/kiro-review");
  });

  it("/steering を直接開くと SteeringListPage（実画面）が復元される", async () => {
    const router = renderAt("/steering");
    const page = await screen.findByTestId("workflow-steering-list-page");
    // プレースホルダではなく実画面である証跡（一覧リンクが描画される）。
    expect(within(page).getByRole("link", { name: "Product" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/steering");
  });

  it("/steering/:name を直接開くと SteeringDocPage（実画面・本文描画）が復元される", async () => {
    const router = renderAt("/steering/product");
    const page = await screen.findByTestId("steering-doc-page");
    // MarkdownDoc 経由で本文の見出しが描画される（プレースホルダではない証跡）。
    expect(within(page).getByRole("heading", { name: "Product" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/steering/product");
  });
});

describe("既存 /specs/** ルートの無変更動作（Requirement 9.2）", () => {
  it("/specs を直接開くと既存 SpecListPage が変わらず描画される", async () => {
    renderAt("/specs");
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
  });
});

describe("共通ナビゲーション（Requirement 4.3, 9.1）", () => {
  it("AppShell の共通ナビに Board / Help / Steering / Skills / ADR リンクが存在する", async () => {
    renderAt("/specs");
    const nav = await screen.findByRole("navigation", { name: "ワークフロー" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Board", "Help", "Steering", "Skills", "ADR"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/board",
      "/help",
      "/steering",
      "/skills",
      "/adr",
    ]);
  });
});
