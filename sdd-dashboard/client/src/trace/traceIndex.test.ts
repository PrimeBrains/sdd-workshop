/**
 * buildTraceIndex の単体テスト（design.md Testing Strategy Unit #1 / tasks.md 5.1）。
 *
 * フィクスチャ `TraceGraph` は legacy 展開エッジ・broken-link 診断・design-uncovered・task-uncovered を含む。
 * 検証（5.5 as-is 描画の保証）:
 *  1. 完了条件: coverOf / requirementsOf の結果集合が入力エッジ列挙と厳密一致、allDiagnostics が入力と要素同一
 *  2. uncovered.design / uncovered.task が design-uncovered / task-uncovered 診断の対象と厳密一致
 *  3. legacyExpanded / source 属性が TraceEdgeView に保持される
 *  4. broken-link が diagnosticsFor で発生元ノードに表面化する
 *  5. 空グラフ → 空インデックス
 */
import { describe, expect, it } from "vitest";
import type { NodeRef, TraceDiagnostic, TraceEdge, TraceGraph } from "@contracts/trace";
import { buildTraceIndex } from "./traceIndex";

// --- フィクスチャ ---------------------------------------------------------

const designApi: NodeRef = { type: "design", name: "ApiClient + QueryHooks" };
const designTrace: NodeRef = { type: "design", name: "TraceIndex" };
const task12: NodeRef = { type: "task", id: "1.2" };
const task51: NodeRef = { type: "task", id: "5.1" };

// 要件 1.2 を design / task がカバー（design-table + component-field + task-annotation）。
// 要件 3.1 は legacy 展開エッジ（legacyExpanded: true）でタスクがカバー。
const edges: TraceEdge[] = [
  {
    from: { type: "requirement", id: "1.2" },
    to: designApi,
    source: "design-table",
    legacyExpanded: false,
  },
  {
    from: { type: "requirement", id: "1.2" },
    to: designTrace,
    source: "component-field",
    legacyExpanded: false,
  },
  {
    from: { type: "requirement", id: "1.2" },
    to: task12,
    source: "task-annotation",
    legacyExpanded: false,
  },
  {
    from: { type: "requirement", id: "3.1" },
    to: task51,
    source: "task-annotation",
    legacyExpanded: true,
  },
];

const brokenLink: TraceDiagnostic = {
  kind: "broken-link",
  ref: "9.9",
  where: designTrace,
  position: { startLine: 42, startOffset: 100, endLine: 42, endOffset: 110 },
};
const designUncovered: TraceDiagnostic = { kind: "design-uncovered", requirementId: "2.4" };
const taskUncovered: TraceDiagnostic = { kind: "task-uncovered", requirementId: "2.4" };
const taskUncovered2: TraceDiagnostic = { kind: "task-uncovered", requirementId: "5.5" };

const diagnostics: TraceDiagnostic[] = [
  brokenLink,
  designUncovered,
  taskUncovered,
  taskUncovered2,
];

const graph: TraceGraph = {
  feature: "sdd-review-ui",
  nodes: {
    requirements: [
      { type: "requirement", id: "1.2" },
      { type: "requirement", id: "2.4" },
      { type: "requirement", id: "3.1" },
      { type: "requirement", id: "5.5" },
    ],
    designElements: [designApi, designTrace],
    tasks: [task12, task51],
  },
  edges,
  diagnostics,
};

// --- 1. 完了条件: coverOf / requirementsOf がエッジ列挙と厳密一致 ----------

