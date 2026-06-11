/**
 * SkillDocPage テスト（tasks.md 6.2 / requirements 6.2, 6.3, 6.6 /
 * design.md「Feature: knowledge → SkillDocPage」）。
 *
 * - 6.2: EN/JA タブ切替で本文テキストが厳密値で切り替わり、URL クエリ ?lang= が更新される
 *   （リロード復元可能）。?lang=ja 直開きで初期表示が JA になることも検証する。
 * - 6.3: ja=null のスキルは JA タブを無効化し、非エラー文言「日本語版は未作成」を表示し、
 *   EN 本文を表示する。?lang=ja 直開きでも EN へフォールバック + 文言表示（エラーにしない）。
 * - 6.6: 詳細ヘッダに origin バッジ（厳密ラベル）を表示する。
 * - 失敗パス: msw 500 → ErrorPanel（厳密 code）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SkillDoc } from "@contracts/resources";
import { SkillDocPage } from "./SkillDocPage";

const EN_BODY = "This is the English skill body XYZ-EN.";
const JA_BODY = "これは日本語のスキル本文 XYZ-JA です。";

function makeDoc(over: Partial<SkillDoc> = {}): SkillDoc {
  return {
    name: "kiro-review",
    en: { content: EN_BODY, sections: [] },
    ja: { content: JA_BODY, sections: [] },
    origin: "cc-sdd",
    ...over,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** /skills/:name を createMemoryRouter で描画し、URL クエリ更新を観測可能にする。 */
function renderAt(url: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/skills/:name", element: <SkillDocPage /> }],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("SkillDocPage タブ切替・本文・URL クエリ（Requirement 6.2）", () => {
  it("デフォルトで EN 本文を表示し、JA タブ押下で JA 本文へ厳密に切り替わり ?lang=ja が付く", async () => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(makeDoc())));
    const router = renderAt("/skills/kiro-review");

    const body = await screen.findByTestId("skill-doc-body");
    // 既定は EN（厳密値）。JA 本文は表示されていない。
    expect(body.textContent).toContain(EN_BODY);
    expect(body.textContent).not.toContain(JA_BODY);

    fireEvent.click(screen.getByRole("tab", { name: "JA" }));

    await waitFor(() =>
      expect(screen.getByTestId("skill-doc-body").textContent).toContain(JA_BODY),
    );
    expect(screen.getByTestId("skill-doc-body").textContent).not.toContain(EN_BODY);
    // URL クエリが更新され、リロード/共有で復元可能。
    expect(router.state.location.search).toBe("?lang=ja");
  });

  it("?lang=ja 直開きで初期表示が JA 本文になる（復元）", async () => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(makeDoc())));
    renderAt("/skills/kiro-review?lang=ja");

    const body = await screen.findByTestId("skill-doc-body");
    expect(body.textContent).toContain(JA_BODY);
    expect(body.textContent).not.toContain(EN_BODY);
  });
});

describe("SkillDocPage ja=null（Requirement 6.3: 非エラー + EN 表示）", () => {
  it("ja=null は JA タブを無効化し『日本語版は未作成』を表示し EN 本文を出す", async () => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(makeDoc({ ja: null }))));
    renderAt("/skills/kiro-review");

    const jaTab = await screen.findByRole("tab", { name: "JA" });
    expect(jaTab.getAttribute("aria-disabled")).toBe("true");

    // 非エラー文言（alert role ではない＝エラー扱いしない）。
    expect(screen.getByText("日本語版は未作成")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    expect(screen.getByTestId("skill-doc-body").textContent).toContain(EN_BODY);
  });

  it("?lang=ja 直開きでも ja=null なら EN へフォールバック + 文言（エラーにしない）", async () => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(makeDoc({ ja: null }))));
    renderAt("/skills/kiro-review?lang=ja");

    const body = await screen.findByTestId("skill-doc-body");
    expect(body.textContent).toContain(EN_BODY);
    expect(body.textContent).not.toContain(JA_BODY);
    expect(screen.getByText("日本語版は未作成")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SkillDocPage 詳細ヘッダ origin バッジ（Requirement 6.6）", () => {
  it.each([
    ["cc-sdd", "cc-sdd 標準"],
    ["custom", "独自スキル"],
    [null, "未分類"],
  ] as const)("origin=%s のヘッダに厳密ラベル %s のバッジを表示する", async (origin, label) => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(makeDoc({ origin }))));
    renderAt("/skills/kiro-review");

    const header = await screen.findByTestId("skill-doc-header");
    expect(within(header).getByTestId("origin-badge").textContent).toBe(label);
  });
});

describe("SkillDocPage 失敗パス（Requirement 9.6）", () => {
  it("500 → ErrorPanel が厳密 code を表示する", async () => {
    server.use(
      http.get("/api/skills/:name", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom" } },
          { status: 500 },
        ),
      ),
    );
    renderAt("/skills/kiro-review");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();
  });
});
