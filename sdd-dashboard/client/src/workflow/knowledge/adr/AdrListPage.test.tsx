/**
 * AdrListPage テスト（tasks.md 6.3 / requirements 7.1, 7.4, 7.5 /
 * design.md「Feature: knowledge → AdrListPage」）。
 *
 * - 7.1: 各 ADR 行が id・title・status（バッジ）・date・specs を厳密値で描画する。
 * - 7.4/7.5: app 混在（null / 破損 frontmatter 含む）フィクスチャを groupByApp で app 名昇順 +
 *   末尾「リポジトリ横断」グループに分け、各グループ内 id 昇順で並べる。順序を厳密検証する。
 * - frontmatter 破損 ADR は省略せず、リポジトリ横断グループに name + 診断インジケータで表示。
 * - 失敗パス: msw 500 → ErrorPanel（厳密 code）+ 再試行で refetch → 成功データ描画。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AdrSummary } from "@contracts/resources";
import { AdrListPage } from "./AdrListPage";

/** frontmatter ヘルパ（規約必須フィールドを埋める）。 */
function fm(over: Partial<AdrSummary["frontmatter"] & object>) {
  return {
    id: 0,
    title: "",
    status: "proposed",
    date: "2026-01-01",
    app: null,
    specs: [] as string[],
    requirements: [] as string[],
    supersedes: null,
    superseded_by: null,
    ...over,
  };
}

/**
 * app 混在 + 順序検証用フィクスチャ。意図的に app 昇順でも id 昇順でもない入力順で並べる。
 * - "sdd-review-ui"（app）: id 2, id 1
 * - "sdd-dashboard"（app）: id 5
 * - null（app）: id 3
 * - 破損 frontmatter（null）: name のみ
 * 期待: グループ順 [sdd-dashboard, sdd-review-ui, リポジトリ横断]、
 *       各グループ内 id 昇順、リポジトリ横断は [id 3, 破損]（id なしは末尾）。
 */
const listFixture: AdrSummary[] = [
  {
    name: "0002-review-second",
    frontmatter: fm({ id: 2, title: "Review second", status: "deprecated", date: "2026-02-02", app: "sdd-review-ui", specs: ["sdd-review-ui"] }),
    diagnostics: [],
  },
  {
    name: "0001-review-first",
    frontmatter: fm({ id: 1, title: "Review first", status: "accepted", date: "2026-01-01", app: "sdd-review-ui", specs: ["sdd-review-ui", "sdd-workflow-ui"] }),
    diagnostics: [],
  },
  {
    name: "0005-dashboard-decision",
    frontmatter: fm({ id: 5, title: "Dashboard decision", status: "proposed", date: "2026-05-05", app: "sdd-dashboard", specs: [] }),
    diagnostics: [],
  },
  {
    name: "0003-cross-cutting",
    frontmatter: fm({ id: 3, title: "Cross cutting", status: "superseded", date: "2026-03-03", app: null, specs: ["sdd-core"] }),
    diagnostics: [],
  },
  {
    name: "9999-broken",
    frontmatter: null,
    diagnostics: [{ kind: "parse-failure", message: "frontmatter 不正", position: null }],
  },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function renderPage() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdrListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdrListPage app グルーピング + グループ内 id 昇順（Requirement 7.4, 7.5）", () => {
  it("app 名昇順 + 末尾リポジトリ横断グループの厳密な順序で描画される", async () => {
    server.use(http.get("/api/adr", () => HttpResponse.json(listFixture)));
    renderPage();

    const groups = await screen.findAllByTestId("adr-app-group");
    const headings = groups.map((g) => within(g).getByRole("heading", { level: 2 }).textContent);
    // app 名昇順（sdd-dashboard < sdd-review-ui）→ 末尾に「リポジトリ横断」（null）。
    expect(headings).toEqual(["sdd-dashboard", "sdd-review-ui", "リポジトリ横断"]);
  });

  it("各グループ内が id 昇順で並び、破損 frontmatter は横断グループ末尾に表示される", async () => {
    server.use(http.get("/api/adr", () => HttpResponse.json(listFixture)));
    renderPage();

    const groups = await screen.findAllByTestId("adr-app-group");
    const hrefsIn = (group: HTMLElement) =>
      within(group).getAllByTestId("adr-list-item").map((el) => el.getAttribute("href"));

    // sdd-dashboard グループ
    expect(hrefsIn(groups[0]!)).toEqual(["/adr/0005-dashboard-decision"]);
    // sdd-review-ui グループ: 入力は id2, id1 の順だが id 昇順で並ぶ
    expect(hrefsIn(groups[1]!)).toEqual(["/adr/0001-review-first", "/adr/0002-review-second"]);
    // リポジトリ横断: id3 → 破損(id なし)末尾
    expect(hrefsIn(groups[2]!)).toEqual(["/adr/0003-cross-cutting", "/adr/9999-broken"]);

    // 破損 ADR は省略されず診断インジケータ付きで横断グループに存在する。
    const broken = within(groups[2]!).getByTestId("adr-item-9999-broken");
    expect(within(broken).getByTestId("adr-item-diagnostic")).toBeTruthy();
  });
});

describe("AdrListPage 行の厳密値表示（Requirement 7.1）", () => {
  it("id・title・status バッジ・date・specs が厳密値で描画される", async () => {
    server.use(http.get("/api/adr", () => HttpResponse.json(listFixture)));
    renderPage();

    const row = await screen.findByTestId("adr-item-0001-review-first");
    expect(within(row).getByTestId("adr-item-id").textContent).toBe("1");
    expect(within(row).getByTestId("adr-item-title").textContent).toBe("Review first");
    expect(within(row).getByTestId("adr-item-date").textContent).toBe("2026-01-01");

    // status はバッジで accepted を表示する。
    const badge = within(row).getByTestId("adr-status-badge");
    expect(badge.textContent).toBe("accepted");

    // 関連 specs（2 件）が厳密に描画される。
    const specs = within(row).getByTestId("adr-item-specs");
    expect(within(specs).getByText("sdd-review-ui")).toBeTruthy();
    expect(within(specs).getByText("sdd-workflow-ui")).toBeTruthy();
  });
});

describe("AdrListPage 失敗パス（Requirement 9.6: code/message + 再試行）", () => {
  it("500 → ErrorPanel が厳密 code を表示し、再試行で refetch して成功データを描画する", async () => {
    let calls = 0;
    server.use(
      http.get("/api/adr", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "boom" } },
            { status: 500 },
          );
        }
        return HttpResponse.json(listFixture);
      }),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "再試行" }));

    await waitFor(() => expect(screen.getAllByTestId("adr-list-item")).toHaveLength(5));
  });

  it("loading 中は LoadingSkeleton を表示する", () => {
    server.use(http.get("/api/adr", () => new Promise(() => {})));
    renderPage();
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});
