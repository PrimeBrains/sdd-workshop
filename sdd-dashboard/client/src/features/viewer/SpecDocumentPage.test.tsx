/**
 * SpecDocumentPage のテスト（tasks.md 3.2 / Requirements 1.4, 3.9 /
 * design.md ルート表 `/specs/:feature/:document`）。
 *
 * - document パラメータごとに対応ビューが描画される（requirements は RequirementsView
 *   （4.1）、design / tasks は 4.x までの構造化フォールバック。情報無欠落: raw ブロックは
 *   全文描画）
 * - ディープリンク（URL 直開き = リロード・共有リンク）で同一ドキュメントが復元され、
 *   ハッシュのフォーカス対象が scrollIntoView される（3.9 / 完了条件）
 * - 未知 document パラメータは概要 `/specs/:feature` へリダイレクト（1.4: URL が
 *   ビュー位置の真実 → 未知 URL は既知ビューへフォールバック）
 * - 不在成果物（null）は「未作成」の非エラー表示（Requirement 1.3 パターン）
 * - 読込中 LoadingSkeleton / 失敗 ErrorPanel + 再試行（Requirement 1.5 パターン）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { SpecDocumentPage } from "@/features/viewer/SpecDocumentPage";

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number): Position {
  return { startLine, endLine, startOffset, endOffset };
}

function makeSummary(feature: string): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "implementation",
    language: "japanese",
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    },
    readyForImplementation: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
    artifacts: {
      brief: true,
      requirements: true,
      design: true,
      tasks: true,
      research: true,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
  };
}

/** 全成果物が存在するスペック（構造化 + raw の混在で情報無欠落を検証する） */
const fullDetail: SpecDetail = {
  summary: makeSummary("foo"),
  brief: {
    content: "# Brief Heading\n\nbrief の本文です。",
    sections: [{ title: "Brief Heading", depth: 1, position: pos(1, 3, 0, 30), children: [] }],
  },
  research: {
    content: "# Research Heading\n\nresearch の本文です。",
    sections: [{ title: "Research Heading", depth: 1, position: pos(1, 3, 0, 33), children: [] }],
  },
  requirements: {
    requirements: [
      {
        kind: "structured",
        position: pos(5, 12, 100, 300),
        id: "1",
        title: "スペック一覧とドキュメント選択",
        objective: "レビュアーとして成果物を確認したい",
        criteria: [
          {
            kind: "structured",
            position: pos(8, 9, 150, 220),
            id: "1.1",
            text: "The client shall list specs.",
            translationJa: "クライアントはスペックを一覧表示する。",
          },
          {
            kind: "raw",
            position: pos(10, 11, 221, 280),
            markdown: "- 構造化できなかった AC 行",
            reason: "AC 番号が解釈できません",
          },
        ],
      },
    ],
    otherBlocks: [
      {
        kind: "structured",
        position: pos(1, 2, 0, 40),
        section: { title: "Introduction", depth: 2, position: pos(1, 2, 0, 40), children: [] },
      },
      {
        kind: "raw",
        position: pos(3, 4, 41, 99),
        markdown: "要件構造の外側の生コンテンツ",
        reason: "要件構造の外側のコンテンツ",
      },
    ],
  },
  design: {
    sections: [
      {
        title: "Overview",
        depth: 2,
        position: pos(1, 10, 0, 200),
        children: [{ title: "Architecture", depth: 3, position: pos(5, 10, 80, 200), children: [] }],
      },
    ],
    traceability: [
      {
        kind: "structured",
        position: pos(12, 12, 210, 260),
        refs: [{ kind: "id", id: "1.1", raw: "1.1" }],
        summary: "スペック一覧表示",
        components: "SpecListPage",
        interfaces: "useSpecs",
        flows: "—",
      },
      {
        kind: "raw",
        position: pos(13, 13, 261, 300),
        markdown: "| 壊れたトレーサビリティ行 |",
        reason: "セル数が一致しません",
      },
    ],
    componentRequirements: [
      {
        component: "SpecListPage",
        refs: [{ kind: "id", id: "1.1", raw: "1.1" }],
        position: pos(20, 20, 400, 430),
      },
    ],
  },
  tasks: {
    tasks: [
      {
        id: "1",
        description: "ドキュメント表示ページを実装する",
        checked: true,
        parallel: false,
        optional: false,
        details: ["ルーティングを結線する"],
        requirements: [{ kind: "id", id: "1.4", raw: "1.4" }],
        depends: [],
        boundary: null,
        position: pos(3, 8, 60, 200),
        subtasks: [
          {
            id: "1.1",
            description: "ハッシュ復元を実装する",
            checked: false,
            parallel: true,
            optional: true,
            details: [],
            requirements: [{ kind: "id", id: "3.9", raw: "3.9" }],
            depends: ["1"],
            boundary: "viewer 配下のみ",
            position: pos(5, 8, 120, 200),
            subtasks: [],
          },
        ],
      },
    ],
    otherBlocks: [
      {
        kind: "raw",
        position: pos(1, 2, 0, 59),
        markdown: "# Implementation Plan の序文",
        reason: "タスク外コンテンツ",
      },
    ],
  },
  validations: [],
};

