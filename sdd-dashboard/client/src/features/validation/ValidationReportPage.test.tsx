/**
 * ValidationReportPage の結合テスト（tasks.md 8.2 / design.md
 * 「ValidationList + ValidationReportPage」・ルート表 `/specs/:feature/validation/:type` /
 * Requirements 6.2, 6.3, 6.4）。
 *
 * `useSpecDetail(feature)` の `SpecDetail.validations`（sdd-core 7.4）から `:type` の
 * レポートを 1 件選び、本文を描画する。
 * - 6.2: 正常レポート → frontmatter メタ（type / date / decision）+ 本文を構造化描画
 * - 6.3: frontmatter 破損（diagnostics 付き）→ 生 markdown 全文（RawBlockView）+ DiagnosticBadge
 * - 6.4: 当該 type 未生成 → 「未生成」の非エラー表示
 * - 1.5: loading → LoadingSkeleton、取得失敗 → ErrorPanel + 再試行
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Diagnostic } from "@contracts/document";
import type { ValidationReport } from "@contracts/resources";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { ValidationReportPage } from "./ValidationReportPage";

function makeSummary(feature: string): SpecSummary {
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
      research: false,
      validationGap: true,
      validationDesign: true,
      validationImpl: false,
    },
    diagnostics: [],
  };
}

/** 正常レポート（有効 frontmatter + 構造化本文。diagnostics なし） */
const designReportBody = [
  "# 設計検証レポート",
  "",
  "## 判定",
  "",
  "設計は要件を満たしている。GO とする。",
].join("\n");

const designReport: ValidationReport = {
  type: "design",
  feature: "foo",
  date: "2026-06-10",
  decision: "GO",
  content: designReportBody,
  sections: [
    { title: "設計検証レポート", depth: 1, position: pos(1, 1, 0, 10), children: [] },
  ],
  diagnostics: [],
};

/** frontmatter 破損レポート（生全文 + parse-failure 診断） */
const brokenRaw = [
  "---",
  "type: gap",
  "  date 2026-06-09",   // コロン欠落 → YAML 不正
  "---",
  "",
  "# ギャップ分析（生フォールバック）",
  "",
  "frontmatter が壊れているため全文を生で表示する。",
].join("\n");

const brokenDiagnostic: Diagnostic = {
  kind: "parse-failure",
  message: "frontmatter の YAML 解析に失敗しました",
  position: null,
};

const gapReport: ValidationReport = {
  type: "gap",
  feature: "foo",
  date: null,
  decision: null,
  content: brokenRaw,
  sections: [],
  diagnostics: [brokenDiagnostic],
};

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number) {
  return { startLine, endLine, startOffset, endOffset };
}

function makeDetail(validations: ValidationReport[]): SpecDetail {
  return {
    summary: makeSummary("foo"),
    brief: null,
    requirements: null,
    design: null,
    tasks: null,
    research: null,
    validations,
  };
}

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

/** `/specs/:feature/validation/:type` を直接開いて ValidationReportPage を描画する */
function renderReport(url: string) {
  const router = createMemoryRouter(
    [{ path: "/specs/:feature/validation/:type", element: <ValidationReportPage /> }],
    { initialEntries: [url] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe("ValidationReportPage（正常レポート: 6.2）", () => {
  it("frontmatter メタ（type/date/decision）+ 本文が構造化描画される", async () => {
    server.use(
      http.get("/api/specs/foo", () => HttpResponse.json(makeDetail([designReport]))),
    );
    renderReport("/specs/foo/validation/design");

    expect(await screen.findByTestId("validation-report-page")).toBeTruthy();
    // frontmatter メタ（厳密値）。データ取得完了まで待つ
    expect((await screen.findByTestId("validation-meta-type")).textContent).toBe("design");
    expect(screen.getByTestId("validation-meta-date").textContent).toBe("2026-06-10");
    expect(screen.getByTestId("validation-meta-decision").textContent).toBe("GO");
    // 本文が構造化描画される（見出し要素 + 本文テキスト）
    const body = screen.getByTestId("validation-report-body");
    expect(within(body).getByRole("heading", { level: 1 }).textContent).toBe("設計検証レポート");
    expect(within(body).getByRole("heading", { level: 2 }).textContent).toBe("判定");
    expect(body.textContent).toContain("設計は要件を満たしている。GO とする。");
    // 破損経路の表示は出ない
    expect(screen.queryByTestId("diagnostic-badge")).toBeNull();
  });

  it("decision を持たない gap レポートでも判定なしで構造化描画される", async () => {
    const gapValid: ValidationReport = {
      type: "gap",
      feature: "foo",
      date: "2026-06-08",
      decision: null,
      content: "# ギャップ分析\n\n差分は軽微。",
      sections: [],
      diagnostics: [],
    };
    server.use(http.get("/api/specs/foo", () => HttpResponse.json(makeDetail([gapValid]))));
    renderReport("/specs/foo/validation/gap");

    expect(await screen.findByTestId("validation-meta-type")).toBeTruthy();
    expect(screen.getByTestId("validation-meta-decision").textContent).toBe("判定なし");
    expect(screen.getByTestId("validation-report-body").textContent).toContain("差分は軽微。");
  });
});

describe("ValidationReportPage（frontmatter 破損: 6.3 情報無欠落）", () => {
  it("生 markdown 全文（RawBlockView）+ DiagnosticBadge が表示される", async () => {
    server.use(http.get("/api/specs/foo", () => HttpResponse.json(makeDetail([gapReport]))));
    renderReport("/specs/foo/validation/gap");

    // 診断バッジ（厳密値）
    const badge = await screen.findByTestId("diagnostic-badge");
    expect(within(badge).getByTestId("diagnostic-badge-kind").textContent).toBe("parse-failure");
    expect(within(badge).getByTestId("diagnostic-badge-message").textContent).toBe(
      "frontmatter の YAML 解析に失敗しました",
    );
    // 生全文（壊れた frontmatter 区切りや本文すべてが欠落していない）
    const body = screen.getByTestId("validation-report-body");
    expect(body.textContent).toContain("type: gap");
    expect(body.textContent).toContain("date 2026-06-09");
    expect(body.textContent).toContain("ギャップ分析（生フォールバック）");
    expect(body.textContent).toContain("frontmatter が壊れているため全文を生で表示する。");
  });
});

describe("ValidationReportPage（未生成: 6.4 / 取得状態: 1.5）", () => {
  it("当該 type が未生成のときは未生成の非エラー表示になる", async () => {
    server.use(
      http.get("/api/specs/foo", () => HttpResponse.json(makeDetail([designReport]))),
    );
    renderReport("/specs/foo/validation/impl");

    expect(await screen.findByTestId("validation-report-not-generated")).toBeTruthy();
    // エラーとして扱わない（alert は出ない）
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("validation-report-body")).toBeNull();
  });

  it("loading 中は LoadingSkeleton を表示する", async () => {
    server.use(http.get("/api/specs/foo", () => new Promise(() => {})));
    renderReport("/specs/foo/validation/design");

    expect(await screen.findByTestId("loading-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("validation-report-body")).toBeNull();
  });

  it("取得失敗時は ErrorPanel + 再試行を表示する（1.5）", async () => {
    server.use(
      http.get("/api/specs/foo", () =>
        HttpResponse.json(
          { error: { code: "SPEC_NOT_FOUND", message: "見つかりません" } },
          { status: 404 },
        ),
      ),
    );
    renderReport("/specs/foo/validation/design");

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
    expect(screen.queryByTestId("validation-report-body")).toBeNull();
  });
});
