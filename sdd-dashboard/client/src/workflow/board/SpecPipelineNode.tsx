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

import { badgeClass } from "@/shared/ui";

import type { SpecPipelineNodeData } from "@/workflow/board/buildBoardGraph";
import type { PhaseStepState } from "@/workflow/model/phaseModel";

/**
 * フェーズ段階状態 → テスト・支援技術向けの安定ラベルと表示クラス。
 * 配色はスケルトン .pipe .node 準拠（approved = ok 系の淡塗り、generated = warn 系。
 * unknown は診断状態として warn の強枠で generated と区別する）。
 */
const STEP_STYLE: Record<PhaseStepState["kind"], { label: string; className: string }> = {
  "not-generated": { label: "未生成", className: "border border-dashed border-line bg-white text-gray-mid" },
  generated: { label: "生成済み", className: "border border-warn-line bg-warn-soft text-warn-ink" },
  approved: { label: "承認済み", className: "border border-ok-line bg-ok-soft text-ok font-semibold" },
  unknown: { label: "不明", className: "border border-warn bg-warn-soft text-warn-ink" },
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
      className="rounded-md border border-line bg-white p-3 shadow-sm"
    >
      {/* 読取専用・one-node-per-lane モデル（エッジ無し）のため接続ハンドルは持たない（buildBoardGraph 注記参照）。 */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={`/specs/${feature}`}
          data-testid={`spec-lane-link-${feature}`}
          className="text-sm font-semibold text-ink hover:underline"
        >
          {feature}
        </Link>
        {pipeline.ready === true && (
          <span
            data-testid={`spec-lane-ready-${feature}`}
            className={badgeClass("ok")}
          >
            READY
          </span>
        )}
        {hasDiagnostics && (
          <span
            data-testid={`spec-lane-diagnostic-${feature}`}
            role="img"
            aria-label="診断あり"
            className={badgeClass("warn")}
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
                step.current ? "ring-2 ring-offset-1 ring-brand" : "",
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
