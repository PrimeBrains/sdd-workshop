/**
 * useCorrespondence の単体テスト
 * （tasks.md 6.2 / Requirements 4.3, 4.4 / design.md Testing Strategy Unit #6・
 * State Management `useCorrespondence(selection, traceIndex, targetDocument) => { anchorIds }`）。
 *
 * 検証（厳密値）:
 * - 選択ノード → 対向文書の正確なアンカー ID 集合（グラフ由来のみ）
 * - エッジを持たないノード → 空集合（4.3: 独自対応付けをしない）
 * - 対向文書と異なる種別の対応先しか持たないノード → 空集合（フィルタが効く）
 * - 双方向（requirement → design / task、design / task → requirement）
 * - graph 不在（null）・selection 不在（null）→ 空集合
 */
import { describe, expect, it } from "vitest";
import type { TraceGraph } from "@contracts/trace";
import { buildTraceIndex } from "@/trace/traceIndex";
import { useCorrespondence } from "@/features/compare/useCorrespondence";

/**
 * フィクスチャグラフ:
 * - 要件 1 → design "RawBlockView"（design-table）、design "DocBlockList"（component-field）、task "3.1"
 * - 要件 2 → task "4.1" のみ（design 対応なし）
 * - 要件 3 → 対応エッジなし（孤立。グラフにノードはあるがエッジなし）
 */
const graph: TraceGraph = {
  feature: "foo",
  nodes: {
    requirements: [
      { type: "requirement", id: "1" },
      { type: "requirement", id: "2" },
      { type: "requirement", id: "3" },
    ],
    designElements: [
      { type: "design", name: "RawBlockView" },
      { type: "design", name: "DocBlockList" },
    ],
    tasks: [
      { type: "task", id: "3.1" },
      { type: "task", id: "4.1" },
    ],
  },
  edges: [
    {
      from: { type: "requirement", id: "1" },
      to: { type: "design", name: "RawBlockView" },
      source: "design-table",
      legacyExpanded: false,
    },
    {
      from: { type: "requirement", id: "1" },
      to: { type: "design", name: "DocBlockList" },
      source: "component-field",
      legacyExpanded: false,
    },
    {
      from: { type: "requirement", id: "1" },
      to: { type: "task", id: "3.1" },
      source: "task-annotation",
      legacyExpanded: false,
    },
    {
      from: { type: "requirement", id: "2" },
      to: { type: "task", id: "4.1" },
      source: "task-annotation",
      legacyExpanded: false,
    },
  ],
  diagnostics: [],
};

const index = buildTraceIndex(graph);

describe("useCorrespondence: requirement → design（順方向、design ペインへの対応）", () => {
  it("要件 1 選択 → design ペインに対応 design 要素のアンカーのみ（厳密値・グラフ由来）", () => {
    const result = useCorrespondence(
      { pane: "left", node: { type: "requirement", id: "1" } },
      index,
      "design",
    );
    // coverOf("1").designs = [RawBlockView, DocBlockList] → design-<slug> へ写像（入力順）
    expect(result.anchorIds).toEqual(["design-rawblockview", "design-docblocklist"]);
  });
});

describe("useCorrespondence: requirement → task（対向 = tasks のときは tasks 側のみ）", () => {
  it("要件 1 選択 → tasks ペインには task アンカーのみ（design は混ざらない）", () => {
    const result = useCorrespondence(
      { pane: "left", node: { type: "requirement", id: "1" } },
      index,
      "tasks",
    );
    expect(result.anchorIds).toEqual(["task-3.1"]);
  });
});

describe("useCorrespondence: フィルタ（対向文書に対応先が無い → 空集合）", () => {
  it("要件 2 は design 対応を持たない → design ペインでは空集合", () => {
    const result = useCorrespondence(
      { pane: "left", node: { type: "requirement", id: "2" } },
      index,
      "design",
    );
    expect(result.anchorIds).toEqual([]);
  });
});

describe("useCorrespondence: エッジを持たないノード → 空集合（4.3 グラフ由来のみ）", () => {
  it("要件 3 はエッジを持たない → design・tasks いずれでも空集合", () => {
    expect(
      useCorrespondence({ pane: "left", node: { type: "requirement", id: "3" } }, index, "design")
        .anchorIds,
    ).toEqual([]);
    expect(
      useCorrespondence({ pane: "left", node: { type: "requirement", id: "3" } }, index, "tasks")
        .anchorIds,
    ).toEqual([]);
  });
});

describe("useCorrespondence: 逆方向（design / task → requirement）", () => {
  it("design 要素 RawBlockView 選択 → requirements ペインに要件 1 のアンカー（厳密値）", () => {
    const result = useCorrespondence(
      { pane: "right", node: { type: "design", name: "RawBlockView" } },
      index,
      "requirements",
    );
    expect(result.anchorIds).toEqual(["req-1"]);
  });

  it("task 3.1 選択 → requirements ペインに要件 1 のアンカー", () => {
    const result = useCorrespondence(
      { pane: "right", node: { type: "task", id: "3.1" } },
      index,
      "requirements",
    );
    expect(result.anchorIds).toEqual(["req-1"]);
  });

  it("design 選択でも対向が design（同種別）なら空集合（要件 → 要件のエッジは無い）", () => {
    const result = useCorrespondence(
      { pane: "right", node: { type: "design", name: "RawBlockView" } },
      index,
      "design",
    );
    expect(result.anchorIds).toEqual([]);
  });
});

describe("useCorrespondence: brief / research 対向はグラフノードを持たない → 空集合", () => {
  it("要件 1 選択でも対向が brief なら空集合", () => {
    expect(
      useCorrespondence({ pane: "left", node: { type: "requirement", id: "1" } }, index, "brief")
        .anchorIds,
    ).toEqual([]);
    expect(
      useCorrespondence({ pane: "left", node: { type: "requirement", id: "1" } }, index, "research")
        .anchorIds,
    ).toEqual([]);
  });
});

describe("useCorrespondence: null 安全（selection / traceIndex 不在）", () => {
  it("selection が null なら空集合", () => {
    expect(useCorrespondence(null, index, "design").anchorIds).toEqual([]);
  });
  it("traceIndex が null（graph 未取得）なら空集合", () => {
    expect(
      useCorrespondence({ pane: "left", node: { type: "requirement", id: "1" } }, null, "design")
        .anchorIds,
    ).toEqual([]);
  });
});