/** 全成果物が不在のスペック（不在はエラーではない: Requirement 1.3 パターン） */
const emptyDetail: SpecDetail = {
  summary: {
    ...makeSummary("empty"),
    artifacts: {
      brief: false,
      requirements: false,
      design: false,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
  },
  brief: null,
  requirements: null,
  design: null,
  tasks: null,
  research: null,
  validations: [],
};

const detailByFeature: Record<string, SpecDetail> = {
  foo: fullDetail,
  empty: emptyDetail,
};

const server = setupServer(
  http.get("/api/specs/:feature", ({ params }) => {
    const detail = detailByFeature[String(params.feature)];
    if (detail !== undefined) return HttpResponse.json(detail);
    return HttpResponse.json(
      {
        error: {
          code: "SPEC_NOT_FOUND",
          message: `スペックが見つかりません: ${String(params.feature)}`,
        },
      },
      { status: 404 },
    );
  }),
);

/** scrollIntoView が呼ばれた要素の記録（jsdom に実装が無いため差し替える） */
let scrolledElements: Element[];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  scrolledElements = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledElements.push(this);
  };
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** URL 直開き（= リロード・共有リンク）を createMemoryRouter で再現する */
function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: "/specs/:feature", element: <div data-testid="overview-stub" /> },
      { path: "/specs/:feature/:document", element: <SpecDocumentPage /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe("document パラメータごとのビュー描画（Requirement 1.4）", () => {
  it("brief は MarkdownDoc で全文描画される", async () => {
    renderAt("/specs/foo/brief");
    const heading = await screen.findByRole("heading", { name: "Brief Heading" });
    expect(heading).toBeTruthy();
    expect(screen.getByText("brief の本文です。")).toBeTruthy();
  });

  it("research は MarkdownDoc で全文描画される", async () => {
    renderAt("/specs/foo/research");
    const heading = await screen.findByRole("heading", { name: "Research Heading" });
    expect(heading).toBeTruthy();
    expect(screen.getByText("research の本文です。")).toBeTruthy();
  });

  it("requirements は RequirementsView で要件・AC・和訳・raw ブロックを文書順で全描画する（情報無欠落）", async () => {
    renderAt("/specs/foo/requirements");
    const page = await screen.findByTestId("spec-document-page");
    // データ到着（本文描画）まで待つ
    await screen.findByText("The client shall list specs.");

    // 構造化要件: ID + タイトル + Objective + AC（英文 + 和訳ペア）
    expect(page.textContent).toContain("Requirement 1: スペック一覧とドキュメント選択");
    expect(page.textContent).toContain("レビュアーとして成果物を確認したい");
    expect(page.textContent).toContain("The client shall list specs.");
    expect(page.textContent).toContain("クライアントはスペックを一覧表示する。");
    // raw フォールバック（AC 内・要件外側）も全文描画される
    expect(page.textContent).toContain("構造化できなかった AC 行");
    expect(page.textContent).toContain("要件構造の外側の生コンテンツ");
    // otherBlocks の構造化セクション見出し
    expect(screen.getByRole("heading", { name: "Introduction" })).toBeTruthy();
    // 文書順: Introduction(0) → 外側 raw(41) → Requirement 1(100)
    const intro = screen.getByText("Introduction");
    const outsideRaw = screen.getByText("要件構造の外側の生コンテンツ");
    expect(intro.compareDocumentPosition(outsideRaw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("design は DesignView でセクションナビ・トレーサビリティテーブル・raw 行を描画する", async () => {
    renderAt("/specs/foo/design");
    const page = await screen.findByTestId("spec-document-page");
    // データ到着（本文描画）まで待つ（"Overview" はナビ + 見出しの 2 箇所に出る）
    await screen.findByTestId("design-section-nav");

    // DesignView のセクションツリーナビ（4.2 で SpecDocumentPage に結線）
    const nav = screen.getByTestId("design-section-nav");
    expect(within(nav).getByText("Overview")).toBeTruthy();
    expect(within(nav).getByText("Architecture")).toBeTruthy();
    // 構造化トレーサビリティ行の全フィールド
    expect(page.textContent).toContain("1.1");
    expect(page.textContent).toContain("スペック一覧表示");
    expect(page.textContent).toContain("SpecListPage");
    expect(page.textContent).toContain("useSpecs");
    // raw 行も欠落しない
    expect(page.textContent).toContain("壊れたトレーサビリティ行");
  });

  it("tasks はフォールバックでタスク階層・マーカー・注記・raw ブロックを描画する", async () => {
    renderAt("/specs/foo/tasks");
    const page = await screen.findByTestId("spec-document-page");
    // データ到着（本文描画）まで待つ
    await screen.findByText(/ドキュメント表示ページを実装する/);

    expect(page.textContent).toContain("ドキュメント表示ページを実装する");
    expect(page.textContent).toContain("ルーティングを結線する");
    expect(page.textContent).toContain("ハッシュ復元を実装する");
    expect(page.textContent).toContain("viewer 配下のみ");
    expect(page.textContent).toContain("Implementation Plan の序文");
  });
});

describe("ディープリンクのハッシュ復元（Requirement 3.9 / 完了条件）", () => {
  it("フォーカス対象付き URL の直接オープンで同一ビューが復元され、対象要素へ scrollIntoView される", async () => {
    renderAt("/specs/foo/requirements#req-1.1");

    // 同一ドキュメントビューの復元（AC 内容の厳密値）
    const page = await screen.findByTestId("spec-document-page");
    await waitFor(() => {
      expect(page.textContent).toContain("The client shall list specs.");
    });
    // フォーカス対象（AC 1.1 のアンカー要素）がスクロールされる
    await waitFor(() => {
      expect(scrolledElements).toHaveLength(1);
    });
    expect(scrolledElements[0]?.id).toBe("req-1.1");
    expect(scrolledElements[0]?.textContent).toContain("The client shall list specs.");
  });

  it("ハッシュ無し URL ではスクロールしない", async () => {
    renderAt("/specs/foo/requirements");
    const page = await screen.findByTestId("spec-document-page");
    await waitFor(() => {
      expect(page.textContent).toContain("The client shall list specs.");
    });
    expect(scrolledElements).toHaveLength(0);
  });
});

describe("未知 document パラメータ（URL がビュー位置の真実 → 既知ビューへフォールバック）", () => {
  it("brief/requirements/design/tasks/research 以外の document は /specs/:feature へリダイレクトする", async () => {
    const router = renderAt("/specs/foo/bogus");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo");
    });
    expect(await screen.findByTestId("overview-stub")).toBeTruthy();
    expect(screen.queryByTestId("spec-document-page")).toBeNull();
  });
});

describe("不在成果物（Requirement 1.3 パターン: 不在はエラーではない）", () => {
  it("成果物が null のとき「未作成」を非エラー表示する（role=alert を出さない）", async () => {
    renderAt("/specs/empty/brief");
    const missing = await screen.findByTestId("document-missing");
    expect(missing.textContent).toContain("未作成");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("読込・失敗状態（Requirement 1.5 パターン）", () => {
  it("読込中は LoadingSkeleton を表示する", () => {
    renderAt("/specs/foo/brief");
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });

  it("取得失敗時は ErrorPanel にエラーコード・メッセージ・再試行を表示する", async () => {
    renderAt("/specs/unknown/brief");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("SPEC_NOT_FOUND");
    expect(alert.textContent).toContain("スペックが見つかりません: unknown");
    expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
  });
});
