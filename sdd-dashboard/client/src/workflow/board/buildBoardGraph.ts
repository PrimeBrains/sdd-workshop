/**
 * BoardGraphBuilder — SpecSummary[] からパイプライン俯瞰ボードの xyflow グラフを構築する純粋関数
 * （design.md「Feature: board」BoardGraph / SpecPipelineNodeData / Postconditions、
 *  Requirements 1.1, 1.3）。
 *
 * 純粋関数のみ。FS・HTTP・DOM アクセスを持たず、入力は SpecSummary[] のみ。
 * `@xyflow/react` は型のみ（`Node` / `Edge`）を import する（ランタイム・CSS 不使用）。
 *
 * ## モデル決定: one-node-per-lane（1 スペック = 1 xyflow ノード）
 * design.md の語句「4 フェーズノード + 進行エッジ」は、カスタムノード `SpecPipelineNode`（task 3.2）が
 * ノード内部に描画するビジュアル（4 段階のステップ表示と進行矢印）を指す。
 * 一方、型付き契約 `SpecPipelineNodeData` は 4 段階すべてを含む `PipelineView` を 1 つ保持し、
 * フェーズ別の discriminator を持たない。したがってグラフモデルは
 * 「スペックごとに 1 つの xyflow ノード」であり、4 つの別ノードではない。
 * よって `edges` は常に空配列（フェーズ進行はノード間エッジではなくノード内描画）。
 * これは xyflow API 形状（`Edge[]`）を維持しつつ one-node-per-lane モデルでは空が正しい。
 *
 * Postconditions:
 * - 入力スペック数 = レーン数（破損スペックも省略しない、1.3）。
 * - 同一入力 → 同一座標（決定論的な格子レイアウト、自動レイアウト不使用）。
 */
import type { Edge, Node } from "@xyflow/react";

import type { SpecSummary } from "@contracts/spec";

import { buildPipelineView } from "@/workflow/model/phaseModel";
import type { PipelineView } from "@/workflow/model/phaseModel";

/** スペックごとの行間隔（px）。決定論的な格子座標 y = index * ROW_GAP に使う。 */
export const ROW_GAP = 140;

/** カスタムノード種別。task 3.2 の PipelineFlow が `nodeTypes` に登録する文字列。 */
export const SPEC_PIPELINE_NODE_TYPE = "specPipeline";

/** 1 スペックレーン分のノードデータ（design.md「Feature: board」契約）。 */
export interface SpecPipelineNodeData extends Record<string, unknown> {
  feature: string;
  pipeline: PipelineView;
  hasDiagnostics: boolean;
}

/** ボードの xyflow グラフ（ノード集合 + エッジ集合）。 */
export interface BoardGraph {
  nodes: Node<SpecPipelineNodeData>[];
  edges: Edge[];
}

/**
 * SpecSummary[] からボードグラフを構築する。
 * スペックごとに 1 ノードを入力順で生成し、決定論的な格子座標を割り当てる。
 * 破損スペック（approvals=null）もレーンを省略せず、PipelineView は全段階 unknown となる。
 */
export function buildBoardGraph(specs: SpecSummary[]): BoardGraph {
  const nodes: Node<SpecPipelineNodeData>[] = specs.map((spec, index) => ({
    id: spec.feature,
    type: SPEC_PIPELINE_NODE_TYPE,
    position: { x: 0, y: index * ROW_GAP },
    data: {
      feature: spec.feature,
      pipeline: buildPipelineView(spec),
      hasDiagnostics: spec.diagnostics.length > 0,
    },
  }));

  return { nodes, edges: [] };
}
