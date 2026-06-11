/**
 * NextCommand — フェーズ → 次 CLI コマンド対応表の唯一の定義（Single Source of Truth）
 * （design.md「Model 層（純粋関数）」NextCommand / Requirements 2.5, 3.5, 4.2）。
 *
 * 純粋関数・定数のみ。HTTP・DOM・FS アクセスを持たない。
 * 承認後・手戻り後・ヘルプ（PHASE_COMMANDS）の 3 用途がこのファイルを唯一の出典とする。
 */
import type { PhaseName } from "@contracts/spec";

/** 承認後に進むフェーズの生成コマンド（feature 引数なしの素のテンプレート）。 */
const APPROVAL_NEXT_COMMAND: Readonly<Record<PhaseName, string>> = {
  requirements: "/kiro-spec-design",
  design: "/kiro-spec-tasks",
  tasks: "/kiro-impl",
};

/** 巻き戻し先フェーズの再生成コマンド（feature 引数なしの素のテンプレート）。 */
const ROLLBACK_NEXT_COMMAND: Readonly<Record<PhaseName, string>> = {
  requirements: "/kiro-spec-requirements",
  design: "/kiro-spec-design",
  tasks: "/kiro-spec-tasks",
};

/**
 * 承認後に実行すべき次の CLI コマンド（次フェーズへ進む生成コマンド + feature）。
 * 例: nextCommandAfterApproval("requirements", "sdd-workflow-ui")
 *     === "/kiro-spec-design sdd-workflow-ui"
 */
export function nextCommandAfterApproval(
  phase: PhaseName,
  feature: string,
): string {
  return `${APPROVAL_NEXT_COMMAND[phase]} ${feature}`;
}

/**
 * 手戻り後に実行すべき次の CLI コマンド（巻き戻し先フェーズの再生成コマンド + feature）。
 * 例: nextCommandAfterRollback("requirements", "sdd-workflow-ui")
 *     === "/kiro-spec-requirements sdd-workflow-ui"
 */
export function nextCommandAfterRollback(
  targetPhase: PhaseName,
  feature: string,
): string {
  return `${ROLLBACK_NEXT_COMMAND[targetPhase]} ${feature}`;
}

/**
 * ヘルプ用: cc-sdd フローのフェーズ → { 成果物, CLI コマンド } の固定記述（4.2）。
 * help タスク（5.1 / HelpPage）がフェーズ別カードを描画する唯一の出典であり、
 * help コンテンツ側で同一テーブルを複製しない。command は一般ヘルプのため feature 引数なし。
 */
export const PHASE_COMMANDS: ReadonlyArray<{
  phase: string;
  artifact: string;
  command: string;
}> = [
  {
    phase: "Discovery",
    artifact: "brief.md / roadmap.md",
    command: "/kiro-discovery",
  },
  {
    phase: "Requirements",
    artifact: "requirements.md",
    command: "/kiro-spec-requirements",
  },
  {
    phase: "Design",
    artifact: "design.md",
    command: "/kiro-spec-design",
  },
  {
    phase: "Tasks",
    artifact: "tasks.md",
    command: "/kiro-spec-tasks",
  },
  {
    phase: "Implementation",
    artifact: "実装コード",
    command: "/kiro-impl",
  },
];
