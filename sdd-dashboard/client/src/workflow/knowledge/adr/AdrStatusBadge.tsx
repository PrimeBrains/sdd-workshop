/**
 * AdrStatusBadge — ADR の status を色分けバッジで表示する原子コンポーネント
 * （design.md「Feature: knowledge → AdrStatusBadge」/ requirements 7.1）。
 *
 * status → 色分け:
 *   "proposed" / "accepted" / "deprecated" / "superseded" にそれぞれ固有のスタイルを与える。
 *   規約外の status（未知値）は中立フォールバックスタイルで描画する。
 * いずれの場合も status のテキストはそのまま表示する（情報を落とさない）。
 *
 * 純粋表示。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";

export interface AdrStatusBadgeProps {
  /** AdrFrontmatter.status（proposed / accepted / deprecated / superseded、または規約外の文字列） */
  status: string;
}

/** status → 色分け className（既知 4 status は固有、未知は中立フォールバック）。 */
const STATUS_CLASS: Record<string, string> = {
  proposed: "border-sky-300 bg-sky-50 text-sky-700",
  accepted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  deprecated: "border-amber-300 bg-amber-50 text-amber-700",
  superseded: "border-slate-300 bg-slate-100 text-slate-600",
};

const FALLBACK_CLASS = "border-slate-300 bg-white text-slate-500";

export function AdrStatusBadge({ status }: AdrStatusBadgeProps): JSX.Element {
  const colorClass = STATUS_CLASS[status] ?? FALLBACK_CLASS;
  return (
    <span
      data-testid="adr-status-badge"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}

export default AdrStatusBadge;
