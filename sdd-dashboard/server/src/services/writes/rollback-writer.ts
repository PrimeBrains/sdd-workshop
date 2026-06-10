/**
 * RollbackWriter — フェーズ巻き戻し（design.md SpecJsonWriter / ApprovalWriter / RollbackWriter
 * ブロック。Requirements 10.1, 10.2, 10.3, 10.4）。
 *
 * 巻き戻しの意味論（10.1, 10.2）:
 * - 対象フェーズ: `approved = false`（generated は維持 — 成果物はやり直しの起点として残る）
 * - 後続フェーズ: `generated` / `approved` の両フラグを false
 * - `phase` / `ready_for_implementation` は SpecJsonWriter の derivePhase / deriveReady で
 *   フラグから導出され、結果として ready は必ず false になる
 *
 * バリデーション（10.3）:
 * - 不明フェーズ名: AppError(VALIDATION_FAILED) → HTTP 422（route 層の zod と同コードの多層防御）
 * - 不在スペック: SpecJsonWriter からの AppError(SPEC_NOT_FOUND) → HTTP 404 を透過
 *
 * 書込対象は spec.json のみ（10.4: 成果物 md には一切触れない — SpecJsonWriter は
 * spec.json 以外への書込経路を持たない）。
 *
 * 監査（12.3 申し送り）: 拒否・失敗を含む全試行を throw の前に audit.record する。
 * AppError は outcome=rejected + errorCode、未知例外は outcome=failed。
 */
import { AppError, ErrorCode } from "../../errors/codes.js";
import type { PhaseName, SpecApprovals, SpecSummary } from "../../types/spec.js";
import type { AuditLog } from "./audit-log.js";
import { PHASE_ORDER, type SpecJsonWriter } from "./spec-json-writer.js";

export interface RollbackWriter {
  /**
   * 対象フェーズへ巻き戻し、更新後の SpecSummary を返す（10.1, 10.2）。
   * @throws AppError(VALIDATION_FAILED) targetPhase が不明なフェーズ名の場合（10.3）
   * @throws AppError(SPEC_NOT_FOUND | VALIDATION_FAILED) SpecJsonWriter からの透過（10.3）
   */
  rollback(feature: string, targetPhase: PhaseName): Promise<SpecSummary>;
}

export interface RollbackWriterDeps {
  specJsonWriter: SpecJsonWriter;
  audit: AuditLog;
}

export function createRollbackWriter(deps: RollbackWriterDeps): RollbackWriter {
  const { specJsonWriter, audit } = deps;

  return {
    async rollback(feature, targetPhase) {
      // 監査の対象パスは .kiro/ 起点の正準相対パス（ApprovalWriter と同語彙）
      const targetPath = `specs/${feature}/spec.json`;
      try {
        // ランタイム入力（JSON 由来）に対する不明フェーズ名検査。
        // 書込前に拒否するため transform より先に検査する（10.3, 10.4）
        assertKnownPhase(targetPhase);

        const summary = await specJsonWriter.update(feature, (current) =>
          rollbackApprovals(current, targetPhase),
        );
        audit.record({ operation: "rollback", targetPath, outcome: "success" });
        return summary;
      } catch (error) {
        // 拒否を含む全試行を記録してから透過する（12.3）
        if (error instanceof AppError) {
          audit.record({
            operation: "rollback",
            targetPath,
            outcome: "rejected",
            errorCode: error.code,
          });
        } else {
          audit.record({ operation: "rollback", targetPath, outcome: "failed" });
        }
        throw error;
      }
    },
  };
}

/** PHASE_ORDER にないフェーズ名を 422 相当で拒否する（10.3） */
function assertKnownPhase(targetPhase: string): asserts targetPhase is PhaseName {
  if (!(PHASE_ORDER as readonly string[]).includes(targetPhase)) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      `不明な巻き戻し対象フェーズです: ${targetPhase}`,
      { fieldErrors: { targetPhase: [`requirements | design | tasks のいずれかを指定してください`] } },
    );
  }
}

/**
 * 巻き戻し後の approvals を計算する純粋関数（10.1）。
 * 対象フェーズは approved のみ false、対象より後のフェーズは両フラグ false、
 * 対象より前のフェーズは不変。
 */
function rollbackApprovals(current: SpecApprovals, targetPhase: PhaseName): SpecApprovals {
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);
  const next = { ...current };
  for (const [index, phase] of PHASE_ORDER.entries()) {
    if (index === targetIndex) {
      next[phase] = { ...current[phase], approved: false };
    } else if (index > targetIndex) {
      next[phase] = { generated: false, approved: false };
    }
  }
  return next;
}