describe("buildTraceIndex coverOf / requirementsOf", () => {
  it("coverOf は要件をカバーする design / task をエッジ列挙どおり返す（厳密値）", () => {
    const index = buildTraceIndex(graph);

    expect(index.coverOf("1.2")).toEqual({
      designs: [
        { node: designApi, source: "design-table", legacyExpanded: false },
        { node: designTrace, source: "component-field", legacyExpanded: false },
      ],
      tasks: [{ node: task12, source: "task-annotation", legacyExpanded: false }],
    });

    expect(index.coverOf("3.1")).toEqual({
      designs: [],
      tasks: [{ node: task51, source: "task-annotation", legacyExpanded: true }],
    });
  });

  it("エッジを持たない要件は空の coverOf を返す", () => {
    const index = buildTraceIndex(graph);
    expect(index.coverOf("2.4")).toEqual({ designs: [], tasks: [] });
    expect(index.coverOf("does-not-exist")).toEqual({ designs: [], tasks: [] });
  });

  it("requirementsOf は design / task が参照する要件をエッジ列挙どおり返す（厳密値）", () => {
    const index = buildTraceIndex(graph);

    expect(index.requirementsOf(designApi)).toEqual([
      { node: { type: "requirement", id: "1.2" }, source: "design-table", legacyExpanded: false },
    ]);
    expect(index.requirementsOf(designTrace)).toEqual([
      {
        node: { type: "requirement", id: "1.2" },
        source: "component-field",
        legacyExpanded: false,
      },
    ]);
    expect(index.requirementsOf(task12)).toEqual([
      { node: { type: "requirement", id: "1.2" }, source: "task-annotation", legacyExpanded: false },
    ]);
    expect(index.requirementsOf(task51)).toEqual([
      { node: { type: "requirement", id: "3.1" }, source: "task-annotation", legacyExpanded: true },
    ]);
  });

  it("Postcondition: coverOf / requirementsOf の和 = 入力エッジ（欠落・追加なし）", () => {
    const index = buildTraceIndex(graph);

    // coverOf 側を全要件で集約して (from -> to) を再構成
    const fromCover = graph.nodes.requirements.flatMap((req) => {
      if (req.type !== "requirement") return [];
      const { designs, tasks } = index.coverOf(req.id);
      return [...designs, ...tasks].map((view) => ({
        from: { type: "requirement" as const, id: req.id },
        to: view.node,
        source: view.source,
        legacyExpanded: view.legacyExpanded,
      }));
    });
    expect(fromCover).toEqual(expect.arrayContaining(edges));
    expect(fromCover).toHaveLength(edges.length);

    // requirementsOf 側を全 design / task ノードで集約して再構成
    const targets: NodeRef[] = [...graph.nodes.designElements, ...graph.nodes.tasks];
    const fromReqOf = targets.flatMap((node) =>
      index.requirementsOf(node).map((view) => ({
        from: view.node,
        to: node,
        source: view.source,
        legacyExpanded: view.legacyExpanded,
      })),
    );
    expect(fromReqOf).toEqual(expect.arrayContaining(edges));
    expect(fromReqOf).toHaveLength(edges.length);
  });
});

// --- allDiagnostics は入力と要素同一 -------------------------------------

describe("buildTraceIndex allDiagnostics", () => {
  it("allDiagnostics は入力 diagnostics と同一参照・同一順序", () => {
    const index = buildTraceIndex(graph);
    expect(index.allDiagnostics).toBe(graph.diagnostics);
    expect(index.allDiagnostics).toHaveLength(diagnostics.length);
    index.allDiagnostics.forEach((d, i) => expect(d).toBe(diagnostics[i]));
  });
});

// --- 2. uncovered が診断対象と厳密一致 ------------------------------------

describe("buildTraceIndex uncovered", () => {
  it("uncovered.design / uncovered.task が design-uncovered / task-uncovered の対象と厳密一致", () => {
    const index = buildTraceIndex(graph);
    expect([...index.uncovered.design]).toEqual(["2.4"]);
    expect([...index.uncovered.task].sort()).toEqual(["2.4", "5.5"]);
  });

  it("uncovered はエッジ有無から再計算されない（診断由来のみ）", () => {
    // 2.4 はエッジを持たないが design-uncovered のみが design 未カバーを表明し、
    // task-uncovered も併記される。エッジを持つ 1.2 / 3.1 は uncovered に含まれない。
    const index = buildTraceIndex(graph);
    expect(index.uncovered.design.has("1.2")).toBe(false);
    expect(index.uncovered.task.has("3.1")).toBe(false);
  });
});

// --- 4. broken-link が発生元ノードに表面化 -------------------------------

describe("buildTraceIndex diagnosticsFor", () => {
  it("broken-link が発生元（where）の diagnosticsFor で表面化する", () => {
    const index = buildTraceIndex(graph);
    expect(index.diagnosticsFor(designTrace)).toEqual([brokenLink]);
  });

  it("診断のないノードは空配列を返す", () => {
    const index = buildTraceIndex(graph);
    expect(index.diagnosticsFor(designApi)).toEqual([]);
    expect(index.diagnosticsFor(task12)).toEqual([]);
  });
});

// --- nodes はそのまま保持 ------------------------------------------------

describe("buildTraceIndex nodes", () => {
  it("nodes は入力 graph.nodes と同一参照", () => {
    const index = buildTraceIndex(graph);
    expect(index.nodes).toBe(graph.nodes);
  });
});

// --- 5. 空グラフ → 空インデックス ----------------------------------------

describe("buildTraceIndex empty graph", () => {
  it("空グラフは空インデックスを返す（Precondition: なし）", () => {
    const empty: TraceGraph = {
      feature: "empty",
      nodes: { requirements: [], designElements: [], tasks: [] },
      edges: [],
      diagnostics: [],
    };
    const index = buildTraceIndex(empty);
    expect(index.coverOf("1.1")).toEqual({ designs: [], tasks: [] });
    expect(index.requirementsOf({ type: "design", name: "Anything" })).toEqual([]);
    expect(index.diagnosticsFor({ type: "task", id: "1.1" })).toEqual([]);
    expect(index.allDiagnostics).toBe(empty.diagnostics);
    expect(index.uncovered.design.size).toBe(0);
    expect(index.uncovered.task.size).toBe(0);
  });
});
