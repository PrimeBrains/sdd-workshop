/**
 * RollbackDialog — 手戻りの確認ステップ + 巻き戻し実行 UI
 * （design.md「Feature: actions → RollbackDialog」/ Requirements 3.1, 3.2, 3.3, 3.4, 3.6）。
 *
 * 構造的保証（9.3）: 書込は `ConfirmDialog` の `onConfirm` 経由（= 巻き戻しボタンのクリック）でのみ
 * 起こる。マウント・Esc・背景クリック・キャンセルはいずれも `onClose` を呼ぶだけで POST を発行しない。
 *
 * - 対象フェーズ選択（3.1）: requirements / design / tasks のうち生成済み（または承認済み）の
 *   フェーズのみ選択可。それ以外は無効化する。選択はローカル状態で保持する
 * - 影響表示（3.2）: 選択フェーズに対し `computeRollbackImpact` の結果を実行前に可視化する。
 *   承認解除されるフェーズ・再生成が必要な後続フェーズ・実装準備フラグ解除を列挙する。
 *   影響は computeRollbackImpact が唯一の出典であり、ここで再計算しない
 * - 確定（3.4）: `useRollbackMutation` を実行する。成功時はキャッシュが更新後 SpecSummary を反映し
 *   （1.2 で実装済）、ダイアログは簡潔な成功確認表示へ遷移する（4.4 が次コマンド案内へ拡張）
 * - 拒否（3.6）: ダイアログは閉じず、ConfirmDialog の error 領域が code + message（422 は fieldErrors）
 *   を表示する。巻き戻し済みとしての表示は行わない（楽観更新なし・状態維持）
 */
import { useState, type JSX } from "react";
import type { PhaseName, SpecSummary } from "@contracts/spec";
import { useRollbackMutation } from "@/workflow/api/useRollbackMutation";
import { computeRollbackImpact } from "@/workflow/model/rollbackImpact";
import { nextCommandAfterRollback } from "@/workflow/model/nextCommand";
import { ConfirmDialog } from "./ConfirmDialog";
import { NextActionGuide } from "./NextActionGuide";

interface RollbackDialogProps {
  feature: string;
  /** 影響算出と選択可能フェーズの判定に SpecSummary が必要。 */
  spec: SpecSummary;
  onClose: () => void;
}

/** 巻き戻し先候補（spec.json approvals のフェーズ順序制約と一致）。 */
const DOC_PHASES: readonly PhaseName[] = ["requirements", "design", "tasks"] as const;

/** 生成済みまたは承認済みのフェーズのみ巻き戻し先として選択可（3.1）。 */
function isSelectable(spec: SpecSummary, phase: PhaseName): boolean {
  const approval = spec.approvals?.[phase];
  if (approval === undefined) return false;
  return approval.generated || approval.approved;
}

export function RollbackDialog({ feature, spec, onClose }: RollbackDialogProps): JSX.Element {
  const mutation = useRollbackMutation(feature);

  const selectablePhases = DOC_PHASES.filter((phase) => isSelectable(spec, phase));
  // 初期選択は最も早い選択可能フェーズ（影響が最大のフェーズ＝先頭）。候補が無いことは
  // SpecWorkflowActions の表示条件（≥1 生成・承認済み）により起こらない。
  const [target, setTarget] = useState<PhaseName | null>(selectablePhases[0] ?? null);

  // 成功表示: キャッシュは mutation が更新済み。巻き戻し先フェーズの再生成 CLI コマンドを案内する（3.5 / 4.4）。
  // target は mutate のガード（onConfirm）により成功時点で常に非 null。
  if (mutation.isSuccess && target !== null) {
    return (
      <NextActionGuide
        ariaLabel={`手戻り完了: ${feature}`}
        heading="巻き戻しました"
        command={nextCommandAfterRollback(target, feature)}
        summary={
          <>
            <span className="font-mono">{feature}</span> を{" "}
            <span className="font-mono">{target}</span> まで巻き戻しました。
          </>
        }
        onClose={onClose}
      />
    );
  }

  // 表示専用の影響予測（実行結果は常にサーバー返却で上書きされる）。
  const impact = target !== null ? computeRollbackImpact(spec, target) : null;

  return (
    <ConfirmDialog
      title={`手戻り: ${feature}`}
      confirmLabel="巻き戻す"
      pending={mutation.isPending}
      error={mutation.error ?? null}
      // 巻き戻し先未選択時は何もしない（書込はここを起点にのみ起こる・9.3）。
      onConfirm={() => {
        if (target !== null) mutation.mutate({ targetPhase: target });
      }}
      // pending 中のキャンセルは閉じない（送信中の中断を避ける）。キャンセルは POST を発行しない（3.3）。
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <p>
        対象スペック: <span className="font-mono">{feature}</span>
      </p>

      <fieldset className="mt-3">
        <legend className="font-medium text-gray-900">巻き戻し先フェーズ</legend>
        <div className="mt-2 space-y-1">
          {DOC_PHASES.map((phase) => {
            const selectable = isSelectable(spec, phase);
            return (
              <label
                key={phase}
                className={
                  selectable
                    ? "flex items-center gap-2"
                    : "flex items-center gap-2 text-gray-400"
                }
              >
                <input
                  type="radio"
                  name="rollback-target"
                  value={phase}
                  checked={target === phase}
                  disabled={!selectable}
                  onChange={() => setTarget(phase)}
                />
                <span className="font-mono">{phase}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {impact !== null ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="font-medium text-amber-900">この手戻りの影響</p>
          {impact.revokedApproval.length > 0 ? (
            <p data-testid="rollback-impact-revoked" className="mt-1 text-amber-900">
              承認解除: <span className="font-mono">{impact.revokedApproval.join(", ")}</span>
            </p>
          ) : null}
          {impact.clearedPhases.length > 0 ? (
            <p data-testid="rollback-impact-cleared" className="mt-1 text-amber-900">
              再生成が必要:{" "}
              <span className="font-mono">{impact.clearedPhases.join(", ")}</span>
            </p>
          ) : null}
          {impact.losesReady ? (
            <p data-testid="rollback-impact-ready" className="mt-1 text-amber-900">
              実装準備解除
            </p>
          ) : null}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
