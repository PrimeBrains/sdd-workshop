/**
 * SpecOverviewPage のテスト（tasks.md 2.2 / Requirements 1.2, 1.3 /
 * design.md ルート表 `/specs/:feature`・Error Handling 表）。
 *
 * - `artifacts` の true 項目のみ該当ドキュメントルートへの Link になり、クリックで遷移する（1.2）
 * - false 項目はディム表示 + 「未作成」の非リンクで、クリックしても遷移もエラーも起きない（1.3）
 * - validation レポート（gap / design / impl）も同じ有無規則で
 *   `/specs/:feature/validation/:type` への導線になる（1.2）
 * - spec.json 診断は非致命の注記として表示され、タブ提示を妨げない
 * - 読込中は LoadingSkeleton、失敗時は ErrorPanel + 再試行、
 *   404 SPEC_NOT_FOUND は ErrorPanel + 一覧へ戻る導線（design.md Error Handling 表）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { JSX, ReactNode } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { SpecOverviewPage } from "@/features/specs/SpecOverviewPage";

/** 成果物の有無が混在するスペック（true: requirements/design/tasks/validationGap、他 false） */
const mixedSummary: SpecSummary = {
  feature: "fixture-mixed",
  app: "demo-app",
  phase: "implementation-ready",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: false },
  },
  readyForImplementation: false,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
  artifacts: {
    brief: false,
    requirements: true,
    design: true,
    tasks: true,
    research: false,
    validationGap: true,
    validationDesign: false,
    validationImpl: false,
  },
  diagnostics: [],
};

const mixedDetail: SpecDetail = {
  summary: mixedSummary,
  brief: null,
  requirements: { requirements: [], otherBlocks: [] },
  design: { sections: [], traceability: [], componentRequirements: [], content: "" },
  tasks: { tasks: [], otherBlocks: [] },
  research: null,
  validations: [
    {
      type: "gap",
      feature: "fixture-mixed",
      date: "2026-06-01",
      decision: null,
      content: "# Gap Validation",
      sections: [],
      diagnostics: [],
    },
  ],
};

