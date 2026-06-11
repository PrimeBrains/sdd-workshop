/**
 * 対応箇所ハイライト同期の結合テスト
 * （tasks.md 6.2 完了条件 / Requirements 4.3, 4.4 / design.md「ComparePage + useCorrespondence」・
 * Testing Strategy Unit #6）。
 *
 * 完了条件:
 * - 左ペイン = requirements / 右ペイン = design。左で要件カードを選択すると、右ペインの
 *   対応 design セクション「のみ」がハイライトされ、先頭の対応要素が画面内へスクロールされる。
 *   グラフに対応エッジを持たない design セクションはハイライトされない（不在をアサート）。
 * - グラフに存在しない要素（エッジを持たない要件）を選択しても何も光らない（4.3）。
 * - 逆方向: 右ペインで design セクションを選択すると、左ペインの対応要件がハイライトされる。
 * - 4.4: ペイン内 RefChip が選択ハイライトと併存しても描画・クリック可能（壊れない）。
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
import type { TraceGraph } from "@contracts/trace";
import { ComparePage } from "@/features/compare/ComparePage";
import { CORRESPONDENCE_HIGHLIGHT_CLASS } from "@/features/compare/useCorrespondence";

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

/**
 * フィクスチャ:
 * - 要件 1 / 要件 2（要件 2 はエッジを持たない = グラフにない孤立要素の代理）
 * - design セクション「ComponentAlpha」（要件 1 の対応）/「ComponentBeta」（対応なし）
 */
const detail: SpecDetail = {
  summary: makeSummary("foo"),
  brief: null,
  research: null,
  requirements: {
    requirements: [
      {
        kind: "structured",
        position: pos(5, 12, 100, 300),
        id: "1",
        title: "要件1タイトル",
        objective: "要件1目的",
        criteria: [
          {
            kind: "structured",
            position: pos(8, 9, 150, 220),
            id: "1.1",
            text: "The client shall list specs.",
            translationJa: "要件1AC和訳",
          },
        ],
      },
      {
        kind: "structured",
        position: pos(13, 20, 320, 500),
        id: "2",
        title: "要件2タイトル",
        objective: "要件2目的",
        criteria: [],
      },
    ],
    otherBlocks: [],
  },
  design: {
    sections: [
      { title: "ComponentAlpha", depth: 2, position: pos(1, 5, 0, 100), children: [] },
      { title: "ComponentBeta", depth: 2, position: pos(6, 10, 110, 200), children: [] },
    ],
    traceability: [
      {
        kind: "structured",
        position: pos(12, 12, 210, 260),
        refs: [{ kind: "id", id: "1.1", raw: "1.1" }],
        summary: "トレーサ概要",
        components: "ComponentAlpha",
        interfaces: "useX",
        flows: "—",
      },
    ],
    componentRequirements: [],
  },
  tasks: { tasks: [], otherBlocks: [] },
  validations: [],
};

/** 要件 1 → design "ComponentAlpha" のエッジのみ。要件 2・ComponentBeta はエッジなし。 */
const graph: TraceGraph = {
  feature: "foo",
  nodes: {
    requirements: [
      { type: "requirement", id: "1" },
      { type: "requirement", id: "2" },
    ],
    designElements: [
      { type: "design", name: "ComponentAlpha" },
      { type: "design", name: "ComponentBeta" },
    ],
    tasks: [],
  },
  edges: [
    {
      from: { type: "requirement", id: "1" },
      to: { type: "design", name: "ComponentAlpha" },
      source: "design-table",
      legacyExpanded: false,
    },
  ],
  diagnostics: [],
};

