/**
 * SpecWorkflowActions — レビュー画面ヘッダ（SpecActionSlot）へ重ねる承認・手戻り操作 UI
 * （design.md「SpecWorkflowActions + ConfirmDialog ...」/ Requirements 2.1, 3.1, 9.2, 9.3）。
 *
 * 本タスク（4.1）の範囲はボタン可視条件 + 確認ゲート基盤の接続のみ:
 * - 承認ボタンは `approvablePhase(spec) !== null` のときだけ表示する（2.1）
 * - 手戻りボタンは生成済みまたは承認済みフェーズが 1 つ以上あるとき表示する（3.1）
 * - ボタン押下で `ConfirmDialog` を開き、対象 feature / phase を表示する
 *
 * 実行（PUT approvals / POST rollback・対象選択・影響表示）は 4.2/4.3 へ意図的に繰り延べる。
 * 本タスクでは確定コールバックはダイアログを閉じるだけで、書込は一切行わない。
 * `ConfirmDialog` の構造的保証（onConfirm 経由でのみ書込）により、4.2/4.3 は onConfirm に
 * mutation を差し込むだけで誤発火しない。既存レビュー画面は変更しない（9.2）。
 */
import { useState, type JSX } from "react";
import type { PhaseName, SpecApprovals, SpecSummary } from "@contracts/spec";
import { useSpecs } from "@/api/useSpecs";
import { approvablePhase } from "@/workflow/model/phaseModel";
import { ApproveDialog } from "./ApproveDialog";
import { ConfirmDialog } from "./ConfirmDialog";

interface SpecWorkflowActionsProps {
  feature: string;
}

type DialogKind = "approve" | "rollback";

const DOC_PHASES: readonly PhaseName[] = ["requirements", "design", "tasks"] as const;

/** 生成済みまたは承認済みのフェーズが 1 つ以上あるか（手戻り対象が存在するか・3.1）。 */
function hasRollbackTarget(approvals: SpecApprovals | null): boolean {
  if (approvals === null) return false;
  return DOC_PHASES.some((phase) => approvals[phase].generated || approvals[phase].approved);
}

export function SpecWorkflowActions({ feature }: SpecWorkflowActionsProps): JSX.Element | null {
  const { data: specs } = useSpecs();
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const spec: SpecSummary | undefined = specs?.find((entry) => entry.feature === feature);
  // specs 未取得 / 該当 feature 不在のときは何も描画しない（gracefully）。
  if (spec === undefined) return null;

  const phase = approvablePhase(spec);
  const showApprove = phase !== null;
  const showRollback = hasRollbackTarget(spec.approvals);

  if (!showApprove && !showRollback) return null;

  // 4.2/4.3 へ繰り延べ: 確定では書込を行わずダイアログを閉じるだけ。
  const closeDialog = () => setDialog(null);

  return (
    <>
      {showApprove ? (
        <button
          type="button"
          onClick={() => setDialog("approve")}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          承認
        </button>
      ) : null}
      {showRollback ? (
        <button
          type="button"
          onClick={() => setDialog("rollback")}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          手戻り
        </button>
      ) : null}

      {dialog === "approve" && phase !== null ? (
        <ApproveDialog feature={feature} phase={phase} onClose={closeDialog} />
      ) : null}

      {dialog === "rollback" ? (
        <ConfirmDialog
          title="手戻りの確認"
          confirmLabel="手戻りする"
          pending={false}
          error={null}
          onConfirm={closeDialog}
          onCancel={closeDialog}
        >
          <p>
            対象スペック: <span className="font-mono">{feature}</span>
          </p>
          <p className="mt-1 text-gray-500">
            巻き戻し先フェーズの選択と影響表示は後続タスクで実装します。
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
