/**
 * SpecPipelineNode — パイプライン俯瞰ボードのカスタムノード（design.md「Feature: board」
 * SpecPipelineNode / Requirements 1.1, 1.2, 1.3, 1.4）。
 *
 * 1 スペック = 1 レーンとして、4 フェーズ（requirements → design → tasks → implementation）の
 * 段階状態を色分け表示する純粋な表示コンポーネント。
 * - フェーズ状態: not-generated = ディム / generated = 枠 + バッジ / approved = 塗り /
 *   unknown = 診断スタイル（approvals 読取不能、1.3）。
 * - 現在フェーズ（`current`）を強調する（1.2）。
 * - `pipeline.ready === true` のとき ready バッジ、`hasDiagnostics` のとき警告バッジを表示する（1.2, 1.3）。
 * - スペックラベル（feature）クリックで `/specs/:feature` へ遷移する（1.4）。
 *
 * 表示専用。HTTP・FS・DOM 直接操作・dangerouslySetInnerHTML・外部 URL を持たない。
 * data は `NodeProps<Node<SpecPipelineNodeData>>` の `props.data` に入る（xyflow 契約）。
 */
import type { JSX } from "react";
import { Link } from "react-router";
import type { Node, NodeProps } from "@xyflow/react";

import type { SpecPipelineNodeData } from "@/workflow/board/buildBoardGraph";
import type { PhaseStepState } from "@/workflow/model/phaseModel";

/** フェーズ段階状態 → テスト・支援技術向けの安定ラベルと表示クラス。 */
const STEP_STYLE: Record<PhaseStepState["kind"], { label: string; className: string }> = {
  "not-generated": { label: "未生成", className: "border border-dashed border-slate-300 bg-white text-slate-300" },
  generated: { label: "生成済み", className: "border border-indigo-400 bg-white text-indigo-700" },
  approved: { label: "承認済み", className: "border border-emerald-500 bg-emerald-500 text-white" },
  unknown: { label: "不明", className: "border border-amber-400 bg-amber-50 text-amber-700" },
};

/** フェーズ名の表示ラベル（固定順は pipeline.steps 側が保証する）。 */
const PHASE_LABEL: Record<string, string> = {
  requirements: "requirements",
  design: "design",
  tasks: "tasks",
  implementation: "implementation",
};

export function SpecPipelineNode(props: NodeProps<Node<SpecPipelineNodeData>>): JSX.Element {
  const { feature, pipeline, hasDiagnostics } = props.data;

  return (
    <div
      data-testid={`spec-lane-${feature}`}
      data-feature={feature}
      className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
    >
      {/* 読取専用・one-node-per-lane モデル（エッジ無し）のため接続ハンドルは持たない（buildBoardGraph 注記参照）。 */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={`/specs/${feature}`}
          data-testid={`spec-lane-link-${feature}`}
          className="text-sm font-semibold text-slate-800 hover:underline"
        >
          {feature}
        </Link>
        {pipeline.ready === true && (
          <span
            data-testid={`spec-lane-ready-${feature}`}
            className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
          >
            READY
          </span>
        )}
        {hasDiagnostics && (
          <span
            data-testid={`spec-lane-diagnostic-${feature}`}
            role="img"
            aria-label="診断あり"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
          >
            ⚠ 診断あり
          </span>
        )}
      </div>

      <ol className="flex items-center gap-1">
        {pipeline.steps.map((step) => {
          const style = STEP_STYLE[step.state.kind];
          return (
            <li
              key={step.phase}
              data-testid={`spec-step-${feature}-${step.phase}`}
              data-state={step.state.kind}
              data-current={step.current ? "true" : "false"}
              className={[
                "rounded px-2 py-1 text-xs",
                style.className,
                step.current ? "ring-2 ring-offset-1 ring-indigo-500" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="sr-only">
                {PHASE_LABEL[step.phase] ?? step.phase}: {style.label}
                {step.current ? "（現在）" : ""}
              </span>
              <span aria-hidden="true">{PHASE_LABEL[step.phase] ?? step.phase}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
