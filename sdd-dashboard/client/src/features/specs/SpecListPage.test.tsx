/**
 * SpecListPage のテスト（tasks.md 2.1 / Requirement 1.1 / design.md ルート表 `/specs`）。
 *
 * - フィクスチャ 3 スペック（正常 / 成果物欠落 / spec.json 破損）が全件表示され、
 *   feature 名・phase・承認状態・成果物有無バッジが厳密値で一致する
 * - spec.json 破損（diagnostics 非空 + メタデータ null）のスペックも省略されず、
 *   診断バッジ付きで表示される（診断バッジは破損スペックにのみ付く）
 * - 行クリックで `/specs/:feature` へ遷移する（URL がビュー位置の唯一の真実）
 * - 読込中は LoadingSkeleton、失敗時は ErrorPanel + 再試行（Requirement 1.5 の確立済みパターン）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { JSX, ReactNode } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecSummary } from "@contracts/spec";
import { SpecListPage } from "@/features/specs/SpecListPage";

/** 正常スペック（サーバーフィクスチャ fixture-normal と同値） */
const fixtureNormal: SpecSummary = {
  feature: "fixture-normal",
  app: "demo-app",
  phase: "tasks-approved",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: true },
  },
  readyForImplementation: true,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-05T00:00:00Z",
  artifacts: {
    brief: true,
    requirements: true,
    design: true,
    tasks: true,
    research: true,
    validationGap: true,
    validationDesign: true,
    validationImpl: true,
  },
  diagnostics: [],
};

/** 成果物欠落スペック（brief / research / validation 不在、tasks 未承認） */
const fixtureLegacy: SpecSummary = {
  feature: "fixture-legacy",
  app: null,
  phase: "implementation-ready",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: false },
  },
  readyForImplementation: false,
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-02T00:00:00Z",
  artifacts: {
    brief: false,
    requirements: true,
    design: true,
    tasks: true,
    research: false,
    validationGap: false,
    validationDesign: false,
    validationImpl: false,
  },
  diagnostics: [],
};

/** spec.json 破損スペック（メタデータ全 null + parse-failure 診断） */
const fixtureBroken: SpecSummary = {
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
    tasks: true,
    research: false,
    validationGap: false,
    validationDesign: false,
    validationImpl: true,
  },
  diagnostics: [
    { kind: "parse-failure", message: "spec.json の JSON パースに失敗しました", position: null },
  ],
};

const specsFixture: SpecSummary[] = [fixtureNormal, fixtureLegacy, fixtureBroken];

const server = setupServer(http.get("/api/specs", () => HttpResponse.json(specsFixture)));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** 遷移先（/specs/:feature）の検証用スタブ。SpecOverviewPage 実装は 2.2 のスコープ */
function OverviewStub(): JSX.Element {
  const { feature } = useParams();
  return <h1 data-testid="overview-stub">{feature}</h1>;
}

