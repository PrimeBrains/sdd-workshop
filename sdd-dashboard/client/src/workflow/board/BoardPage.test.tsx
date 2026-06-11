/**
 * BoardPage の結合テスト（tasks.md 3.2 / Requirements 1.1, 1.6, 1.7, 1.8, 9.6）。
 *
 * - app セクションが app 名昇順・「未分類」末尾で並ぶ（1.6, 1.8）。
 * - 各 AppSectionHeader が厳密なサマリーカウントを表示する（1.7）。
 * - 各セクションに当該 app のスペックレーン（SpecPipelineNode）が漏れなく描画される（1.1）。
 * - 取得失敗時は ErrorPanel + 再試行で回復する（9.6）。
 *
 * ReactFlow は jsdom に無い ResizeObserver を要求するため、本ファイル限定の最小スタブを注入する
 * （共有 src/test/setup.ts は変更しない）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SpecSummary } from "@contracts/spec";

import { BoardPage } from "./BoardPage";

/** ReactFlow が要求する ResizeObserver の最小スタブ（jsdom には存在しない）。 */
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

/** 承認状態を任意に設定できる SpecSummary ファクトリ。 */
function makeSpec(overrides: Partial<SpecSummary> & { feature: string }): SpecSummary {
  return {
    app: "sdd-dashboard",
    phase: "design",
    language: "ja",
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: false },
      tasks: { generated: false, approved: false },
    },
    readyForImplementation: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
    artifacts: {
      brief: false,
      requirements: true,
      design: true,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
    ...overrides,
  };
}

// 混在: app=zebra-app(1), app=alpha-app(2: 1 ready, 1 impl-complete), app=null(1)。
const specsFixture: SpecSummary[] = [
  makeSpec({ feature: "zebra-spec", app: "zebra-app" }),
  makeSpec({ feature: "alpha-spec-ready", app: "alpha-app", readyForImplementation: true }),
  makeSpec({
    feature: "alpha-spec-done",
    app: "alpha-app",
    phase: "implementation-complete",
    readyForImplementation: true,
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    },
  }),
  makeSpec({ feature: "orphan-spec", app: null }),
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** retry: false で失敗を即座に error へ surfacing する（再試行テストの決定性のため）。 */
function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderBoard(client: QueryClient = makeClient()): void {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BoardPage: app セクション分割と並び（1.6, 1.8）", () => {
  it("app 名昇順・「未分類」末尾でセクションが並ぶ", async () => {
    server.use(http.get("/api/specs", () => HttpResponse.json(specsFixture)));
    renderBoard();

    await screen.findByTestId("board-section-alpha-app");

    const sections = screen.getAllByTestId(/^board-section-/);
    // data-app 属性で並び順を厳密に検証（null は空文字列 → 末尾）。
    const order = sections.map((s) => s.getAttribute("data-app"));
    expect(order).toEqual(["alpha-app", "zebra-app", ""]);
  });
});

describe("BoardPage: app セクションのサマリー（1.7）", () => {
  it("各セクションが厳密なサマリーカウントを表示する", async () => {
    server.use(http.get("/api/specs", () => HttpResponse.json(specsFixture)));
    renderBoard();

    const alpha = await screen.findByTestId("board-section-alpha-app");
    expect(within(alpha).getByTestId("app-section-spec-count").textContent).toBe("2");
    expect(within(alpha).getByTestId("app-section-ready-count").textContent).toBe("2");
    expect(within(alpha).getByTestId("app-section-impl-complete-count").textContent).toBe("1");

    const zebra = screen.getByTestId("board-section-zebra-app");
    expect(within(zebra).getByTestId("app-section-spec-count").textContent).toBe("1");
    expect(within(zebra).getByTestId("app-section-ready-count").textContent).toBe("0");
    expect(within(zebra).getByTestId("app-section-impl-complete-count").textContent).toBe("0");

    const orphan = screen.getByTestId("board-section-未分類");
    expect(within(orphan).getByTestId("app-section-name").textContent).toBe("未分類");
    expect(within(orphan).getByTestId("app-section-spec-count").textContent).toBe("1");
  });
});

describe("BoardPage: 全スペックレーンの描画（1.1）", () => {
  it("各 app の全スペックレーンが当該セクション内に描画される", async () => {
    server.use(http.get("/api/specs", () => HttpResponse.json(specsFixture)));
    renderBoard();

    const alpha = await screen.findByTestId("board-section-alpha-app");
    expect(within(alpha).getByTestId("spec-lane-alpha-spec-ready")).toBeTruthy();
    expect(within(alpha).getByTestId("spec-lane-alpha-spec-done")).toBeTruthy();

    const zebra = screen.getByTestId("board-section-zebra-app");
    expect(within(zebra).getByTestId("spec-lane-zebra-spec")).toBeTruthy();

    const orphan = screen.getByTestId("board-section-未分類");
    expect(within(orphan).getByTestId("spec-lane-orphan-spec")).toBeTruthy();

    // 全 4 レーンが漏れなく存在する（偽 pass 防止: 件数も厳密）。
    expect(screen.getAllByTestId(/^spec-lane-(?!link|ready|diagnostic)/)).toHaveLength(4);
  });
});

describe("BoardPage: 取得失敗時の ErrorPanel + 再試行（9.6）", () => {
  it("500 → ErrorPanel を表示し、再試行で成功データが描画される", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    server.use(
      http.get("/api/specs", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "サーバエラー" } },
            { status: 500 },
          );
        }
        return HttpResponse.json(specsFixture);
      }),
    );
    renderBoard();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "再試行" }));

    await waitFor(() => expect(screen.getByTestId("board-section-alpha-app")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