/** spec.json 診断付きスペック（メタ null + parse-failure。タブ提示は妨げない） */
const brokenDetail: SpecDetail = {
  summary: {
    feature: "fixture-broken",
    app: null,
    phase: null,
    language: null,
    approvals: null,
    readyForImplementation: null,
    createdAt: null,
    updatedAt: null,
    artifacts: {
      brief: false,
      requirements: true,
      design: false,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [
      { kind: "parse-failure", message: "spec.json の JSON パースに失敗しました", position: null },
    ],
  },
  brief: null,
  requirements: { requirements: [], otherBlocks: [] },
  design: null,
  tasks: null,
  research: null,
  validations: [],
};

const detailByFeature: Record<string, SpecDetail> = {
  "fixture-mixed": mixedDetail,
  "fixture-broken": brokenDetail,
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

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** 一覧へ戻る導線の遷移先スタブ（SpecListPage 実装は 2.1 スコープ） */
function ListStub(): JSX.Element {
  return <h1 data-testid="list-stub">一覧</h1>;
}

/** /specs/:feature/:document の遷移先スタブ（SpecDocumentPage 実装は 3.2 スコープ） */
function DocumentStub(): JSX.Element {
  const { feature, document } = useParams();
  return (
    <h1 data-testid="document-stub">
      {feature}/{document}
    </h1>
  );
}

/** /specs/:feature/validation/:type の遷移先スタブ（ValidationReportPage 実装は 6.x スコープ） */
function ValidationStub(): JSX.Element {
  const { feature, type } = useParams();
  return (
    <h1 data-testid="validation-stub">
      {feature}/validation/{type}
    </h1>
  );
}

function Providers({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** /specs/:feature を初期 URL とするメモリルーターで SpecOverviewPage を描画する */
function renderOverview(initialUrl = "/specs/fixture-mixed") {
  const router = createMemoryRouter(
    [
      { path: "/specs", element: <ListStub /> },
      { path: "/specs/:feature", element: <SpecOverviewPage /> },
      { path: "/specs/:feature/validation/:type", element: <ValidationStub /> },
      { path: "/specs/:feature/:document", element: <DocumentStub /> },
    ],
    { initialEntries: [initialUrl] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe("SpecOverviewPage（Requirement 1.2: 成果物の選択提示）", () => {
  it("存在する成果物（requirements / design / tasks）が該当ドキュメントルートへのリンクとして提示される", async () => {
    renderOverview();

    const requirementsTab = await screen.findByTestId("doc-tab-requirements");
    expect(requirementsTab.getAttribute("data-state")).toBe("available");
    expect(requirementsTab.tagName).toBe("A");
    expect(requirementsTab.getAttribute("href")).toBe("/specs/fixture-mixed/requirements");
    expect(screen.getByTestId("doc-tab-design").getAttribute("href")).toBe(
      "/specs/fixture-mixed/design",
    );
    expect(screen.getByTestId("doc-tab-tasks").getAttribute("href")).toBe(
      "/specs/fixture-mixed/tasks",
    );
  });

  it("存在タブのクリックで /specs/:feature/:document へ遷移する", async () => {
    const router = renderOverview();

    fireEvent.click(await screen.findByTestId("doc-tab-design"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/fixture-mixed/design");
    });
    expect((await screen.findByTestId("document-stub")).textContent).toBe("fixture-mixed/design");
  });

  it("feature 見出しとメタバッジ（phase / approvals / ready）が厳密値で表示される", async () => {
    renderOverview();

    expect((await screen.findByTestId("phase-badge")).textContent).toBe("implementation-ready");
    expect(screen.getByTestId("spec-overview-heading").textContent).toBe("fixture-mixed");
    expect(screen.getByTestId("approval-requirements").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("approval-design").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("approval-tasks").getAttribute("data-state")).toBe("generated");
    expect(screen.getByTestId("ready-badge").getAttribute("data-state")).toBe("not-ready");
  });
});

describe("SpecOverviewPage（Requirement 1.3: 成果物不在の非エラー表示）", () => {
  it("不在の成果物（brief / research）はディム表示 + 「未作成」の非リンクになる", async () => {
    renderOverview();

    const briefTab = await screen.findByTestId("doc-tab-brief");
    expect(briefTab.getAttribute("data-state")).toBe("missing");
    expect(briefTab.tagName).not.toBe("A");
    expect(briefTab.getAttribute("href")).toBeNull();
    expect(briefTab.textContent).toContain("brief");
    expect(briefTab.textContent).toContain("未作成");

    const researchTab = screen.getByTestId("doc-tab-research");
    expect(researchTab.getAttribute("data-state")).toBe("missing");
    expect(researchTab.tagName).not.toBe("A");
    expect(researchTab.textContent).toContain("未作成");
  });

  it("不在タブのクリックは遷移もエラーも起こさない（URL 不変・画面維持）", async () => {
    const router = renderOverview();

    fireEvent.click(await screen.findByTestId("doc-tab-brief"));
    fireEvent.click(screen.getByTestId("doc-tab-research"));

    expect(router.state.location.pathname).toBe("/specs/fixture-mixed");
    expect(screen.getByTestId("spec-overview-page")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SpecOverviewPage（validation レポート一覧の組み込み、Requirement 6.1 / 6.4）", () => {
  it("概要画面に ValidationList が組み込まれ、存在する validation（gap）は type/date 付きでリンク、不在（design / impl）は未生成になる", async () => {
    renderOverview();

    const gapItem = await screen.findByTestId("validation-item-gap");
    expect(gapItem.getAttribute("data-state")).toBe("available");
    expect(gapItem.tagName).toBe("A");
    expect(gapItem.getAttribute("href")).toBe("/specs/fixture-mixed/validation/gap");
    expect(screen.getByTestId("validation-date-gap").textContent).toBe("2026-06-01");

    const designItem = screen.getByTestId("validation-item-design");
    expect(designItem.getAttribute("data-state")).toBe("missing");
    expect(designItem.tagName).not.toBe("A");
    expect(designItem.textContent).toContain("未生成");

    const implItem = screen.getByTestId("validation-item-impl");
    expect(implItem.getAttribute("data-state")).toBe("missing");
    expect(implItem.textContent).toContain("未生成");
  });

  it("存在する validation 行のクリックで /specs/:feature/validation/gap へ遷移する", async () => {
    const router = renderOverview();

    fireEvent.click(await screen.findByTestId("validation-item-gap"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/fixture-mixed/validation/gap");
    });
    expect((await screen.findByTestId("validation-stub")).textContent).toBe(
      "fixture-mixed/validation/gap",
    );
  });

  it("不在 validation 行のクリックは遷移もエラーも起こさない", async () => {
    const router = renderOverview();

    await screen.findByTestId("validation-item-design");
    fireEvent.click(screen.getByTestId("validation-item-design"));

    expect(router.state.location.pathname).toBe("/specs/fixture-mixed");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SpecOverviewPage（spec.json 診断の非致命表示）", () => {
  it("診断付きスペックは診断メッセージを表示しつつ、成果物タブの提示を続ける", async () => {
    renderOverview("/specs/fixture-broken");

    const diagnostics = await screen.findByTestId("spec-diagnostics");
    expect(diagnostics.textContent).toContain("spec.json の JSON パースに失敗しました");
    expect(screen.getByTestId("doc-tab-requirements").getAttribute("data-state")).toBe("available");
    expect(screen.getByTestId("doc-tab-design").getAttribute("data-state")).toBe("missing");
  });

  it("診断なしスペックでは診断表示が出ない", async () => {
    renderOverview();

    await screen.findByTestId("doc-tab-requirements");
    expect(screen.queryByTestId("spec-diagnostics")).toBeNull();
  });
});

describe("SpecOverviewPage（読込中・エラー表示、Requirement 1.5 パターン + SPEC_NOT_FOUND）", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("読込中は LoadingSkeleton を表示し、取得完了後に消える", async () => {
    renderOverview();

    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
    await screen.findByTestId("doc-tab-requirements");
    expect(screen.queryByTestId("loading-skeleton")).toBeNull();
  });

  it("500 失敗時は ErrorPanel（code / message）を表示し、再試行で概要を復元する（戻る導線は出ない）", async () => {
    server.use(
      http.get(
        "/api/specs/:feature",
        () =>
          HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderOverview();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("INTERNAL_ERROR");
    expect(alert.textContent).toContain("想定外のエラーが発生しました");
    expect(screen.queryByTestId("back-to-list")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByTestId("doc-tab-requirements")).toBeTruthy();
  });

  it("404 SPEC_NOT_FOUND は ErrorPanel + 一覧へ戻る導線になり、クリックで /specs へ遷移する", async () => {
    const router = renderOverview("/specs/missing-spec");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("SPEC_NOT_FOUND");
    expect(alert.textContent).toContain("スペックが見つかりません: missing-spec");

    const backLink = screen.getByTestId("back-to-list");
    expect(backLink.textContent).toBe("一覧へ戻る");
    fireEvent.click(backLink);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs");
    });
    expect(await screen.findByTestId("list-stub")).toBeTruthy();
  });
});
