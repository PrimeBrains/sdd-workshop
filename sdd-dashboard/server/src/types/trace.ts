/**
 * トレーサビリティ契約型 — RefToken / TraceGraph / TraceEdge / TraceDiagnostic
 * （design.md RefListParser / TraceGraphBuilder Service Interface）。
 */
import type { Position } from "./document.js";

/**
 * trace-notation.md の参照文法トークン（RefListParser の出力）。
 * 旧範囲表記は同一 major・整数 minor の場合のみ閉区間で連番展開し legacy フラグを付ける。
 * それ以外（major 跨ぎ・非整数・ワイルドカード・括弧付き注記）は unparsable（6.2, 6.3, 6.7）。
 */
export type RefToken =
  | { kind: "id"; id: string; raw: string }
  | { kind: "range"; from: string; to: string; expanded: string[]; legacy: true; raw: string }
  | { kind: "cross-spec"; feature: string; id: string; raw: string }
  | { kind: "unparsable"; raw: string };

/** グラフノードの参照（Req ⇄ Design ⇄ Task） */
export type NodeRef =
  | { type: "requirement"; id: string } // "1.2"
  | { type: "design"; name: string } // コンポーネント名 or Traceability 行ラベル
  | { type: "task"; id: string }; // "3.2"

/** トレースエッジ（3 源泉: design 表 / コンポーネント Requirements フィールド / タスク注記） */
export interface TraceEdge {
  from: NodeRef;
  to: NodeRef;
  source: "design-table" | "component-field" | "task-annotation";
  legacyExpanded: boolean;
}

/** グラフ診断（6.3, 6.4, 6.5, 6.7）。診断があってもグラフ構築は継続する */
export type TraceDiagnostic =
  | { kind: "broken-link"; ref: string; where: NodeRef; position: Position }
  | { kind: "design-uncovered"; requirementId: string }
  | { kind: "task-uncovered"; requirementId: string }
  | { kind: "unparsable-ref"; raw: string; where: NodeRef; position: Position };

/**
 * Req ⇄ Design ⇄ Task の双方向トレーサビリティグラフ（GET /api/specs/:feature/trace）。
 * edges は完全列挙であり、クライアント側で両方向インデックスを構築可能。
 */
export interface TraceGraph {
  feature: string;
  nodes: { requirements: NodeRef[]; designElements: NodeRef[]; tasks: NodeRef[] };
  edges: TraceEdge[];
  diagnostics: TraceDiagnostic[];
}
