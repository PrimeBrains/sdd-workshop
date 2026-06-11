/**
 * ValidationList のテスト（tasks.md 8.1 / Requirements 6.1, 6.4 /
 * design.md「ValidationList + ValidationReportPage」）。
 *
 * - 存在する validation レポートは type / date / decision をバッジで一覧表示し、
 *   `/specs/:feature/validation/:type` へのリンクになる（6.1）
 * - 未生成の type（gap / design / impl のうち欠落分）は「未生成」プレースホルダの
 *   非リンク表示になる（非エラー、6.4）
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { ValidationReport } from "@contracts/resources";
import { ValidationList } from "@/features/validation/ValidationList";

afterEach(cleanup);

const gapReport: ValidationReport = {
  type: "gap",
  feature: "foo",
  date: "2026-06-01",
  decision: null,
  content: "# Gap",
  sections: [],
  diagnostics: [],
};

const designReport: ValidationReport = {
  type: "design",
  feature: "foo",
  date: "2026-06-02",
  decision: "GO",
  content: "# Design",
  sections: [],
  diagnostics: [],
};

const implReport: ValidationReport = {
  type: "impl",
  feature: "foo",
  date: "2026-06-03",
  decision: "CONDITIONAL",
  content: "# Impl",
  sections: [],
  diagnostics: [],
};

/** ValidationList をメモリルーター内に描画する（Link 解決のため） */
function renderList(feature: string, validations: ValidationReport[]) {
  const router = createMemoryRouter(
    [
      {
        path: "/specs/:feature",
        element: <ValidationList feature={feature} validations={validations} />,
      },
      { path: "/specs/:feature/validation/:type", element: <Stub /> },
    ],
    { initialEntries: [`/specs/${feature}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function Stub(): JSX.Element {
  return <h1 data-testid="validation-stub">report</h1>;
}

describe("ValidationList（Requirement 6.1 / 6.4: 一覧とメタデータ・未生成表示）", () => {
  it("完了条件: gap のみ存在 → gap が type/date/decision 付きで表示・リンクし、design / impl は未生成", () => {
    renderList("foo", [gapReport]);

    const gap = screen.getByTestId("validation-item-gap");
    expect(gap.getAttribute("data-state")).toBe("available");
    expect(gap.tagName).toBe("A");
    expect(gap.getAttribute("href")).toBe("/specs/foo/validation/gap");
    expect(screen.getByTestId("validation-type-gap").textContent).toBe("gap");
    expect(screen.getByTestId("validation-date-gap").textContent).toBe("2026-06-01");
    // gap レポートは decision を持たない → 未判定の厳密表示
    expect(screen.getByTestId("validation-decision-gap").textContent).toBe("判定なし");

    const design = screen.getByTestId("validation-item-design");
    expect(design.getAttribute("data-state")).toBe("missing");
    expect(design.tagName).not.toBe("A");
    expect(design.getAttribute("href")).toBeNull();
    expect(design.textContent).toContain("design");
    expect(design.textContent).toContain("未生成");

    const impl = screen.getByTestId("validation-item-impl");
    expect(impl.getAttribute("data-state")).toBe("missing");
    expect(impl.textContent).toContain("未生成");

    // 未生成は非エラー
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("3 種すべて存在 → 全件が type/date/decision 付きで表示され、未生成プレースホルダは出ない", () => {
    renderList("foo", [gapReport, designReport, implReport]);

    expect(screen.getByTestId("validation-item-gap").getAttribute("data-state")).toBe("available");
    expect(screen.getByTestId("validation-item-design").getAttribute("href")).toBe(
      "/specs/foo/validation/design",
    );
    expect(screen.getByTestId("validation-decision-design").textContent).toBe("GO");
    expect(screen.getByTestId("validation-date-impl").textContent).toBe("2026-06-03");
    expect(screen.getByTestId("validation-decision-impl").textContent).toBe("CONDITIONAL");

    expect(screen.queryByText("未生成")).toBeNull();
  });

  it("1 件も存在しない → gap / design / impl すべて未生成プレースホルダになる", () => {
    renderList("foo", []);

    for (const type of ["gap", "design", "impl"] as const) {
      const item = screen.getByTestId(`validation-item-${type}`);
      expect(item.getAttribute("data-state")).toBe("missing");
      expect(item.tagName).not.toBe("A");
      expect(item.textContent).toContain("未生成");
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("date が null のレポートは日付なしの厳密表示になる", () => {
    renderList("foo", [{ ...gapReport, date: null }]);

    expect(screen.getByTestId("validation-date-gap").textContent).toBe("日付なし");
  });
});
