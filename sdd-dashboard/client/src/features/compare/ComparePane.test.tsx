/**
 * ComparePane のテスト（tasks.md 6.1 / Requirements 4.1, 4.2 /
 * design.md「ComparePane embeds viewer」・File Structure Plan `features/compare/ComparePane.tsx`）。
 *
 * ComparePane は片側ペインの単位:
 * - 自身の `kind` の文書を DocumentView で描画する（ディスパッチは DocumentView が単一所有）
 * - 全 5 種別（brief / requirements / design / tasks / research）を選べるセレクタを持ち、
 *   変更時に `onKindChange(next)` を発火する（URL 書き換えは親 ComparePage が担う: 4.2）
 * - 不在文書（detail 側が null）は DocumentView の MissingArtifact で表示される（1.3 と一貫）
 * - data-testid（`compare-pane-<side>` / `compare-pane-select`）でペインを識別可能にする
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Position } from "@contracts/document";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { ComparePane } from "@/features/compare/ComparePane";

afterEach(cleanup);

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number): Position {
  return { startLine, endLine, startOffset, endOffset };
}

function makeSummary(feature: string): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "implementation",
    language: "japanese",
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    },
    readyForImplementation: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
    artifacts: {
      brief: true,
      requirements: true,
      design: true,
      tasks: true,
      research: true,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
  };
}

const detail: SpecDetail = {
  summary: makeSummary("foo"),
  brief: {
    content: "# Brief Heading\n\nbrief 固有本文",
    sections: [{ title: "Brief Heading", depth: 1, position: pos(1, 3, 0, 30), children: [] }],
  },
  research: null,
  requirements: {
    requirements: [
      {
        kind: "structured",
        position: pos(5, 12, 100, 300),
        id: "1",
        title: "要件タイトル固有",
        objective: "要件目的固有",
        criteria: [
          {
            kind: "structured",
            position: pos(8, 9, 150, 220),
            id: "1.1",
            text: "The client shall list specs.",
            translationJa: "要件AC和訳固有",
          },
        ],
      },
    ],
    otherBlocks: [],
  },
  design: null,
  tasks: null,
  validations: [],
};

function renderPane(ui: ReactElement) {
  return render(<MemoryRouter initialEntries={["/specs/foo/compare"]}>{ui}</MemoryRouter>);
}

describe("ComparePane", () => {
  it("自身の kind の文書を DocumentView 経由で描画する（compare-pane-<side> で識別）", () => {
    renderPane(<ComparePane side="left" kind="requirements" detail={detail} onKindChange={vi.fn()} />);
    const pane = screen.getByTestId("compare-pane-left");
    expect(within(pane).getByText("要件AC和訳固有")).toBeTruthy();
    expect(within(pane).getByText("The client shall list specs.")).toBeTruthy();
  });

  it("セレクタは全 5 種別を提供し、現在の kind が選択値になる", () => {
    renderPane(<ComparePane side="right" kind="brief" detail={detail} onKindChange={vi.fn()} />);
    const select = screen.getByTestId("compare-pane-select") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["brief", "requirements", "design", "tasks", "research"]);
    expect(select.value).toBe("brief");
  });

  it("セレクタ変更時に onKindChange(next) を発火する（URL 書き換えは親が担う）", () => {
    const onKindChange = vi.fn();
    renderPane(<ComparePane side="left" kind="requirements" detail={detail} onKindChange={onKindChange} />);
    fireEvent.change(screen.getByTestId("compare-pane-select"), { target: { value: "tasks" } });
    expect(onKindChange).toHaveBeenCalledTimes(1);
    expect(onKindChange).toHaveBeenCalledWith("tasks");
  });

  it("不在文書（detail 側が null）は MissingArtifact を描画する（1.3 と一貫）", () => {
    renderPane(<ComparePane side="right" kind="design" detail={detail} onKindChange={vi.fn()} />);
    const pane = screen.getByTestId("compare-pane-right");
    expect(within(pane).getByTestId("document-missing").textContent).toContain("未作成");
  });
});
