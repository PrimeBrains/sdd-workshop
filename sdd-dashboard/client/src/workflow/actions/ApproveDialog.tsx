/**
 * ApproveDialog — 承認の確認ステップ + 承認実行 UI
 * （design.md「Feature: actions → ApproveDialog」/ Requirements 2.2, 2.3, 2.4, 2.6）。
 *
 * 構造的保証（9.3）: 書込は `ConfirmDialog` の `onConfirm` 経由（= 承認ボタンのクリック）でのみ
 * 起こる。マウント・Esc・背景クリック・キャンセルはいずれも `onClose` を呼ぶだけで PUT を発行しない。
 *
 * - 確認ステップ（2.2）: 状態変更の前に対象 feature / phase / ドキュメント名を表示する
 * - 確定（2.4）: `useApprovalMutation` を実行する。成功時はキャッシュが更新後 SpecSummary を反映し
 *   （1.2 で実装済）、ダイアログは簡潔な成功確認表示へ遷移する（4.4 が次コマンド案内へ拡張）
 * - 拒否（2.6）: ダイアログは閉じず、ConfirmDialog の error 領域が code + message（422 は fieldErrors）
 *   を表示する。承認済みとしての表示は行わない（楽観更新なし）。再試行・キャンセルを選べる
 */
import { type JSX } from "react";
import type { PhaseName } from "@contracts/spec";
import { useApprovalMutation } from "@/workflow/api/useApprovalMutation";
import { nextCommandAfterApproval } from "@/workflow/model/nextCommand";
import { ConfirmDialog } from "./ConfirmDialog";
import { NextActionGuide } from "./NextActionGuide";

interface ApproveDialogProps {
  feature: string;
  /** 承認可能フェーズ（SpecWorkflowActions が approvablePhase で算出して渡す）。 */
  phase: PhaseName;
  onClose: () => void;
}

/** フェーズ名 → 対象ドキュメントのファイル名（確認ステップで対象を明示する）。 */
const PHASE_DOCUMENT: Record<PhaseName, string> = {
  requirements: "requirements.md",
  design: "design.md",
  tasks: "tasks.md",
};

export function ApproveDialog({ feature, phase, onClose }: ApproveDialogProps): JSX.Element {
  const mutation = useApprovalMutation(feature);

  // 成功表示: キャッシュは mutation が更新済み。次フェーズへ進む CLI コマンドを案内する（2.5 / 4.4）。
  if (mutation.isSuccess) {
    return (
      <NextActionGuide
        ariaLabel={`承認完了: ${feature}`}
        heading="承認しました"
        command={nextCommandAfterApproval(phase, feature)}
        summary={
          <>
            <span className="font-mono">{feature}</span> の{" "}
            <span className="font-mono">{PHASE_DOCUMENT[phase]}</span> を承認しました。
          </>
        }
        onClose={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      title={`承認: ${feature}`}
      confirmLabel="承認する"
      pending={mutation.isPending}
      error={mutation.error ?? null}
      onConfirm={() => mutation.mutate({ phase })}
      // pending 中のキャンセルは閉じない（送信中の中断を避ける）。キャンセルは PUT を発行しない（2.3）。
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <p>
        対象スペック: <span className="font-mono">{feature}</span>
      </p>
      <p className="mt-1">
        フェーズ: <span className="font-mono">{phase}</span>
      </p>
      <p className="mt-1">
        ドキュメント: <span className="font-mono">{PHASE_DOCUMENT[phase]}</span>
      </p>
    </ConfirmDialog>
  );
}
