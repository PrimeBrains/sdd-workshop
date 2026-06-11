/**
 * PhaseModel — spec.json の approvals からパイプライン段階表示と承認可能条件を導出する
 * 唯一の解釈点（design.md「Model 層（純粋関数）」PhaseModel / Requirements 1.1, 1.2, 2.1）。
 *
 * 純粋関数のみ。HTTP・DOM・FS アクセスを持たず、入力は SpecSummary のみ。
 * approvablePhase の非 null 条件は sdd-core の承認バリデーション（9.2, 9.3）と同条件:
 * 「生成済み・未承認・先行フェーズすべて承認済み」のフェーズに限る。
 */
import type { PhaseName, SpecSummary } from "@contracts/spec";

/** 1 段階の表示状態。unknown は approvals 読取不能（診断あり、1.3）。 */
export type PhaseStepState =
  | { kind: "not-generated" }
  | { kind: "generated" } // 生成済み・未承認
  | { kind: "approved" }
  | { kind: "unknown" }; // approvals 読取不能（診断あり）

/** パイプライン全体の表示ビュー。steps は常に 4 要素・固定順、current は高々 1 つ。 */
export interface PipelineView {
  steps: Array<{ phase: PhaseName | "implementation"; state: PhaseStepState; current: boolean }>;
  ready: boolean | null; // null = 不明
}

/** ドキュメントフェーズの固定順（承認順序制約と一致）。 */
const DOC_PHASES: readonly PhaseName[] = ["requirements", "design", "tasks"] as const;

const NOT_GENERATED: PhaseStepState = { kind: "not-generated" };
const GENERATED: PhaseStepState = { kind: "generated" };
const APPROVED: PhaseStepState = { kind: "approved" };
const UNKNOWN: PhaseStepState = { kind: "unknown" };

/** ドキュメントフェーズの approvals フラグ → 段階状態。 */
function docPhaseState(generated: boolean, approved: boolean): PhaseStepState {
  if (approved) return APPROVED;
  if (generated) return GENERATED;
  return NOT_GENERATED;
}

/**
 * implementation 段階の状態を readyForImplementation から導出する。
 * approvals が読取可能であることが前提（null 時は呼び出し側が unknown を割り当てる）。
 * true → approved / false → not-generated / null → unknown。
 */
function implementationState(ready: boolean | null): PhaseStepState {
  if (ready === null) return UNKNOWN;
  return ready ? APPROVED : NOT_GENERATED;
}

/**
 * SpecSummary から PipelineView を導出する。
 * approvals が null の場合は全 4 段階を unknown・ready を null・current 無しで返す（1.3）。
 * current は固定順 [requirements, design, tasks, implementation] で最初に
 * approved でない段階に立てる（全 approved なら current 無し）。
 */
export function buildPipelineView(spec: SpecSummary): PipelineView {
  const { approvals, readyForImplementation } = spec;

  if (approvals === null) {
    return {
      steps: [
        { phase: "requirements", state: UNKNOWN, current: false },
        { phase: "design", state: UNKNOWN, current: false },
        { phase: "tasks", state: UNKNOWN, current: false },
        { phase: "implementation", state: UNKNOWN, current: false },
      ],
      ready: null,
    };
  }

  const states: PhaseStepState[] = [
    ...DOC_PHASES.map((phase) => docPhaseState(approvals[phase].generated, approvals[phase].approved)),
    implementationState(readyForImplementation),
  ];

  // current = 固定順で最初に approved でない段階（全 approved なら -1 = 無し）。
  const currentIndex = states.findIndex((state) => state.kind !== "approved");

  const phases: Array<PhaseName | "implementation"> = [...DOC_PHASES, "implementation"];
  const steps = phases.map((phase, index) => ({
    phase,
    state: states[index] as PhaseStepState,
    current: index === currentIndex,
  }));

  return { steps, ready: readyForImplementation };
}

/**
 * 現在承認操作を提示すべきフェーズ（生成済み・未承認・先行フェーズすべて承認済み）。
 * なければ null。implementation は承認対象外。approvals null は null。
 * sdd-core の承認バリデーション（9.2, 9.3）と同条件。
 */
export function approvablePhase(spec: SpecSummary): PhaseName | null {
  const { approvals } = spec;
  if (approvals === null) return null;

  for (const phase of DOC_PHASES) {
    const { generated, approved } = approvals[phase];
    if (approved) continue; // 承認済みは次フェーズの先行条件として通過
    // 未承認フェーズに到達。生成済みなら承認可能、未生成なら以降は先行未承認で承認不可。
    return generated ? phase : null;
  }
  return null;
}