function Providers({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** /specs を初期 URL とするメモリルーターで SpecListPage を描画する */
function renderListPage() {
  const router = createMemoryRouter(
    [
      { path: "/specs", element: <SpecListPage /> },
      { path: "/specs/:feature", element: <OverviewStub /> },
    ],
    { initialEntries: ["/specs"] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe("SpecListPage（Requirement 1.1: スペック一覧）", () => {
  it("フィクスチャ 3 スペックが全件表示される（spec.json 破損も省略されない）", async () => {
    renderListPage();

    expect(await screen.findByTestId("spec-row-fixture-normal")).toBeTruthy();
    expect(screen.getByTestId("spec-row-fixture-legacy")).toBeTruthy();
    expect(screen.getByTestId("spec-row-fixture-broken")).toBeTruthy();
  });

  it("正常スペックの feature 名・phase・承認状態・ready・成果物有無が厳密値で一致する", async () => {
    renderListPage();

    const row = await screen.findByTestId("spec-row-fixture-normal");
    expect(within(row).getByTestId("spec-feature").textContent).toBe("fixture-normal");
    expect(within(row).getByTestId("phase-badge").textContent).toBe("tasks-approved");
    expect(within(row).getByTestId("approval-requirements").getAttribute("data-state")).toBe(
      "approved",
    );
    expect(within(row).getByTestId("approval-design").getAttribute("data-state")).toBe("approved");
    expect(within(row).getByTestId("approval-tasks").getAttribute("data-state")).toBe("approved");
    expect(within(row).getByTestId("ready-badge").getAttribute("data-state")).toBe("ready");
    for (const artifact of [
      "brief",
      "requirements",
      "design",
      "tasks",
      "research",
      "validationGap",
      "validationDesign",
      "validationImpl",
    ]) {
      expect(within(row).getByTestId(`artifact-${artifact}`).getAttribute("data-state")).toBe(
        "available",
      );
    }
    expect(within(row).queryByTestId("diagnostics-badge")).toBeNull();
  });

  it("成果物欠落スペックは欠落成果物が missing、tasks 承認状態が generated、ready が not-ready になる", async () => {
    renderListPage();

    const row = await screen.findByTestId("spec-row-fixture-legacy");
    expect(within(row).getByTestId("spec-feature").textContent).toBe("fixture-legacy");
    expect(within(row).getByTestId("phase-badge").textContent).toBe("implementation-ready");
    expect(within(row).getByTestId("approval-requirements").getAttribute("data-state")).toBe(
      "approved",
    );
    expect(within(row).getByTestId("approval-design").getAttribute("data-state")).toBe("approved");
    expect(within(row).getByTestId("approval-tasks").getAttribute("data-state")).toBe("generated");
    expect(within(row).getByTestId("ready-badge").getAttribute("data-state")).toBe("not-ready");
    expect(within(row).getByTestId("artifact-brief").getAttribute("data-state")).toBe("missing");
    expect(within(row).getByTestId("artifact-requirements").getAttribute("data-state")).toBe(
      "available",
    );
    expect(within(row).getByTestId("artifact-design").getAttribute("data-state")).toBe("available");
    expect(within(row).getByTestId("artifact-tasks").getAttribute("data-state")).toBe("available");
    expect(within(row).getByTestId("artifact-research").getAttribute("data-state")).toBe("missing");
    expect(within(row).getByTestId("artifact-validationGap").getAttribute("data-state")).toBe(
      "missing",
    );
    expect(within(row).getByTestId("artifact-validationDesign").getAttribute("data-state")).toBe(
      "missing",
    );
    expect(within(row).getByTestId("artifact-validationImpl").getAttribute("data-state")).toBe(
      "missing",
    );
    expect(within(row).queryByTestId("diagnostics-badge")).toBeNull();
  });

  it("spec.json 破損スペックは null セーフなフォールバック + 診断バッジ付きで表示される", async () => {
    renderListPage();

    const row = await screen.findByTestId("spec-row-fixture-broken");
    expect(within(row).getByTestId("spec-feature").textContent).toBe("fixture-broken");
    expect(within(row).getByTestId("phase-badge").textContent).toBe("不明");
    expect(within(row).getByTestId("approval-requirements").getAttribute("data-state")).toBe(
      "unknown",
    );
    expect(within(row).getByTestId("approval-design").getAttribute("data-state")).toBe("unknown");
    expect(within(row).getByTestId("approval-tasks").getAttribute("data-state")).toBe("unknown");
    expect(within(row).getByTestId("ready-badge").getAttribute("data-state")).toBe("unknown");
    expect(within(row).getByTestId("artifact-requirements").getAttribute("data-state")).toBe(
      "available",
    );
    expect(within(row).getByTestId("artifact-design").getAttribute("data-state")).toBe("missing");
    expect(within(row).getByTestId("diagnostics-badge").textContent).toBe("診断 1 件");
  });

  it("診断バッジは破損スペックの行にのみ表示される（全行で 1 個）", async () => {
    renderListPage();

    await screen.findByTestId("spec-row-fixture-broken");
    const badges = screen.getAllByTestId("diagnostics-badge");
    expect(badges).toHaveLength(1);
    const brokenRow = screen.getByTestId("spec-row-fixture-broken");
    expect(within(brokenRow).getByTestId("diagnostics-badge")).toBe(badges[0]);
  });
});

describe("SpecListPage（行クリックで /specs/:feature へ遷移）", () => {
  it("行リンクのクリックで /specs/fixture-normal へ遷移し、遷移先が feature=fixture-normal で描画される", async () => {
    const router = renderListPage();

    const row = await screen.findByTestId("spec-row-fixture-normal");
    fireEvent.click(within(row).getByRole("link"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/fixture-normal");
    });
    expect((await screen.findByTestId("overview-stub")).textContent).toBe("fixture-normal");
  });

  it("破損スペックの行も /specs/fixture-broken へ遷移できる", async () => {
    const router = renderListPage();

    const row = await screen.findByTestId("spec-row-fixture-broken");
    fireEvent.click(within(row).getByRole("link"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/fixture-broken");
    });
  });
});

describe("SpecListPage（読込中・エラー表示）", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("読込中は LoadingSkeleton を表示し、取得完了後に消える", async () => {
    renderListPage();

    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
    await screen.findByTestId("spec-row-fixture-normal");
    expect(screen.queryByTestId("loading-skeleton")).toBeNull();
  });

  it("取得失敗時は ErrorPanel（code / message）を表示し、再試行で一覧を復元する（Requirement 1.5 パターン）", async () => {
    server.use(
      http.get(
        "/api/specs",
        () =>
          HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    renderListPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("INTERNAL_ERROR");
    expect(alert.textContent).toContain("想定外のエラーが発生しました");

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByTestId("spec-row-fixture-normal")).toBeTruthy();
  });
});
