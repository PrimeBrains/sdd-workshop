/**
 * SkillListPage テスト（tasks.md 6.2 / requirements 6.1, 6.4, 6.5 /
 * design.md「Feature: knowledge → SkillListPage」）。
 *
 * - 6.4/6.5: origin 混在フィクスチャ（cc-sdd / custom / null）を groupSkillsByOrigin で
 *   「cc-sdd 標準 → 独自スキル → 未分類」の固定順 3 グループに分け、各見出しに件数を付す。
 *   見出しの順序・件数を厳密値で検証し、各スキルが正しいグループ配下に並ぶことを確認する。
 * - 6.1: 各スキルは /skills/:name へのリンクで、EN/JA 有無バッジが hasEn/hasJa を反映する。
 * - 失敗パス: msw 500 → ErrorPanel（厳密 code）+ 再試行で refetch → 成功データ描画。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SkillSummary } from "@contracts/resources";
import { SkillListPage } from "./SkillListPage";

/** cc-sdd 2 件 / custom 1 件 / null 1 件 + 未知 origin 1 件（→ 未分類へ集約）の混在。 */
const listFixture: SkillSummary[] = [
  { name: "kiro-spec-design", hasEn: true, hasJa: true, origin: "cc-sdd" },
  { name: "kiro-review", hasEn: true, hasJa: false, origin: "cc-sdd" },
  { name: "commit", hasEn: true, hasJa: true, origin: "custom" },
  { name: "legacy-skill", hasEn: false, hasJa: true, origin: null },
  { name: "weird-skill", hasEn: true, hasJa: false, origin: "mystery" },
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
        <SkillListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SkillListPage origin グループ + 件数（Requirement 6.4, 6.5）", () => {
  it("固定順 3 グループ見出しが厳密な順序・件数で描画される", async () => {
    server.use(http.get("/api/skills", () => HttpResponse.json(listFixture)));
    renderPage();

    const groups = await screen.findAllByTestId("skill-origin-group");
    // 常に 3 グループ（空でも省略しない）。
    expect(groups).toHaveLength(3);

    // 見出しは固定順（cc-sdd 標準 → 独自スキル → 未分類）。バッジラベル + 件数を厳密検証。
    const headings = groups.map((g) =>
      within(g).getByRole("heading", { level: 2 }).textContent,
    );
    expect(headings).toEqual(["cc-sdd 標準2", "独自スキル1", "未分類2"]);
  });

  it("各スキルが正しい origin グループ配下に並ぶ（未知 origin は未分類へ集約）", async () => {
    server.use(http.get("/api/skills", () => HttpResponse.json(listFixture)));
    renderPage();

    const groups = await screen.findAllByTestId("skill-origin-group");
    expect(groups).toHaveLength(3);

    const hrefsIn = (group: HTMLElement) =>
      within(group).getAllByTestId("skill-list-item").map((el) => el.getAttribute("href"));

    expect(hrefsIn(groups[0]!)).toEqual(["/skills/kiro-spec-design", "/skills/kiro-review"]);
    expect(hrefsIn(groups[1]!)).toEqual(["/skills/commit"]);
    // null + 未知 origin の両方が未分類グループへ（入力順保持）。
    expect(hrefsIn(groups[2]!)).toEqual(["/skills/legacy-skill", "/skills/weird-skill"]);
  });
});

describe("SkillListPage EN/JA 有無バッジ（Requirement 6.1）", () => {
  it("hasEn/hasJa に応じて EN/JA バッジの有無が切り替わる", async () => {
    server.use(http.get("/api/skills", () => HttpResponse.json(listFixture)));
    renderPage();

    // hasEn:true hasJa:true → EN/JA 両方
    const both = await screen.findByTestId("skill-item-kiro-spec-design");
    expect(within(both).queryByTestId("skill-badge-en")).toBeTruthy();
    expect(within(both).queryByTestId("skill-badge-ja")).toBeTruthy();

    // hasEn:true hasJa:false → EN のみ（JA なし）
    const enOnly = screen.getByTestId("skill-item-kiro-review");
    expect(within(enOnly).queryByTestId("skill-badge-en")).toBeTruthy();
    expect(within(enOnly).queryByTestId("skill-badge-ja")).toBeNull();

    // hasEn:false hasJa:true → JA のみ（EN なし）
    const jaOnly = screen.getByTestId("skill-item-legacy-skill");
    expect(within(jaOnly).queryByTestId("skill-badge-en")).toBeNull();
    expect(within(jaOnly).queryByTestId("skill-badge-ja")).toBeTruthy();
  });
});

describe("SkillListPage 失敗パス（Requirement 9.6: code/message + 再試行）", () => {
  it("500 → ErrorPanel が厳密 code を表示し、再試行で refetch して成功データを描画する", async () => {
    let calls = 0;
    server.use(
      http.get("/api/skills", () => {
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

    await waitFor(() =>
      expect(screen.getAllByTestId("skill-list-item")).toHaveLength(5),
    );
  });

  it("loading 中は LoadingSkeleton を表示する", () => {
    server.use(http.get("/api/skills", () => new Promise(() => {})));
    renderPage();
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});
