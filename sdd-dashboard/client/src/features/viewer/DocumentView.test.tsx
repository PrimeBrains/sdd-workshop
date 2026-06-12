/**
 * DocumentView のテスト（tasks.md 6.1 のリファクタ点 /
 * design.md File Structure Plan `features/viewer/`）。
 *
 * DocumentView は SpecDocumentPage（3.2/4.x）と ComparePane（6.1）が共有する
 * 単一の `DocumentKind → ビューア` ディスパッチである。ここではそのディスパッチ規律を
 * 直接検証する（従来 SpecDocumentPage 経由で間接的にのみ覆われていた）:
 *
 * - brief / research: MarkdownDoc（全文 + セクション。2.7 と同経路）
 * - requirements: RequirementsView（4.1）
 * - design: DesignView（4.2）
 * - tasks: TasksView（4.3）
 * - 不在成果物（null）: MissingArtifact（`data-testid="document-missing"`、
 *   Requirement 1.3 パターン: 不在はエラーではない）
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { DocumentView } from "@/features/viewer/DocumentView";

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

/** 各 kind が固有の本文を持つフィクスチャ（ディスパッチ先の取り違えを検出できる値） */
const detail: SpecDetail = {
  summary: makeSummary("foo"),
  brief: {
    content: "# Brief Heading\n\nbrief 固有本文",
    sections: [{ title: "Brief Heading", depth: 1, position: pos(1, 3, 0, 30), children: [] }],
  },
  research: {
    content: "# Research Heading\n\nresearch 固有本文",
    sections: [{ title: "Research Heading", depth: 1, position: pos(1, 3, 0, 33), children: [] }],
  },
  requirements: {
    requirements: [
      {
        kind: "structured",
        position: pos(5, 12, 100, 300),
        id: "1",
        title: "要件タイトル固有",
        objective: "目的固有",
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
  design: {
    sections: [{ title: "設計セクション固有", depth: 2, position: pos(1, 10, 0, 200), children: [] }],
    traceability: [],
    componentRequirements: [],
    content: "",
  },
  tasks: {
    tasks: [
      {
        id: "1",
        description: "タスク説明固有",
        checked: true,
        parallel: false,
        optional: false,
        details: [],
        requirements: [],
        depends: [],
        boundary: null,
        position: pos(3, 8, 60, 200),
        subtasks: [],
      },
    ],
    otherBlocks: [],
  },
  validations: [],
};

/** RefChip 等が react-router フックを使うため Router 配下で描画する（index=null で退避） */
function renderView(ui: ReactElement) {
  return render(<MemoryRouter initialEntries={["/specs/foo/x"]}>{ui}</MemoryRouter>);
}

describe("DocumentView の DocumentKind → ビューアディスパッチ", () => {
  it("brief は MarkdownDoc へディスパッチする", () => {
    renderView(<DocumentView kind="brief" detail={detail} />);
    expect(screen.getByRole("heading", { name: "Brief Heading" })).toBeTruthy();
    expect(screen.getByText("brief 固有本文")).toBeTruthy();
  });

  it("research は MarkdownDoc へディスパッチする", () => {
    renderView(<DocumentView kind="research" detail={detail} />);
    expect(screen.getByRole("heading", { name: "Research Heading" })).toBeTruthy();
    expect(screen.getByText("research 固有本文")).toBeTruthy();
  });

  it("requirements は RequirementsView へディスパッチする", () => {
    renderView(<DocumentView kind="requirements" detail={detail} />);
    expect(screen.getByText("要件AC和訳固有")).toBeTruthy();
    expect(screen.getByText("The client shall list specs.")).toBeTruthy();
  });

  it("design は DesignView へディスパッチする（セクションナビを持つ）", () => {
    renderView(<DocumentView kind="design" detail={detail} />);
    const nav = screen.getByTestId("design-section-nav");
    // セクション見出しはナビ + 本文の 2 箇所に出るため getAllByText で確認する
    expect(within(nav).getByText("設計セクション固有")).toBeTruthy();
    expect(screen.getAllByText("設計セクション固有").length).toBeGreaterThan(0);
  });

  it("tasks は TasksView へディスパッチする", () => {
    renderView(<DocumentView kind="tasks" detail={detail} />);
    expect(screen.getByTestId("tasks-view")).toBeTruthy();
    expect(screen.getByText("タスク説明固有")).toBeTruthy();
  });

  it("成果物が null の kind は MissingArtifact（document-missing）を描画する", () => {
    const empty: SpecDetail = {
      summary: makeSummary("empty"),
      brief: null,
      requirements: null,
      design: null,
      tasks: null,
      research: null,
      validations: [],
    };
    renderView(<DocumentView kind="requirements" detail={empty} />);
    const missing = screen.getByTestId("document-missing");
    expect(missing.textContent).toContain("未作成");
    // 不在はエラーではない（role=alert を出さない）
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
