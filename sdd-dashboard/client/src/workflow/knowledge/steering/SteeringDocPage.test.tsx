/**
 * SteeringDocPage テスト（tasks.md 6.1 / requirements 5.2 / design.md「Feature: knowledge → SteeringDocPage」）。
 *
 * - 5.2（無欠落の証跡）: useSteeringDoc の content を MarkdownDoc で全文描画する。
 *   元 content が持つ複数のセクション見出し（厳密文字列）が描画テキストに ALL 含まれることを検証する。
 *   1 つでも欠落すれば fail する（偽 pass 防止）。
 * - 失敗パス: msw 500 → ErrorPanel（厳密 code）+ 再試行。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SteeringDoc } from "@contracts/resources";
import { SteeringDocPage } from "./SteeringDocPage";

/** 元文書が持つ全セクション見出し（無欠落の出典固定） */
const SOURCE_HEADINGS = [
  "Product Overview",
  "Core Features",
  "Target Users",
  "Non Goals",
];

const docFixture: SteeringDoc = {
  name: "product",
  content: [
    `# ${SOURCE_HEADINGS[0]}`,
    "プロダクトの概要。",
    `## ${SOURCE_HEADINGS[1]}`,
    "主要機能の説明。",
    `## ${SOURCE_HEADINGS[2]}`,
    "対象ユーザーの説明。",
    `### ${SOURCE_HEADINGS[3]}`,
    "やらないことの説明。",
  ].join("\n\n"),
  sections: [],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** /steering/:name でマウントし、useParams 経由で name が渡る経路を再現する（retry: false） */
function renderAt(name: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/steering/${name}`]}>
        <Routes>
          <Route path="/steering/:name" element={<SteeringDocPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SteeringDocPage 本文描画（Requirement 5.2: 無欠落の整形済みテキスト）", () => {
  it("元 content の全セクション見出しが描画テキストに ALL 含まれる（無欠落の証跡）", async () => {
    server.use(
      http.get("/api/steering/:name", ({ params }) => {
        expect(params.name).toBe("product");
        return HttpResponse.json(docFixture);
      }),
    );
    renderAt("product");

    const page = await screen.findByTestId("steering-doc-page");
    // 見出しは heading 要素として描画される（MarkdownDoc 経由）。1 件でも欠ければ fail。
    for (const heading of SOURCE_HEADINGS) {
      expect(within(page).getByRole("heading", { name: heading })).toBeTruthy();
    }
  });

  it("loading 中は LoadingSkeleton を表示する", () => {
    server.use(http.get("/api/steering/:name", () => new Promise(() => {})));
    renderAt("product");
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});

describe("SteeringDocPage 失敗パス（Requirement 9.6: code/message + 再試行）", () => {
  it("500 → ErrorPanel が厳密 code を表示し、再試行で refetch して本文を描画する", async () => {
    let calls = 0;
    server.use(
      http.get("/api/steering/:name", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "boom" } },
            { status: 500 },
          );
        }
        return HttpResponse.json(docFixture);
      }),
    );
    renderAt("product");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("INTERNAL_ERROR")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "再試行" }));

    const page = await screen.findByTestId("steering-doc-page");
    await waitFor(() =>
      expect(within(page).getByRole("heading", { name: SOURCE_HEADINGS[0] })).toBeTruthy(),
    );
  });
});
