/**
 * DiagnosticsPanel の単体テスト（tasks.md 7.2 / Requirements 5.3, 5.5 /
 * design.md「MatrixPage + MatrixGrid + DiagnosticsPanel」DiagnosticsPanel に
 * broken-link / unparsable-ref を raw・発生元・位置付きで一覧）。
 *
 * - `TraceIndex.allDiagnostics` のうち broken-link / unparsable-ref のみを一覧する。
 * - 各行に raw テキスト・発生元（where）・行番号（position.startLine）を厳密値で表示する。
 * - design-uncovered / task-uncovered はパネルに**出さない**（それらは行ハイライトを駆動する）。
 * - 入力 diagnostics をそのまま描画する（再判定・追加・削除なし: 5.5）。
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TraceGraph } from "@contracts/trace";
import { buildTraceIndex } from "@/trace/traceIndex";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

afterEach(cleanup);

/**
 * 4 種すべての診断を含むフィクスチャ。
 * - broken-link（design 発生元・行 12）
 * - unparsable-ref（task 発生元・行 30）
 * - design-uncovered / task-uncovered（パネルには出さない＝行ハイライト駆動）
 */
const graphFixture: TraceGraph = {
  feature: "foo",
  nodes: {
    requirements: [{ type: "requirement", id: "1.1" }],
    designElements: [{ type: "design", name: "TraceIndex" }],
    tasks: [{ type: "task", id: "5.1" }],
  },
  edges: [],
  diagnostics: [
    {
      kind: "broken-link",
      ref: "9.9",
      where: { type: "design", name: "TraceIndex" },
      position: { startLine: 12, endLine: 12, startOffset: 0, endOffset: 5 },
    },
    {
      kind: "unparsable-ref",
      raw: "1.2〜(注記)",
      where: { type: "task", id: "5.1" },
      position: { startLine: 30, endLine: 30, startOffset: 0, endOffset: 9 },
    },
    { kind: "design-uncovered", requirementId: "1.1" },
    { kind: "task-uncovered", requirementId: "1.1" },
  ],
};

function renderPanel(graph: TraceGraph) {
  return render(<DiagnosticsPanel index={buildTraceIndex(graph)} />);
}

describe("DiagnosticsPanel（broken-link / unparsable-ref を raw・発生元・行番号付きで一覧）", () => {
  it("broken-link を raw（ref）・発生元・行番号付きで表示する", () => {
    renderPanel(graphFixture);

    const item = screen.getByTestId("diagnostic-broken-link-0");
    expect(within(item).getByTestId("diagnostic-raw").textContent).toBe("9.9");
    expect(within(item).getByTestId("diagnostic-origin").textContent).toBe("design:TraceIndex");
    expect(within(item).getByTestId("diagnostic-line").textContent).toBe("12");
    expect(item.getAttribute("data-kind")).toBe("broken-link");
  });

  it("unparsable-ref を raw・発生元・行番号付きで表示する", () => {
    renderPanel(graphFixture);

    const item = screen.getByTestId("diagnostic-unparsable-ref-1");
    expect(within(item).getByTestId("diagnostic-raw").textContent).toBe("1.2〜(注記)");
    expect(within(item).getByTestId("diagnostic-origin").textContent).toBe("task:5.1");
    expect(within(item).getByTestId("diagnostic-line").textContent).toBe("30");
    expect(item.getAttribute("data-kind")).toBe("unparsable-ref");
  });

  it("design-uncovered / task-uncovered はパネルに出さない（行ハイライトを駆動するため）", () => {
    renderPanel(graphFixture);

    // パネルに現れる診断行は broken-link + unparsable-ref の 2 件のみ。
    expect(screen.getAllByTestId(/^diagnostic-(broken-link|unparsable-ref)-/)).toHaveLength(2);
    // uncovered 系の testid は存在しない。
    expect(screen.queryByTestId(/^diagnostic-(design|task)-uncovered/)).toBeNull();
  });

  it("as-is: allDiagnostics の link 系をちょうど列挙する（追加・脱落なし: 5.5）", () => {
    const index = buildTraceIndex(graphFixture);
    render(<DiagnosticsPanel index={index} />);

    const linkDiagnostics = index.allDiagnostics.filter(
      (d) => d.kind === "broken-link" || d.kind === "unparsable-ref",
    );
    expect(screen.getAllByTestId(/^diagnostic-(broken-link|unparsable-ref)-/)).toHaveLength(
      linkDiagnostics.length,
    );
  });

  it("link 系診断がゼロのときは「診断なし」を表示する", () => {
    renderPanel({ ...graphFixture, diagnostics: [] });
    expect(screen.getByTestId("diagnostics-panel-empty")).toBeTruthy();
    expect(screen.queryByTestId(/^diagnostic-(broken-link|unparsable-ref)-/)).toBeNull();
  });
});
