/**
 * DiagnosticBadge のテスト（design.md File Structure Plan `features/viewer/DiagnosticBadge.tsx`、
 * Requirement 6.3 / 5.3 系のパース診断表示）。
 *
 * sdd-core の `Diagnostic`（{ kind, message, position }）をそのまま表示する純表示要素。
 * 解釈・再計算をしない（kind と message を欠落なく出す）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Diagnostic } from "@contracts/document";
import { DiagnosticBadge } from "./DiagnosticBadge";

afterEach(cleanup);

const parseFailure: Diagnostic = {
  kind: "parse-failure",
  message: "frontmatter の YAML 解析に失敗しました: 不正なインデント",
  position: null,
};

describe("DiagnosticBadge", () => {
  it("診断の kind と message を欠落なく表示する", () => {
    render(<DiagnosticBadge diagnostic={parseFailure} />);
    const badge = screen.getByTestId("diagnostic-badge");
    expect(badge.getAttribute("data-kind")).toBe("parse-failure");
    expect(screen.getByTestId("diagnostic-badge-kind").textContent).toBe("parse-failure");
    expect(screen.getByTestId("diagnostic-badge-message").textContent).toBe(
      "frontmatter の YAML 解析に失敗しました: 不正なインデント",
    );
  });

  it("position を持つ診断では行番号を併記する", () => {
    render(
      <DiagnosticBadge
        diagnostic={{
          kind: "parse-failure",
          message: "型不一致",
          position: { startLine: 3, endLine: 3, startOffset: 10, endOffset: 20 },
        }}
      />,
    );
    expect(screen.getByTestId("diagnostic-badge-line").textContent).toBe("3");
  });

  it("position が null の診断では行番号を表示しない", () => {
    render(<DiagnosticBadge diagnostic={parseFailure} />);
    expect(screen.queryByTestId("diagnostic-badge-line")).toBeNull();
  });
});
