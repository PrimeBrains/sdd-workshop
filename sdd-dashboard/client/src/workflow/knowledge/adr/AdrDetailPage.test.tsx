/**
 * AdrDetailPage テスト（tasks.md 6.3 / requirements 7.2, 7.3 /
 * design.md「Feature: knowledge → AdrDetailPage」）。
 *
 * - 7.2: frontmatter メタ（id/title/status/date/app/specs/requirements/supersedes/superseded_by）
 *   をヘッダ表示し、本文（Context/Decision/Consequences/Alternatives）を MarkdownDoc で散文描画。
 *   見出しがすべて描画されることを厳密に検証する。
 * - 7.3: frontmatter null（パース不正）の ADR は省略せず、RawBlockView で raw content を描画し、
 *   診断を非エラー表示する（ErrorPanel / role=alert ではない）ことを検証する。
 * - ルートは /adr/:id（:id = AdrSummary.name）。useParams 由来 id で useAdrDoc を呼ぶ。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AdrDoc } from "@contracts/resources";
import { AdrDetailPage } from "./AdrDetailPage";

const ADR_BODY = [
  "## Context",
  "意思決定の背景。",
  "## Decision",
  "採用した決定。",
  "## Consequences",
  "決定の帰結。",
  "## Alternatives",
  "検討した代替案。",
].join("\n\n");

const validDoc: AdrDoc = {
  name: "0001-sample-decision",
  frontmatter: {
    id: 1,
    title: "Sample decision",
    status: "accepted",
    date: "2026-06-01",
    app: "sdd-dashboard",
    specs: ["sdd-review-ui", "sdd-workflow-ui"],
    requirements: ["sdd-review-ui/2.1"],
    supersedes: null,
    superseded_by: "0009-newer",
  },
  content: ADR_BODY,
  sections: [],
  diagnostics: [],
};

const brokenDoc: AdrDoc = {
  name: "9999-broken",
  frontmatter: null,
  content: "## Raw Heading\n壊れた frontmatter の生本文。",
  sections: [],
  diagnostics: [{ kind: "parse-failure", message: "YAML frontmatter が不正です", position: null }],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function renderAt(id: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/adr/${id}`]}>
        <Routes>
          <Route path="/adr/:id" element={<AdrDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdrDetailPage 本文 + メタ（Requirement 7.2）", () => {
  it("frontmatter メタを厳密値で表示し、本文 4 セクションすべてを描画する", async () => {
    server.use(http.get("/api/adr/:id", () => HttpResponse.json(validDoc)));
    renderAt("0001-sample-decision");

    const header = await screen.findByTestId("adr-detail-header");
    expect(within(header).getByTestId("adr-detail-id").textContent).toBe("1");
    expect(within(header).getByTestId("adr-detail-title").textContent).toBe("Sample decision");
    expect(within(header).getByTestId("adr-status-badge").textContent).toBe("accepted");
    expect(within(header).getByTestId("adr-detail-date").textContent).toBe("2026-06-01");
    expect(within(header).getByTestId("adr-detail-app").textContent).toBe("sdd-dashboard");
    expect(within(header).getByTestId("adr-detail-specs").textContent).toBe(
      "sdd-review-ui, sdd-workflow-ui",
    );
    expect(within(header).getByTestId("adr-detail-requirements").textContent).toBe(
      "sdd-review-ui/2.1",
    );
    expect(within(header).getByTestId("adr-detail-supersedes").textContent).toBe("—");
    expect(within(header).getByTestId("adr-detail-superseded-by").textContent).toBe("0009-newer");

    // 本文（MarkdownDoc 散文描画）の 4 セクション見出しがすべて描画される。
    const body = screen.getByTestId("adr-detail-body");
    for (const heading of ["Context", "Decision", "Consequences", "Alternatives"]) {
      expect(within(body).getByRole("heading", { name: heading })).toBeTruthy();
    }
  });
});

describe("AdrDetailPage frontmatter 不正フォールバック（Requirement 7.3）", () => {
  it("frontmatter null は省略せず raw content + 診断を非エラー表示する", async () => {
    server.use(http.get("/api/adr/:id", () => HttpResponse.json(brokenDoc)));
    renderAt("9999-broken");

    const page = await screen.findByTestId("adr-detail-page");
    // エラー表示（ErrorPanel / role=alert）ではない。
    expect(screen.queryByRole("alert")).toBeNull();

    // 診断が表示される。
    const diagnostics = within(page).getByTestId("adr-diagnostics");
    expect(within(diagnostics).getByText(/YAML frontmatter が不正です/)).toBeTruthy();

    // raw content が描画される（RawBlockView 経由で生本文の見出しが出る）。
    expect(within(page).getByRole("heading", { name: "Raw Heading" })).toBeTruthy();
    expect(within(page).getByText(/壊れた frontmatter の生本文。/)).toBeTruthy();
  });
});

describe("AdrDetailPage 失敗パス（Requirement 9.6）", () => {
  it("500 → ErrorPanel が厳密 code を表示する", async () => {
    server.use(
      http.get("/api/adr/:id", () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "boom" } }, { status: 500 }),
      ),
    );
    renderAt("0001-sample-decision");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();
  });

  it("loading 中は LoadingSkeleton を表示する", () => {
    server.use(http.get("/api/adr/:id", () => new Promise(() => {})));
    renderAt("0001-sample-decision");
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});
