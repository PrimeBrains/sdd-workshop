/**
 * スペックメタデータバッジ（design.md File Structure Plan「phase / approvals / ready 表示」、
 * Requirement 1.1）。
 *
 * spec.json 不正で phase / approvals / readyForImplementation が null の場合も
 * throw せず unknown 表示にフォールバックする（壊れたスペックを省略しないための前提）。
 * 純粋な表示コンポーネント。データ取得・解釈はしない。
 */
import type { JSX } from "react";
import type { PhaseName, SpecSummary } from "@contracts/spec";
import { badgeClass } from "@/shared/ui";

/** 承認バッジの表示順（spec.json approvals の語彙順） */
const APPROVAL_PHASES: readonly PhaseName[] = ["requirements", "design", "tasks"];

type ApprovalState = "approved" | "generated" | "pending" | "unknown";

const APPROVAL_STATE_LABEL: Record<ApprovalState, string> = {
  approved: "承認済",
  generated: "生成済",
  pending: "未生成",
  unknown: "不明",
};

const APPROVAL_STATE_CLASS: Record<ApprovalState, string> = {
  approved: badgeClass("ok"),
  generated: badgeClass("warn"),
  pending: badgeClass("gray"),
  unknown: badgeClass("gray"),
};

function approvalState(summary: SpecSummary, phase: PhaseName): ApprovalState {
  const approval = summary.approvals?.[phase];
  if (approval === undefined) return "unknown";
  if (approval.approved) return "approved";
  if (approval.generated) return "generated";
  return "pending";
}

type ReadyState = "ready" | "not-ready" | "unknown";

function readyState(summary: SpecSummary): ReadyState {
  if (summary.readyForImplementation === null) return "unknown";
  return summary.readyForImplementation ? "ready" : "not-ready";
}

const READY_LABEL: Record<ReadyState, string> = {
  ready: "実装可",
  "not-ready": "実装準備中",
  unknown: "実装可否不明",
};

const READY_CLASS: Record<ReadyState, string> = {
  ready: badgeClass("ok"),
  "not-ready": badgeClass("gray"),
  unknown: badgeClass("gray"),
};

/** phase はブランド系バッジ（意味マッピング表: sky → brand。スケルトン .badge の pill 形状 + brand 3 点セット） */
const PHASE_BADGE_CLASS =
  "inline-block px-[9px] py-px rounded-full text-[11px] font-semibold border align-middle bg-brand-soft text-chip-ink border-chip-line";

interface SpecMetaBadgesProps {
  summary: SpecSummary;
}

export function SpecMetaBadges({ summary }: SpecMetaBadgesProps): JSX.Element {
  const ready = readyState(summary);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span data-testid="phase-badge" className={PHASE_BADGE_CLASS}>
        {summary.phase ?? "不明"}
      </span>
      {APPROVAL_PHASES.map((phase) => {
        const state = approvalState(summary, phase);
        return (
          <span
            key={phase}
            data-testid={`approval-${phase}`}
            data-state={state}
            className={APPROVAL_STATE_CLASS[state]}
          >
            {phase}: {APPROVAL_STATE_LABEL[state]}
          </span>
        );
      })}
      <span
        data-testid="ready-badge"
        data-state={ready}
        className={READY_CLASS[ready]}
      >
        {READY_LABEL[ready]}
      </span>
    </span>
  );
}
