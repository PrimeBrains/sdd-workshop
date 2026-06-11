/**
 * RollbackImpact — 巻き戻し実行前の影響範囲（表示専用予測）の唯一の導出点
 * （design.md「Model 層（純粋関数）」RollbackImpact / Requirements 3.2）。
 *
 * sdd-core RollbackWriter のセマンティクス（10.1, 10.2）をそのまま写像する:
 *   - 巻き戻し先（target）フェーズ: approved → false（generated は維持）
 *   - 後続の各 doc フェーズ: generated・approved の両フラグ → false
 *   - ready_for_implementation → false
 * 表示専用であり、実行結果は常にサーバー返却の SpecSummary で上書きされる。
 *
 * 純粋関数。HTTP・DOM・FS アクセスを持たない。nextCommand は NextCommand
 * （nextCommandAfterRollback）を唯一の出典とし、ここでコマンド文字列を複製しない。
 */
import type { PhaseName, SpecSummary } from "@contracts/spec";

import { nextCommandAfterRollback } from "./nextCommand";

/** doc フェーズの固定順序（spec.json approvals のフェーズ順序制約と一致）。 */
const DOC_PHASES: readonly PhaseName[] = ["requirements", "design", "tasks"];

/** 巻き戻し影響予測ビュー（表示専用）。 */
export interface RollbackImpactView {
  targetPhase: PhaseName;
  /** 承認が解除されるフェーズ（target 含む、現在承認済みのもののみ・DOC 順） */
  revokedApproval: PhaseName[];
  /** 生成・承認の両フラグがクリアされる後続フェーズ（現在生成済みのもの・DOC 順） */
  clearedPhases: PhaseName[];
  /** 現在 ready_for_implementation = true から false になるか */
  losesReady: boolean;
  /** 巻き戻し先フェーズの再生成コマンド（NextCommand から導出） */
  nextCommand: string;
}

/**
 * 巻き戻し先フェーズへのロールバックがもたらす影響範囲を予測する（表示専用）。
 * sdd-core RollbackWriter のセマンティクスに厳密一致する。
 */
export function computeRollbackImpact(
  spec: SpecSummary,
  targetPhase: PhaseName,
): RollbackImpactView {
  const targetIndex = DOC_PHASES.indexOf(targetPhase);
  const subsequent = DOC_PHASES.slice(targetIndex + 1);
  const approvals = spec.approvals;

  const revokedApproval = [targetPhase, ...subsequent].filter(
    (phase) => approvals?.[phase].approved === true,
  );

  const clearedPhases = subsequent.filter(
    (phase) => approvals?.[phase].generated === true,
  );

  return {
    targetPhase,
    revokedApproval,
    clearedPhases,
    losesReady: spec.readyForImplementation === true,
    nextCommand: nextCommandAfterRollback(targetPhase, spec.feature),
  };
}
