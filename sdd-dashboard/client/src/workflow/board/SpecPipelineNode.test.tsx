/**
 * SpecPipelineNode の表示テスト（tasks.md 3.2 / Requirements 1.2, 1.3, 1.4）。
 *
 * カスタムノードを直接描画し、フェーズ段階状態・現在フェーズ強調・ready/診断バッジ・
 * スペックラベルクリックでの遷移を厳密値で検証する。偽 pass 防止のため
 * 各 step の data-state / data-current を正確に固定する。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Node, NodeProps } from "@xyflow/react";

import { SpecPipelineNode } from "./SpecPipelineNode";
import type { SpecPipelineNodeData } from "./buildBoardGraph";

afterEach(cleanup);

/** NodeProps の必須フィールドを最小充足するヘルパー（data 以外は描画に使われない）。 */
function nodeProps(data: SpecPipelineNodeData): NodeProps<Node<SpecPipelineNodeData>> {
  return {
    id: data.feature,
    data,
    type: "specPipeline",
    selected: false,
    isConnectable: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    draggable: false,
    selectable: false,
    deletable: false,
    width: undefined,
    height: undefined,
    parentId: undefined,
  } as unknown as NodeProps<Node<SpecPipelineNodeData>>;
}

/** 正常スペック: requirements/design 承認済み、tasks が current（生成済み未承認）、impl 未生成、ready=false。 */
const normalData: SpecPipelineNodeData = {
  feature: "alpha-feature",
  hasDiagnostics: false,
  pipeline: {
    steps: [
      { phase: "requirements", state: { kind: "approved" }, current: false },
      { phase: "design", state: { kind: "approved" }, current: false },
      { phase: "tasks", state: { kind: "generated" }, current: true },
      { phase: "implementation", state: { kind: "not-generated" }, current: false },
    ],
    ready: false,
  },
};

/** ready スペック: 全フェーズ approved、ready=true（current 無し）。 */
const readyData: SpecPipelineNodeData = {
  feature: "beta-feature",
  hasDiagnostics: false,
  pipeline: {
    steps: [
      { phase: "requirements", state: { kind: "approved" }, current: false },
      { phase: "design", state: { kind: "approved" }, current: false },
      { phase: "tasks", state: { kind: "approved" }, current: false },
      { phase: "implementation", state: { kind: "approved" }, current: false },
    ],
    ready: true,
  },
};

/** 破損スペック: approvals 読取不能 → 全段階 unknown、ready=null、hasDiagnostics=true（1.3）。 */
const brokenData: SpecPipelineNodeData = {
  feature: "broken-feature",
  hasDiagnostics: true,
  pipeline: {
    steps: [
      { phase: "requirements", state: { kind: "unknown" }, current: false },
      { phase: "design", state: { kind: "unknown" }, current: false },
      { phase: "tasks", state: { kind: "unknown" }, current: false },
      { phase: "implementation", state: { kind: "unknown" }, current: false },
    ],
    ready: null,
  },
};

function renderNode(data: SpecPipelineNodeData) {
  return render(
    <MemoryRouter>
      <SpecPipelineNode {...nodeProps(data)} />
    </MemoryRouter>,
  );
}

describe("SpecPipelineNode フェーズ段階状態の描画（1.2, 1.3）", () => {
  it("正常スペックは各フェーズの state を厳密に描画し、tasks を current 強調する", () => {
    renderNode(normalData);
    const f = "alpha-feature";
    expect(screen.getByTestId(`spec-step-${f}-requirements`).getAttribute("data-state")).toBe(
      "approved",
    );
    expect(screen.getByTestId(`spec-step-${f}-design`).getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId(`spec-step-${f}-tasks`).getAttribute("data-state")).toBe("generated");
    expect(
      screen.getByTestId(`spec-step-${f}-implementation`).getAttribute("data-state"),
    ).toBe("not-generated");

    // 現在フェーズは tasks のみ（高々 1 つ）。
    expect(screen.getByTestId(`spec-step-${f}-tasks`).getAttribute("data-current")).toBe("true");
    for (const phase of ["requirements", "design", "implementation"]) {
      expect(screen.getByTestId(`spec-step-${f}-${phase}`).getAttribute("data-current")).toBe(
        "false",
      );
    }
  });

  it("破損スペックは全段階を unknown 表示し、current 無し（1.3）", () => {
    renderNode(brokenData);
    const f = "broken-feature";
    for (const phase of ["requirements", "design", "tasks", "implementation"]) {
      const el = screen.getByTestId(`spec-step-${f}-${phase}`);
      expect(el.getAttribute("data-state")).toBe("unknown");
      expect(el.getAttribute("data-current")).toBe("false");
    }
  });
});

describe("SpecPipelineNode の ready / 診断バッジ（1.2, 1.3）", () => {
  it("ready=true のとき READY バッジを表示する", () => {
    renderNode(readyData);
    expect(screen.getByTestId("spec-lane-ready-beta-feature").textContent).toBe("READY");
  });

  it("ready=false のとき READY バッジを表示しない", () => {
    renderNode(normalData);
    expect(screen.queryByTestId("spec-lane-ready-alpha-feature")).toBeNull();
  });

  it("hasDiagnostics=true のとき警告バッジを表示する（1.3）", () => {
    renderNode(brokenData);
    expect(screen.getByTestId("spec-lane-diagnostic-broken-feature")).toBeTruthy();
  });

  it("hasDiagnostics=false のとき警告バッジを表示しない", () => {
    renderNode(normalData);
    expect(screen.queryByTestId("spec-lane-diagnostic-alpha-feature")).toBeNull();
  });
});

describe("SpecPipelineNode のスペックラベル遷移（1.4）", () => {
  it("スペックラベルをクリックすると /specs/:feature へ遷移する", () => {
    function LocationProbe() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname}</div>;
    }
    render(
      <MemoryRouter initialEntries={["/board"]}>
        <Routes>
          <Route path="/board" element={<SpecPipelineNode {...nodeProps(normalData)} />} />
          <Route path="/specs/:feature" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("spec-lane-link-alpha-feature"));
    expect(screen.getByTestId("loc").textContent).toBe("/specs/alpha-feature");
  });
});
