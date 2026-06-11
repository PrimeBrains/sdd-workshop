/**
 * MatrixPage の結合テスト（tasks.md 7.1 / 7.2 / Requirements 5.1, 5.2, 5.3, 5.4, 5.5 /
 * design.md「MatrixPage + MatrixGrid + DiagnosticsPanel」・ルート表 `/specs/:feature/matrix`）。
 *
 * 7.1:
 * - `/specs/foo/matrix` で MatrixPage が描画され、TraceIndex 由来のグリッドが現れる（5.1 結合）
 * - loading → LoadingSkeleton、error → ErrorPanel + 再試行（1.5）
 *
 * 7.2:
 * - DiagnosticsPanel が MatrixPage に組み込まれ broken-link / unparsable-ref を raw・発生元・行付きで
 *   一覧する。design-uncovered / task-uncovered はパネルに出ない（行ハイライト駆動）（5.3 / 5.5）。
 * - 完了条件（5.4）: セルクリック → 該当 tasks ビューの対象タスク（`/specs/foo/tasks#task-<id>`）へ
 *   遷移し、着地時にそのタスク要素が scrollIntoView される（matrix → document の結合ハーネス）。
 *
 * 実際のルート登録（router.tsx の matrix ルートが MatrixPage に差し替わっていること）は
 * router.test.tsx 側で検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { Position } from "@contracts/document";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import type { TraceGraph } from "@contracts/trace";
import { SpecDocumentPage } from "@/features/viewer/SpecDocumentPage";
import { MatrixPage } from "./MatrixPage";

const graphFixture: TraceGraph = {
  feature: "foo",
  nodes: {
    requirements: [
      { type: "requirement", id: "1.1" },
      { type: "requirement", id: "1.2" },
      { type: "requirement", id: "2.1" },
    ],
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
  diagnostics: [
    {
      kind: "broken-link",
      ref: "9.9",
      where: { type: "design", name: "TraceIndex" },
      position: { startLine: 12, endLine: 12, startOffset: 0, endOffset: 5 },
    },
    {
      kind: "unparsable-ref",
      raw: "1.2〜(注記)",
      where: { type: "task", id: "5.1" },
      position: { startLine: 30, endLine: 30, startOffset: 0, endOffset: 9 },
    },
    // 行ハイライトを駆動する診断（パネルには出ない）
    { kind: "design-uncovered", requirementId: "1.2" },
    { kind: "task-uncovered", requirementId: "2.1" },
  ],
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
  return router;
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

describe("MatrixPage（7.2 DiagnosticsPanel 組込み + 未カバー行ハイライト: 5.2 / 5.3 / 5.5）", () => {
  it("DiagnosticsPanel が broken-link / unparsable-ref を raw・発生元・行付きで一覧する", async () => {
    server.use(http.get("/api/specs/foo/trace", () => HttpResponse.json(graphFixture)));
    renderMatrix("/specs/foo/matrix");

    const panel = await screen.findByTestId("diagnostics-panel");
    // broken-link（design:TraceIndex / 行 12）
    const broken = within(panel).getByTestId("diagnostic-broken-link-0");
    expect(within(broken).getByTestId("diagnostic-raw").textContent).toBe("9.9");
    expect(within(broken).getByTestId("diagnostic-origin").textContent).toBe("design:TraceIndex");
    expect(within(broken).getByTestId("diagnostic-line").textContent).toBe("12");
    // unparsable-ref（task:5.1 / 行 30）
    const unparsable = within(panel).getByTestId("diagnostic-unparsable-ref-1");
    expect(within(unparsable).getByTestId("diagnostic-raw").textContent).toBe("1.2〜(注記)");
    expect(within(unparsable).getByTestId("diagnostic-origin").textContent).toBe("task:5.1");
    expect(within(unparsable).getByTestId("diagnostic-line").textContent).toBe("30");
  });

  it("design-uncovered / task-uncovered はパネルに出さず、当該要件行をハイライトする", async () => {
    server.use(http.get("/api/specs/foo/trace", () => HttpResponse.json(graphFixture)));
    renderMatrix("/specs/foo/matrix");

    const panel = await screen.findByTestId("diagnostics-panel");
    // パネルの診断行はちょうど link 系 2 件のみ（uncovered 系は出ない）
    expect(within(panel).getAllByTestId(/^diagnostic-(broken-link|unparsable-ref)-/)).toHaveLength(2);
    expect(within(panel).queryByTestId(/^diagnostic-(design|task)-uncovered/)).toBeNull();

    // design-uncovered（1.2）/ task-uncovered（2.1）の行はハイライトされる
    expect(screen.getByTestId("matrix-row-1.2").getAttribute("data-uncovered")).toBe("true");
    expect(screen.getByTestId("matrix-row-2.1").getAttribute("data-uncovered")).toBe("true");
    // 未カバー診断を持たない 1.1 はハイライトされない（再計算しない: 5.5）
    expect(screen.getByTestId("matrix-row-1.1").getAttribute("data-uncovered")).toBe("false");
  });
});

/* ------------------------------------------------------------------------------------------------
 * 完了条件（5.4）: matrix → document の結合ハーネス。
 * セルクリックで tasks ビューの対象タスクへ遷移し、着地時にそのタスク要素が scrollIntoView される。
 * ---------------------------------------------------------------------------------------------- */

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

/** tasks に task 5.1 を含む詳細（着地先のアンカー `task-5.1` が描画される） */
const detailFixture: SpecDetail = {
  summary: makeSummary("foo"),
  brief: null,
  requirements: null,
  design: null,
  research: null,
  tasks: {
    tasks: [
      {
        id: "5.1",
        description: "TraceIndex を実装する",
        checked: false,
        parallel: false,
        optional: false,
        details: [],
        requirements: [{ kind: "id", id: "1.1", raw: "1.1" }],
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

const harnessServer = setupServer(
  http.get("/api/specs/foo/trace", () => HttpResponse.json(graphFixture)),
  http.get("/api/specs/foo", () => HttpResponse.json(detailFixture)),
);

/** scrollIntoView された要素の記録（jsdom に実装が無いため差し替える） */
let scrolledElements: Element[];

describe("MatrixPage 完了条件（5.4 matrix → tasks 遷移 + 着地スクロール）", () => {
  beforeAll(() => harnessServer.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    scrolledElements = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledElements.push(this);
    };
  });
  afterEach(() => {
    cleanup();
    harnessServer.resetHandlers();
  });
  afterAll(() => harnessServer.close());

  /** matrix と document（SpecDocumentPage）を 1 つのメモリルーターに同居させる */
  function renderHarness(url: string) {
    const router = createMemoryRouter(
      [
        { path: "/specs/:feature/matrix", element: <MatrixPage /> },
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

  it("セルクリック → /specs/foo/tasks#task-5.1 へ遷移し、着地で task-5.1 が scrollIntoView される", async () => {
    const router = renderHarness("/specs/foo/matrix");

    // マトリクス描画を待ち、(1.1 × task:5.1) セルをクリックする
    const cell = await screen.findByTestId("matrix-cell-1.1-task:5.1");
    fireEvent.click(cell);

    // 厳密 URL: tasks ビュー + 対象タスクのハッシュ
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/tasks");
    });
    expect(router.state.location.hash).toBe("#task-5.1");

    // 着地: TasksView が描画され、対象タスク要素 task-5.1 が scrollIntoView される
    await screen.findByTestId("tasks-view");
    await waitFor(() => {
      expect(scrolledElements.some((el) => el.id === "task-5.1")).toBe(true);
    });
  });
});
