/**
 * PipelineFlow — @xyflow/react を読取専用設定でラップするボード描画コンポーネント
 * （design.md「Feature: board」PipelineFlow / Requirements 1.1, 9.5）。
 *
 * - CSS はローカル import のみ（外部 CDN を参照しない、9.5）。
 * - Pro 機能不使用。`proOptions.hideAttribution = true` で attribution アンカー
 *   （実 DOM に現れる外部リンク）を出さない（9.5）。
 * - 読取専用: nodesDraggable=false / nodesConnectable=false / elementsSelectable=false / fitView。
 * - `nodeTypes` に SpecPipelineNode を登録する。
 *
 * 外部リソースを一切取得しない（ローカルバンドルのみ）。
 */
import { useMemo, type JSX } from "react";
import { ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SPEC_PIPELINE_NODE_TYPE, type SpecPipelineNodeData } from "@/workflow/board/buildBoardGraph";
import { SpecPipelineNode } from "@/workflow/board/SpecPipelineNode";

interface PipelineFlowProps {
  nodes: Node<SpecPipelineNodeData>[];
  edges: Edge[];
}

export function PipelineFlow({ nodes, edges }: PipelineFlowProps): JSX.Element {
  // nodeTypes は安定参照（毎 render 再生成すると xyflow が警告するため useMemo で固定）。
  const nodeTypes = useMemo(() => ({ [SPEC_PIPELINE_NODE_TYPE]: SpecPipelineNode }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      proOptions={{ hideAttribution: true }}
    />
  );
}
