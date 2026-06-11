/**
 * helpContent — /help 画面のローカル静的コンテンツ（tasks.md 5.1 / requirements 4.1, 4.2 /
 * design.md「Feature: help」HelpContent）。
 *
 * - cc-sdd フローの 8 ステップ順序（4.1）と、フェーズ別カードの「承認の意味」散文を保持する。
 * - 成果物名・CLI コマンドは唯一の出典 `PHASE_COMMANDS`（nextCommand.ts）から読む（ここに複製しない）。
 *
 * ローカル完結: 外部リンク・外部画像・サーバ fetch・dangerouslySetInnerHTML を含まない。
 */
import type { PhaseName } from "@contracts/spec";

/**
 * cc-sdd フローの順序立った 8 ステップ（4.1）。
 * 3 つの「承認」は各ドキュメントフェーズの間に挟まる（要件の厳密な並び）。
 */
export const FLOW_STEPS = [
  "Discovery",
  "Requirements",
  "承認",
  "Design",
  "承認",
  "Tasks",
  "承認",
  "実装",
] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];

/**
 * フェーズ名 → 承認の意味（散文）。`PHASE_COMMANDS` に含まれない説明テキストのみをローカル保持する。
 * Discovery / Implementation は承認ゲートを持たないため、フローにおける位置づけの散文を入れる。
 */
export const PHASE_APPROVAL_MEANING: Readonly<Record<string, string>> = {
  Discovery:
    "アイデアを起点に進め方（単一スペック / 複数スペック）を判定する探索フェーズ。承認ゲートは持たず、後続フェーズの土台を用意する。",
  Requirements:
    "要件の承認は「何を作るか（WHAT）」の合意を意味する。承認後に初めて設計フェーズへ進める。",
  Design:
    "設計の承認は「どう作るか（HOW）」の合意を意味する。承認後に初めてタスク分解へ進める。",
  Tasks:
    "タスクの承認は実装計画の合意を意味する。承認後に初めて実装フェーズへ進める。",
  Implementation:
    "承認済みタスクを 1 件ずつ実装し、レビューと検証ゲートを通す実行フェーズ。フェーズ自体の承認ゲートは持たない。",
};

/** approval meaning が存在する承認ゲート付きフェーズ（型安全な参照のためのキー集合）。 */
export type ApprovalPhase = PhaseName;