const server = setupServer(
  http.get("/api/specs/:feature/trace", () => HttpResponse.json(graph)),
  http.get("/api/specs/:feature", () => HttpResponse.json(detail)),
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

const HL = `.${CORRESPONDENCE_HIGHLIGHT_CLASS}`;

describe("完了条件: 要件カード選択 → 右 design ペインの対応セクションのみハイライト（4.3）", () => {
  it("左で要件1を選択すると右の ComponentAlpha のみがハイライトされ、非対応 ComponentBeta は光らない", async () => {
    const scrolledTargets: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTargets.push(this);
    };

    renderAt("/specs/foo/compare?left=requirements&right=design");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(leftPane).getByText("Requirement 1: 要件1タイトル")).toBeTruthy();
    });

    // 右ペインの design 見出しアンカー（design-<slug>）
    const alpha = rightPane.querySelector("#design-componentalpha");
    const beta = rightPane.querySelector("#design-componentbeta");
    expect(alpha).not.toBeNull();
    expect(beta).not.toBeNull();
    // 選択前はどちらもハイライトされていない（偽 pass 防止の境界アサート）
    expect(rightPane.querySelectorAll(HL).length).toBe(0);

    // 左ペインの要件1カードをクリックして選択する
    const reqCard1 = leftPane.querySelector("#req-1");
    expect(reqCard1).not.toBeNull();
    fireEvent.click(reqCard1 as Element);

    // 右ペイン: ComponentAlpha のみがハイライト、ComponentBeta は不在（グラフ由来のみ）
    await waitFor(() => {
      expect((alpha as Element).classList.contains(CORRESPONDENCE_HIGHLIGHT_CLASS)).toBe(true);
    });
    expect((beta as Element).classList.contains(CORRESPONDENCE_HIGHLIGHT_CLASS)).toBe(false);
    // ハイライト要素はちょうど 1 つ（右ペイン内）
    expect(rightPane.querySelectorAll(HL).length).toBe(1);
    // 左ペイン（選択元）はハイライトされない
    expect(leftPane.querySelectorAll(HL).length).toBe(0);
    // 先頭の対応要素が画面内へスクロールされた
    expect(scrolledTargets).toContain(alpha);
  });
});

describe("グラフにない要素の選択 → 何も光らない（4.3 完了条件）", () => {
  it("エッジを持たない要件2を選択しても右ペインにハイライトは出ない", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=design");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(leftPane).getByText("Requirement 2: 要件2タイトル")).toBeTruthy();
    });

    const reqCard2 = leftPane.querySelector("#req-2");
    expect(reqCard2).not.toBeNull();
    fireEvent.click(reqCard2 as Element);

    // 対応エッジが無いので何も光らない（独自対応付けをしない）
    await waitFor(() => {
      expect(rightPane.querySelectorAll(HL).length).toBe(0);
    });
  });
});

describe("逆方向: design セクション選択 → 左 requirements ペインの対応要件をハイライト", () => {
  it("右で ComponentAlpha を選択すると左の要件1カードがハイライトされる", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=design");

    const leftPane = await screen.findByTestId("compare-pane-left");
    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(rightPane).getAllByText("ComponentAlpha").length).toBeGreaterThan(0);
    });

    const alphaHeading = rightPane.querySelector("#design-componentalpha");
    expect(alphaHeading).not.toBeNull();
    fireEvent.click(alphaHeading as Element);

    const reqCard1 = leftPane.querySelector("#req-1");
    await waitFor(() => {
      expect((reqCard1 as Element).classList.contains(CORRESPONDENCE_HIGHLIGHT_CLASS)).toBe(true);
    });
    // 左ペインにハイライトはちょうど 1 つ、右ペイン（選択元）には無い
    expect(leftPane.querySelectorAll(HL).length).toBe(1);
    expect(rightPane.querySelectorAll(HL).length).toBe(0);
  });
});

describe("4.4: ペイン内 RefChip が選択ハイライトと併存しても機能する", () => {
  it("design ペインの RefChip が描画・クリック可能で、選択ハイライトが壊さない", async () => {
    renderAt("/specs/foo/compare?left=requirements&right=design");

    const rightPane = await screen.findByTestId("compare-pane-right");
    await waitFor(() => {
      expect(within(rightPane).getByText("トレーサ概要")).toBeTruthy();
    });

    const chips = within(rightPane).getAllByTestId("ref-chip");
    expect(chips.length).toBeGreaterThan(0);

    // 要件1選択でハイライトを発生させた後も RefChip は残り、クリックできる（クラッシュしない）
    const leftPane = screen.getByTestId("compare-pane-left");
    fireEvent.click(leftPane.querySelector("#req-1") as Element);
    await waitFor(() => {
      expect(rightPane.querySelectorAll(HL).length).toBe(1);
    });

    const chipAfter = within(rightPane).getAllByTestId("ref-chip")[0];
    expect(chipAfter).toBeTruthy();
    // クリックしても例外を投げない（4.4: クロスリンクナビが選択と併存する）
    fireEvent.click(chipAfter as Element);
    expect(within(rightPane).getAllByTestId("ref-chip").length).toBeGreaterThan(0);
  });
});
