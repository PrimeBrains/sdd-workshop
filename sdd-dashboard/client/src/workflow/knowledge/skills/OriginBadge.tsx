/**
 * OriginBadge — スキルの由来分類（origin）を固定ラベルのバッジで表示する
 * （design.md「Feature: knowledge → OriginBadge」/ requirements 6.6）。
 *
 * origin → 厳密ラベル:
 *   "cc-sdd" → "cc-sdd 標準" / "custom" → "独自スキル" / null（および規約外の値）→ "未分類"。
 * 一覧のグループ見出し（6.4, 6.5）と詳細ヘッダ（6.6）で共用する。
 *
 * 純粋表示。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";

export interface OriginBadgeProps {
  /** SkillSummary / SkillDoc の origin（"cc-sdd" | "custom" | null、または規約外の文字列） */
  origin: string | null;
}

/** origin → 表示ラベル（cc-sdd / custom 以外はすべて未分類へフォールバック）。 */
export function originLabel(origin: string | null): string {
  if (origin === "cc-sdd") {
    return "cc-sdd 標準";
  }
  if (origin === "custom") {
    return "独自スキル";
  }
  return "未分類";
}

export function OriginBadge({ origin }: OriginBadgeProps): JSX.Element {
  return (
    <span
      data-testid="origin-badge"
      className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
    >
      {originLabel(origin)}
    </span>
  );
}

export default OriginBadge;
