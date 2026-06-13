/**
 * SpecWorkflowActions — レビュー画面ヘッダ（SpecActionSlot）へ重ねる承認・手戻り操作 UI
 * （design.md「SpecWorkflowActions + ConfirmDialog ...」/ Requirements 2.1, 3.1, 9.2, 9.3）。
 *
 * ボタン可視条件 + 確認ゲート基盤の接続:
 * - 承認ボタンは `approvablePhase(spec) !== null` のときだけ表示する（2.1）
 * - 手戻りボタンは生成済みまたは承認済みフェーズが 1 つ以上あるとき表示する（3.1）
 * - 承認ボタン押下で `ApproveDialog`（4.2）、手戻りボタン押下で `RollbackDialog`（4.3）を開く
 *
 * `ConfirmDialog` の構造的保証（onConfirm 経由でのみ書込）により、各ダイアログは onConfirm に
 * mutation を差し込むだけで誤発火しない。既存レビュー画面は変更しない（9.2）。
 */
import { useState, type JSX } from "react";
import type { PhaseName, SpecApprovals, SpecSummary } from "@contracts/spec";
import { useSpecs } from "@/api/useSpecs";
import { btnClass } from "@/shared/ui";
import { approvablePhase } from "@/workflow/model/phaseModel";
import { ApproveDialog } from "./ApproveDialog";
import { RollbackDialog } from "./RollbackDialog";

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

  const closeDialog = () => setDialog(null);

  return (
    <>
      {showApprove ? (
        <button
          type="button"
          onClick={() => setDialog("approve")}
          className={btnClass("primary")}
        >
          承認
        </button>
      ) : null}
      {showRollback ? (
        <button
          type="button"
          onClick={() => setDialog("rollback")}
          className={btnClass("danger")}
        >
          手戻り
        </button>
      ) : null}

      {dialog === "approve" && phase !== null ? (
        <ApproveDialog feature={feature} phase={phase} onClose={closeDialog} />
      ) : null}

      {dialog === "rollback" ? (
        <RollbackDialog feature={feature} spec={spec} onClose={closeDialog} />
      ) : null}
    </>
  );
}
