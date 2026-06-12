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

import { badgeClass } from "@/shared/ui";

export interface AdrStatusBadgeProps {
  /** AdrFrontmatter.status（proposed / accepted / deprecated / superseded、または規約外の文字列） */
  status: string;
}

/**
 * status → 色分け className（既知 4 status は固有、未知は中立フォールバック）。
 * variant 対応はスケルトン Knowledge.tsx の STATUS_CLS（accepted=ok / proposed=warn /
 * deprecated=gray / superseded=bad）準拠。
 */
const STATUS_CLASS: Record<string, string> = {
  proposed: badgeClass("warn"),
  accepted: badgeClass("ok"),
  deprecated: badgeClass("gray"),
  superseded: badgeClass("bad"),
};

/** 未知 status: gray 系に破線枠を加え、既知 4 status のどの className とも一致させない。 */
const FALLBACK_CLASS = `${badgeClass("gray")} border-dashed`;

export function AdrStatusBadge({ status }: AdrStatusBadgeProps): JSX.Element {
  const colorClass = STATUS_CLASS[status] ?? FALLBACK_CLASS;
  return (
    <span data-testid="adr-status-badge" data-status={status} className={colorClass}>
      {status}
    </span>
  );
}

export default AdrStatusBadge;
