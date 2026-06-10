/**
 * ApprovalWriter — 承認フラグ更新（design.md SpecJsonWriter / ApprovalWriter ブロック。
 * Requirements 9.1, 9.2, 9.3）。
 *
 * バリデーション（承認時のみ。違反は AppError → HTTP 409）:
 * - 対象フェーズの generated === true（9.2: APPROVAL_NOT_GENERATED）
 * - requirements → design → tasks の順で先行フェーズすべてが approved === true
 *   （9.3: APPROVAL_ORDER_VIOLATION）
 * 承認解除（approved=false）は順序検証なしで通し、ready_for_implementation は
 * SpecJsonWriter の導出で false に再計算される（9.4）。
 *
 * 監査（12.3 申し送り）: 拒否・失敗を含む全試行を throw の前に audit.record する。
 * AppError は outcome=rejected + errorCode、未知例外は outcome=failed。
 */
import { AppError, ErrorCode } from "../../errors/codes.js";
import type { PhaseName, SpecApprovals, SpecSummary } from "../../types/spec.js";
import type { AuditLog } from "./audit-log.js";
import { PHASE_ORDER, type SpecJsonWriter } from "./spec-json-writer.js";

export interface ApprovalWriter {
  /**
   * 指定フェーズの approved フラグを更新し、更新後の SpecSummary を返す（9.1）。
   * @throws AppError(APPROVAL_NOT_GENERATED | APPROVAL_ORDER_VIOLATION) 承認の前提違反（9.2, 9.3）
   * @throws AppError(SPEC_NOT_FOUND | VALIDATION_FAILED) SpecJsonWriter からの透過
   */
  updateApproval(feature: string, phase: PhaseName, approved: boolean): Promise<SpecSummary>;
}

export interface ApprovalWriterDeps {
  specJsonWriter: SpecJsonWriter;
  audit: AuditLog;
}

export function createApprovalWriter(deps: ApprovalWriterDeps): ApprovalWriter {
  const { specJsonWriter, audit } = deps;

  return {
    async updateApproval(feature, phase, approved) {
      // 監査の対象パスは .kiro/ 起点の正準相対パス（SafePathGuard の相対解釈と同語彙）。
      // 不在 feature の拒否でも一意に記録できる
      const targetPath = `specs/${feature}/spec.json`;
      try {
        const summary = await specJsonWriter.update(feature, (current) => {
          if (approved) {
            assertApprovable(current, phase);
          }
          return { ...current, [phase]: { ...current[phase], approved } };
        });
        audit.record({ operation: "approval-update", targetPath, outcome: "success" });
        return summary;
      } catch (error) {
        // 拒否を含む全試行を記録してから透過する（12.3）
        if (error instanceof AppError) {
          audit.record({
            operation: "approval-update",
            targetPath,
            outcome: "rejected",
            errorCode: error.code,
          });
        } else {
          audit.record({ operation: "approval-update", targetPath, outcome: "failed" });
        }
        throw error;
      }
    },
  };
}

/**
 * 承認の前提条件を検査する。generated 検査（9.2）を順序検査（9.3）より優先する
 * （未生成フェーズはそもそも承認対象になり得ないため）。
 */
function assertApprovable(approvals: SpecApprovals, phase: PhaseName): void {
  if (!approvals[phase].generated) {
    throw new AppError(
      ErrorCode.APPROVAL_NOT_GENERATED,
      `フェーズ ${phase} は generated=false のため承認できません`,
      { phase },
    );
  }
  for (const preceding of PHASE_ORDER) {
    if (preceding === phase) {
      break;
    }
    if (!approvals[preceding].approved) {
      throw new AppError(
        ErrorCode.APPROVAL_ORDER_VIOLATION,
        `先行フェーズ ${preceding} が未承認のため ${phase} を承認できません`,
        { phase, unapprovedPreceding: preceding },
      );
    }
  }
}
