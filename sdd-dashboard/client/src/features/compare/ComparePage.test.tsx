/**
 * ComparePage のテスト（tasks.md 6.1 / Requirements 4.1, 4.2 /
 * design.md「ComparePage + useCorrespondence」・ルート表 `/specs/:feature/compare`）。
 *
 * - 完了条件: `?left=requirements&right=design` で両文書が左右ペインに並列表示される
 *   （各ペインの内容を `within(pane)` で厳密検証する）
 * - セレクタ切替: 右ペインのセレクタを tasks にすると URL クエリ `right=tasks` が
 *   書き換わり、右ペインに tasks 文書が描画される（URL がビュー位置の真実: 4.2）
 * - リロード復元: `?left=requirements&right=tasks` の直接オープンで同じペイン構成が
 *   復元される（クエリ = 状態。完了条件）
 * - デフォルト: クエリ無しで left=requirements / right=design（design.md 既定）
 * - ペイン内 RefChip が描画される（4.4 の完全対応付けは 6.2。ここでは描画のみ最小確認）
 *
 * 4.x のビューア構造は各ビューアの単体テストが担保するため、本テストは
 * 「どのペインにどの文書が出るか」（ペイン構成と URL 同期）に絞って検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { ComparePage } from "@/features/compare/ComparePage";

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

/** 各文書が固有本文を持つフィクスチャ（どのペインに出たかを厳密に区別できる値） */
const fullDetail: SpecDetail = {
  summary: makeSummary("foo"),
  brief: {
    content: "# Brief Heading\n\nbrief 固有本文",
    sections: [{ title: "Brief Heading", depth: 1, position: pos(1, 3, 0, 30), children: [] }],
  },
  research: {
    content: "# Research Heading\n\nresearch 固有本文",
    sections: [{ title: "Research Heading", depth: 1, position: pos(1, 3, 0, 33), children: [] }],
  },
  requirements: {
    requirements: [
      {
        kind: "structured",
        position: pos(5, 12, 100, 300),
        id: "1",
        title: "要件タイトル固有",
        objective: "要件目的固有",
        criteria: [
          {
            kind: "structured",
            position: pos(8, 9, 150, 220),
            id: "1.1",
            text: "The client shall list specs.",
            translationJa: "要件AC和訳固有",
          },
        ],
      },
    ],
    otherBlocks: [],
  },
  design: {
    sections: [
      { title: "設計セクション固有", depth: 2, position: pos(1, 10, 0, 200), children: [] },
    ],
    traceability: [
      {
        kind: "structured",
        position: pos(12, 12, 210, 260),
        refs: [{ kind: "id", id: "1.1", raw: "1.1" }],
        summary: "トレーサ概要固有",
        components: "SpecListPage",
        interfaces: "useSpecs",
        flows: "—",
      },
    ],
    componentRequirements: [],
    content: "",
  },
  tasks: {
    tasks: [
      {
        id: "1",
        description: "タスク説明固有",
        checked: true,
        parallel: false,
        optional: false,
        details: [],
        requirements: [],
        depends: [],
        boundary: null,
        position: pos(3, 8, 60, 200),
        subtasks: [],
      },
    ],
    otherBlocks: [],
  },
  validations: [],
};

const detailByFeature: Record<string, SpecDetail> = { foo: fullDetail };

const server = setupServer(
  // ペイン内 RefChip（5.3）の対応先解決用に trace グラフも取得する。
  // 空グラフでよい（RefChip は index から素のテキストへグレースフルに退避する）。
  http.get("/api/specs/:feature/trace", ({ params }) =>
    HttpResponse.json({
      feature: String(params.feature),
      nodes: { requirements: [], designElements: [], tasks: [] },
      edges: [],
      diagnostics: [],
    }),
  ),
  http.get("/api/specs/:feature", ({ params }) => {
    const detail = detailByFeature[String(params.feature)];
    if (detail !== undefined) return HttpResponse.json(detail);
    return HttpResponse.json(
      { error: { code: "SPEC_NOT_FOUND", message: `not found: ${String(params.feature)}` } },
      { status: 404 },
    );
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  Element.prototype.scrollIntoView = function (this: Element) {
    /* jsdom に実装が無いため no-op で差し替える */
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
    [{ path: "/specs/:feature/compare", element: <ComparePage /> }],
    { initialEntries: [url] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe("完了条件: 2 ペイン並列表示（Requirement 4.1）", () => {
  it("?left=requirements&right=design で左に requirements・右に design が並列表示される", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=design");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");

    // 左ペイン = requirements（固有本文）。design の固有本文は左に出ない
    await waitFor(() => {
      expect(within(leftPane).getByText("要件AC和訳固有")).toBeTruthy();
    });
    expect(within(leftPane).getByText("The client shall list specs.")).toBeTruthy();
    expect(within(leftPane).queryByText("トレーサ概要固有")).toBeNull();

    // 右ペイン = design（固有本文）。requirements の固有本文は右に出ない
    expect(within(rightPane).getByText("トレーサ概要固有")).toBeTruthy();
    expect(within(rightPane).queryByText("要件AC和訳固有")).toBeNull();
  });
});

describe("デフォルトのペイン構成（design.md 既定）", () => {
  it("クエリ無しで left=requirements / right=design になる", async () => {
    renderAt("/specs/foo/compare");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");

    await waitFor(() => {
      expect(within(leftPane).getByText("要件AC和訳固有")).toBeTruthy();
    });
    expect(within(rightPane).getByText("トレーサ概要固有")).toBeTruthy();
  });
});

describe("セレクタ切替で URL クエリを書き換える（Requirement 4.2: URL がビュー位置の真実）", () => {
  it("右ペインのセレクタを tasks にすると right=tasks へ書き換わり右ペインに tasks が出る", async () => {
    const router = renderAt("/specs/foo/compare?left=requirements&right=design");

    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(rightPane).getByText("トレーサ概要固有")).toBeTruthy();
    });

    const rightSelect = within(rightPane).getByTestId("compare-pane-select");
    fireEvent.change(rightSelect, { target: { value: "tasks" } });

    // URL クエリが書き換わる（ビュー位置の真実）
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get("right")).toBe("tasks");
      expect(params.get("left")).toBe("requirements");
    });

    // 右ペインに tasks 文書が描画される
    const rightPaneAfter = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(rightPaneAfter).getByText("タスク説明固有")).toBeTruthy();
    });
    expect(within(rightPaneAfter).queryByText("トレーサ概要固有")).toBeNull();
  });
});

describe("リロード復元（クエリ = 状態。完了条件）", () => {
  it("?left=requirements&right=tasks の直接オープンで同じペイン構成が復元される", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=tasks");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");

    await waitFor(() => {
      expect(within(leftPane).getByText("要件AC和訳固有")).toBeTruthy();
    });
    expect(within(rightPane).getByText("タスク説明固有")).toBeTruthy();
    expect(within(rightPane).queryByText("トレーサ概要固有")).toBeNull();
  });
});

describe("ペイン内 RefChip の描画（最小確認。完全対応付けは 6.2）", () => {
  it("design ペインの Traceability 行に RefChip が描画される（クラッシュしない）", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=design");

    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(rightPane).getByText("トレーサ概要固有")).toBeTruthy();
    });
    expect(within(rightPane).getAllByTestId("ref-chip").length).toBeGreaterThan(0);
  });
});
