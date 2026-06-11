/**
 * DiagnosticBadge — sdd-core の `Diagnostic`（{ kind, message, position }）を
 * 解釈せずそのまま表示する純表示要素（design.md File Structure Plan
 * `features/viewer/DiagnosticBadge.tsx` / Requirement 6.3）。
 *
 * validation レポートの frontmatter パース失敗診断（6.3）など、構造化に失敗した範囲が
 * 生フォールバックとして提供される際に、その理由（診断）を欠落なく示すための共有バッジ。
 * 独自の判定・再計算をしない（kind / message / 行番号をそのまま出す）。
 */
import type { JSX } from "react";
import type { Diagnostic } from "@contracts/document";

export interface DiagnosticBadgeProps {
  diagnostic: Diagnostic;
}

const BADGE_BASE = "inline-flex items-center rounded border px-1.5 py-0.5 text-xs";

export function DiagnosticBadge({ diagnostic }: DiagnosticBadgeProps): JSX.Element {
  return (
    <div
      data-testid="diagnostic-badge"
      data-kind={diagnostic.kind}
      role="note"
      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <span
        data-testid="diagnostic-badge-kind"
        className={`${BADGE_BASE} border-amber-400 bg-amber-100 font-medium text-amber-900`}
      >
        {diagnostic.kind}
      </span>
      <span data-testid="diagnostic-badge-message">{diagnostic.message}</span>
      {diagnostic.position !== null && (
        <span
          data-testid="diagnostic-badge-line"
          className={`${BADGE_BASE} border-amber-300 bg-white text-amber-700`}
        >
          {diagnostic.position.startLine}
        </span>
      )}
    </div>
  );
}
