/**
 * SpecJsonWriter — spec.json の読取 → approvals 変換 → アトミック書込の共通基盤
 * （design.md SpecJsonWriter / ApprovalWriter / RollbackWriter ブロック。Requirements 9.4, 9.5, 10.1）。
 *
 * 制約:
 * - `phase` と `ready_for_implementation` は approvals フラグからの決定的導出のみで更新し、
 *   独立に設定しない（research.md Decision: derivePhase / deriveReady を承認・巻き戻しの
 *   2 書込経路で共有することで、フラグと phase の不整合を構造的に排除する）
 * - 未知フィールド（`app` や将来キー、approvals 内の未知キー）は逐語的に保持し、
 *   変更するのは approvals / phase / ready_for_implementation / updated_at のみ（9.5）
 * - 書込は SafePathGuard.writeFileAtomic 経由のみ（12.1, 12.4 の多層防御）
 * - クロックは注入可能（updated_at の厳密値テスト用）
 */
import { join } from "node:path";
import { AppError, ErrorCode } from "../../errors/codes.js";
import { parseSpecJson } from "../../parsers/spec-json.js";
import type { PhaseApproval, PhaseName, SpecApprovals, SpecSummary } from "../../types/spec.js";
import type { KiroScanner } from "../kiro-scanner.js";
import type { SafePathGuard } from "./safe-path.js";

/** 承認フェーズの正準順序（9.3 の先行フェーズ判定・approvals 書込順の唯一の定義） */
export const PHASE_ORDER: readonly PhaseName[] = ["requirements", "design", "tasks"];

/**
 * approvals フラグから `phase` を一意に導出する純粋関数（9.4。research.md Decision）。
 * 後段フェーズのフラグが優先される: tasks.approved → tasks.generated → design.generated
 * → requirements.generated → initialized。
 */
export function derivePhase(approvals: SpecApprovals): string {
  if (approvals.tasks.approved) {
    return "tasks-approved";
  }
  if (approvals.tasks.generated) {
    return "tasks-generated";
  }
  if (approvals.design.generated) {
    return "design-generated";
  }
  if (approvals.requirements.generated) {
    return "requirements-generated";
  }
  return "initialized";
}

/** 3 フェーズすべて approved の間のみ true（9.4） */
export function deriveReady(approvals: SpecApprovals): boolean {
  return PHASE_ORDER.every((phase) => approvals[phase].approved);
}

export interface SpecJsonWriter {
  /**
   * spec.json を読み取り、approvals に変換関数を適用し、phase / ready_for_implementation を
   * 導出してアトミックに書き戻す。変換関数の throw はそのまま透過する（書込は発生しない）。
   * @returns 書込後の内容から合成した SpecSummary（9.1 の「更新後メタデータ返却」基盤）
   * @throws AppError(SPEC_NOT_FOUND) feature が存在しない場合
   * @throws AppError(VALIDATION_FAILED) spec.json が欠落・不正で approvals を読めない場合
   */
  update(
    feature: string,
    transform: (current: SpecApprovals) => SpecApprovals,
  ): Promise<SpecSummary>;
}

export interface SpecJsonWriterDeps {
  scanner: KiroScanner;
  guard: SafePathGuard;
  /** クロック注入点（デフォルトは実時刻）。updated_at の生成に使う */
  now?: () => Date;
}

export function createSpecJsonWriter(deps: SpecJsonWriterDeps): SpecJsonWriter {
  const { scanner, guard } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async update(feature, transform) {
      const entry = await scanner.findSpecDir(feature);
      if (entry === null) {
        throw new AppError(ErrorCode.SPEC_NOT_FOUND, `spec が存在しません: ${feature}`);
      }

      // 読取: parseSpecJson で approvals の形を検証しつつ、未知フィールド保持のため
      // 生 JSON オブジェクトも保持する（パーサーは未知キーを返さないため）
      const source = await scanner.readSpecFile(feature, "spec.json");
      const { meta, diagnostics } = parseSpecJson(source);
      if (source === null || meta.approvals === null) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `spec.json が欠落しているか approvals が不正なため更新できません: ${feature}`,
          { diagnostics },
        );
      }
      const raw = JSON.parse(source) as Record<string, unknown>;

      // 変換 + 導出: phase / ready は導出関数のみで決まる（独立設定の経路を持たない）
      const nextApprovals = transform(meta.approvals);
      raw["approvals"] = mergeApprovals(raw["approvals"], nextApprovals);
      raw["phase"] = derivePhase(nextApprovals);
      raw["ready_for_implementation"] = deriveReady(nextApprovals);
      raw["updated_at"] = now().toISOString();

      // アトミック書込（SafePathGuard 経由 — .kiro/ 外へは決して書かない）
      const specPath = join(entry.dir, "spec.json");
      const content = `${JSON.stringify(raw, null, 2)}\n`;
      await guard.writeFileAtomic(specPath, content);

      return buildSummary(feature, entry.artifacts, content);
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * 生 approvals オブジェクトへ新フラグをマージする。
 * 各フェーズ内の未知キー（例: note）も逐語的に保持し、generated / approved のみ更新する（9.5）。
 */
function mergeApprovals(
  rawApprovals: unknown,
  next: Record<PhaseName, PhaseApproval>,
): Record<string, unknown> {
  const base =
    rawApprovals !== null && typeof rawApprovals === "object" && !Array.isArray(rawApprovals)
      ? { ...(rawApprovals as Record<string, unknown>) }
      : {};
  for (const phase of PHASE_ORDER) {
    const rawPhase = base[phase];
    const phaseBase =
      rawPhase !== null && typeof rawPhase === "object" && !Array.isArray(rawPhase)
        ? (rawPhase as Record<string, unknown>)
        : {};
    base[phase] = {
      ...phaseBase,
      generated: next[phase].generated,
      approved: next[phase].approved,
    };
  }
  return base;
}

/** 書込済み内容から SpecSummary を合成する（SpecService.buildSummary と同形） */
function buildSummary(
  feature: string,
  artifacts: SpecSummary["artifacts"],
  content: string,
): SpecSummary {
  const { meta, diagnostics } = parseSpecJson(content);
  return {
    feature,
    app: meta.app,
    phase: meta.phase,
    language: meta.language,
    approvals: meta.approvals,
    readyForImplementation: meta.readyForImplementation,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    artifacts,
    diagnostics,
  };
}
