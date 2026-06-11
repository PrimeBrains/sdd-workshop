/**
 * AppShell のテスト（tasks.md 1.3 / design.md「AppShell + Router + SpecActionSlot」）。
 *
 * - ヘッダにリポジトリ名（GET /api/repo の name）を厳密値で表示する
 * - スペックサイドバーに GET /api/specs の feature 名を NavLink として厳密値で列挙する
 * - 読込失敗は非致命的に扱う（シェル自体は描画され続ける）
 * - 書込操作 UI（button 等）が成功状態のシェルに存在しない（Requirement 8.1）
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "@contracts/api";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { routes } from "@/app/router";

/**
 * フェイク EventSource: jsdom には EventSource が無いため、AppShell が常駐させる
 * SseInvalidationBridge（useChangeEvents）が `new EventSource` でクラッシュしないよう
 * グローバルへ差し替える。9.2 の接続状態シナリオ（onerror→banner→onopen）を駆動する。
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset() {
    FakeEventSource.instances = [];
  }
  url: string;
  closeCalls = 0;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {
    this.closeCalls += 1;
  }
  emitError(): void {
    this.onerror?.(new Event("error"));
  }
  emitOpen(): void {
    this.onopen?.(new Event("open"));
  }
}

let restoreEventSource: (() => void) | undefined;
beforeEach(() => {
  FakeEventSource.reset();
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

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function mockSuccess() {
  server.use(
    http.get("/api/repo", () => HttpResponse.json(repoFixture)),
    http.get("/api/specs", () =>
      HttpResponse.json([makeSpecSummary("sdd-review-ui"), makeSpecSummary("sdd-core")]),
    ),
    // SpecDocumentPage（3.2 で実装済み）がコンテンツ領域で取得する詳細の最小フィクスチャ
    http.get("/api/specs/:feature", ({ params }) =>
      HttpResponse.json({
        summary: makeSpecSummary(String(params.feature)),
        brief: null,
        requirements: { requirements: [], otherBlocks: [] },
        design: null,
        tasks: null,
        research: null,
        validations: [],
      } satisfies SpecDetail),
    ),
  );
}

function renderShell(initialEntry = "/specs", queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("AppShell", () => {
  it("ヘッダに GET /api/repo のリポジトリ名を厳密値で表示する", async () => {
    mockSuccess();
    renderShell();
    const repoName = await screen.findByTestId("repo-name");
    expect(repoName.textContent).toBe("sdd-workshop");
  });

  it("サイドバーに GET /api/specs の feature 名を NavLink として厳密値で列挙する", async () => {
    mockSuccess();
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "スペック一覧" });
    const links = await within(nav).findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["sdd-review-ui", "sdd-core"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/specs/sdd-review-ui",
      "/specs/sdd-core",
    ]);
  });

  it("リポジトリ情報の取得失敗は非致命的（シェルとコンテンツは描画され続ける）", async () => {
    server.use(
      http.get("/api/repo", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
      http.get("/api/specs", () => HttpResponse.json([makeSpecSummary("sdd-review-ui")])),
    );
    renderShell();
    // コンテンツ（/specs プレースホルダ）とサイドバーは生きている
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "sdd-review-ui" })).toBeTruthy();
  });

  it("スペック一覧の取得失敗はサイドバー内のエラー表示に留まる（シェルは描画され続ける）", async () => {
    server.use(
      http.get("/api/repo", () => HttpResponse.json(repoFixture)),
      http.get("/api/specs", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
    );
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "スペック一覧" });
    expect(await within(nav).findByRole("alert")).toBeTruthy();
    expect(await screen.findByTestId("spec-list-page")).toBeTruthy();
  });

  it("成功状態のシェルで review-ui 自身は書込 UI（button）を持たない（Requirement 8.1: workflow-ui の SpecActionSlot 以外に承認/手戻りボタンなし）", async () => {
    mockSuccess();
    renderShell("/specs/sdd-review-ui/requirements");
    await screen.findByTestId("spec-document-page");
    await screen.findByTestId("repo-name");
    await screen.findByRole("link", { name: "sdd-core" });
    // ドキュメント詳細の読込完了（成功状態）まで待ってから全体を検査する
    await waitFor(() => {
      expect(screen.queryByTestId("loading-skeleton")).toBeNull();
    });
    // review-ui のシェル本体（サイドバー・ヘッダ・本文）には書込 UI を一切置かない（8.1）。
    // button が存在しうるのは workflow-ui が所有する拡張点 SpecActionSlot の内側のみ。
    const slot = screen.queryByTestId("spec-action-slot");
    for (const button of screen.queryAllByRole("button")) {
      expect(slot).not.toBeNull();
      expect(slot?.contains(button)).toBe(true);
    }
  });

  // --- 9.2: ConnectionBanner 配線 + SseInvalidationBridge 常駐（Requirements 7.3） ---

  it("9.2: シェル常駐の SseInvalidationBridge が /api/events へ接続する（ブリッジ active）", async () => {
    mockSuccess();
    renderShell();
    await screen.findByTestId("repo-name");
    // useChangeEvents が AppShell で 1 度だけ EventSource を張る
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe("/api/events");
  });

  it("9.2 完了条件: 切断（onerror）で ConnectionBanner が表示され、再接続（onopen）で消滅する", async () => {
    mockSuccess();
    renderShell();
    await screen.findByTestId("repo-name");
    const es = FakeEventSource.instances[0];
    if (es === undefined) throw new Error("EventSource not created");

    // 接続中: バナーなし
    expect(screen.queryByTestId("connection-banner")).toBeNull();

    // 切断: 「再接続中」バナーが表示される
    act(() => {
      es.emitError();
    });
    const banner = await screen.findByTestId("connection-banner");
    expect(banner.textContent).toBe("再接続中…");

    // 再接続成功: バナーが消滅する
    act(() => {
      es.emitOpen();
    });
    await waitFor(() => {
      expect(screen.queryByTestId("connection-banner")).toBeNull();
    });
  });

  it("9.2: 再接続復帰（onopen）で表示中クエリが全キー invalidate により再取得される（7.3 取りこぼし回復）", async () => {
    // repo 名を再接続後に差し替え、全キー invalidate による再取得（active クエリ）を観測する
    let repoName = "before";
    server.use(
      http.get("/api/repo", () =>
        HttpResponse.json({ repoRoot: "/r", name: repoName } satisfies RepoInfo),
      ),
      http.get("/api/specs", () => HttpResponse.json([makeSpecSummary("sdd-review-ui")])),
    );
    // staleTime 0 にして invalidate→再取得が確実に走る QueryClient
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    renderShell("/specs", client);

    await waitFor(() => expect(screen.getByTestId("repo-name").textContent).toBe("before"));

    const es = FakeEventSource.instances[0];
    if (es === undefined) throw new Error("EventSource not created");

    repoName = "after"; // 次回再取得で更新される
    act(() => {
      es.emitError();
    });
    await act(async () => {
      es.emitOpen();
      await Promise.resolve();
    });

    // onopen の全キー invalidate（refetchType:'active'）で active な repo クエリが再取得される
    await waitFor(() => expect(screen.getByTestId("repo-name").textContent).toBe("after"));
  });

  it("7.2: 連続する spec change（再取得）を跨いでドキュメントビューアが remount されず選択が維持される", async () => {
    mockSuccess();
    renderShell("/specs/sdd-review-ui/requirements");
    const heading = await screen.findByTestId("spec-document-heading");
    expect(heading.textContent).toBe("sdd-review-ui/requirements");

    // remount を検知するためのマーカー: DOM ノードの参照同一性。remount すると別ノードになる。
    const before = screen.getByTestId("spec-document-page");

    // 連続する変更イベント（再取得）を 2 回発火 → key（feature+document）が安定なら同一インスタンス維持
    const es = FakeEventSource.instances[0];
    if (es === undefined) throw new Error("EventSource not created");
    await act(async () => {
      es.emitOpen();
      await Promise.resolve();
      es.emitOpen();
      await Promise.resolve();
    });

    const after = screen.getByTestId("spec-document-page");
    // 同一 DOM ノード（remount していない）= feature+document の安定キーで選択・ドキュメントが維持
    expect(after).toBe(before);
    expect(screen.getByTestId("spec-document-heading").textContent).toBe("sdd-review-ui/requirements");
  });
});
