/**
 * TraceIndex（design.md「TraceIndex」Service Interface / tasks.md 5.1）。
 *
 * sdd-core の `TraceGraph`（完全列挙された edges / diagnostics）から、要件 ⇄ design / task の
 * 双方向ルックアップと診断のノード別索引を構築する**純粋関数**。
 *
 * 5.5（as-is 描画）: edges / diagnostics の追加・削除・重複排除・再判定をしない。
 * - 隣接は `edges` のみから構築する（requirements / design / tasks 本文を読まない = 再パース禁止）。
 * - `source` / `legacyExpanded` は表示属性としてそのまま保持する。
 * - `uncovered` は入力 diagnostics（design-uncovered / task-uncovered）からのみ導出し、再計算しない。
 * - `allDiagnostics` は入力 `diagnostics` と要素単位で同一（同一参照・同一順序）。
 *
 * 契約（server/src/types/trace.ts）に従い、エッジは常に requirement → design / task の向きで生成される
 * （`from.type === "requirement"`, `to.type === "design" | "task"`）。サーバー側で既に重複排除済みのため、
 * クライアントでは入力エッジをそのまま索引化する（追加の dedupe はしない）。
 */
import type { NodeRef, TraceDiagnostic, TraceEdge, TraceGraph } from "@contracts/trace";

/** 隣接探索の結果 1 件（対向ノード + 表示属性）。 */
export interface TraceEdgeView {
  node: NodeRef;
  source: TraceEdge["source"];
  legacyExpanded: boolean;
}

export interface TraceIndex {
  /** 要件 ID → その要件をカバーする design 要素 / タスク（エッジ属性付き）。 */
  coverOf(requirementId: string): { designs: TraceEdgeView[]; tasks: TraceEdgeView[] };
  /** design 要素 or タスクノード → 参照している要件（エッジ属性付き）。 */
  requirementsOf(node: NodeRef): TraceEdgeView[];
  /** ノード単位の診断（broken-link / unparsable-ref は発生元 where に帰属）。 */
  diagnosticsFor(node: NodeRef): TraceDiagnostic[];
  /** グラフ全体の診断（入力 diagnostics そのまま。要素単位で同一）。 */
  allDiagnostics: TraceDiagnostic[];
  /** 未カバー集合（入力 diagnostics 由来。再計算しない）。 */
  uncovered: { design: ReadonlySet<string>; task: ReadonlySet<string> };
  nodes: TraceGraph["nodes"];
}

/** NodeRef の正準キー（design は name、requirement / task は id で識別）。内部専用。 */
function nodeKey(node: NodeRef): string {
  return node.type === "design" ? `design:${node.name}` : `${node.type}:${node.id}`;
}

function edgeViewTo(edge: TraceEdge): TraceEdgeView {
  return { node: edge.to, source: edge.source, legacyExpanded: edge.legacyExpanded };
}

function edgeViewFrom(edge: TraceEdge): TraceEdgeView {
  return { node: edge.from, source: edge.source, legacyExpanded: edge.legacyExpanded };
}

/**
 * `TraceGraph` から双方向インデックスを構築する純粋関数。
 *
 * Preconditions: なし（空グラフは空インデックスを返す）。
 * Postconditions: `coverOf` / `requirementsOf` の結果の和 = 入力 `edges`（欠落・追加なし）。
 * Invariants: `allDiagnostics` は入力 `diagnostics` と要素単位で同一。
 */
export function buildTraceIndex(graph: TraceGraph): TraceIndex {
  // requirement ID → 隣接エッジビュー（coverOf 用）
  const coverDesigns = new Map<string, TraceEdgeView[]>();
  const coverTasks = new Map<string, TraceEdgeView[]>();
  // design / task ノードキー → 参照している要件のエッジビュー（requirementsOf 用）
  const requirements = new Map<string, TraceEdgeView[]>();

  for (const edge of graph.edges) {
    // 契約上 from は常に requirement、to は design / task（server trace-graph.ts addEdge）。
    // 不変則を尊重しつつ TS union を狭める: requirement 以外の from は無視（再判定・生成はしない）。
    if (edge.from.type !== "requirement") {
      continue;
    }
    const reqId = edge.from.id;
    if (edge.to.type === "design") {
      pushTo(coverDesigns, reqId, edgeViewTo(edge));
    } else {
      pushTo(coverTasks, reqId, edgeViewTo(edge));
    }
    pushTo(requirements, nodeKey(edge.to), edgeViewFrom(edge));
  }

  // 診断をノード別（where 帰属）に索引化。生成・抑制はしない。
  const diagnosticsByNode = new Map<string, TraceDiagnostic[]>();
  const uncoveredDesign = new Set<string>();
  const uncoveredTask = new Set<string>();
  for (const diagnostic of graph.diagnostics) {
    switch (diagnostic.kind) {
      case "broken-link":
      case "unparsable-ref":
        pushTo(diagnosticsByNode, nodeKey(diagnostic.where), diagnostic);
        break;
      case "design-uncovered":
        uncoveredDesign.add(diagnostic.requirementId);
        break;
      case "task-uncovered":
        uncoveredTask.add(diagnostic.requirementId);
        break;
    }
  }

  return {
    coverOf(requirementId) {
      return {
        designs: coverDesigns.get(requirementId) ?? [],
        tasks: coverTasks.get(requirementId) ?? [],
      };
    },
    requirementsOf(node) {
      return requirements.get(nodeKey(node)) ?? [];
    },
    diagnosticsFor(node) {
      return diagnosticsByNode.get(nodeKey(node)) ?? [];
    },
    allDiagnostics: graph.diagnostics,
    uncovered: { design: uncoveredDesign, task: uncoveredTask },
    nodes: graph.nodes,
  };
}

function pushTo<V>(map: Map<string, V[]>, key: string, value: V): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }
}
