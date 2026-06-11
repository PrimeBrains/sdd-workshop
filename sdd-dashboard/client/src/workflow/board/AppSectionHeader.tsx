/**
 * AppSectionHeader — app セクションの見出し（design.md「Feature: board」AppSectionHeader /
 * Requirement 1.7, 1.8）。
 *
 * app 名（`app === null` のとき「未分類」）と `summarizeSpecGroup` のサマリー
 * （スペック数 / READY 数 / 実装完了数）を厳密・テスト可能なテキストで表示する。
 * 表示専用。書込操作 UI を持たない（Requirement 8.1）。
 */
import type { JSX } from "react";

import type { SpecAppGroupSummary } from "@/workflow/model/grouping";

interface AppSectionHeaderProps {
  /** app 名。null = 未分類グループ（1.8） */
  app: string | null;
  summary: SpecAppGroupSummary;
}

export function AppSectionHeader({ app, summary }: AppSectionHeaderProps): JSX.Element {
  const appLabel = app === null ? "未分類" : app;
  return (
    <header data-testid={`app-section-header-${app ?? "未分類"}`} className="mb-2">
      <h2 className="text-base font-semibold text-slate-800" data-testid="app-section-name">
        {appLabel}
      </h2>
      <dl className="mt-1 flex gap-4 text-xs text-slate-600">
        <div className="flex gap-1">
          <dt>スペック数</dt>
          <dd data-testid="app-section-spec-count" className="font-medium text-slate-800">
            {summary.specCount}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>READY</dt>
          <dd data-testid="app-section-ready-count" className="font-medium text-slate-800">
            {summary.readyCount}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>実装完了</dt>
          <dd
            data-testid="app-section-impl-complete-count"
            className="font-medium text-slate-800"
          >
            {summary.implementationCompleteCount}
          </dd>
        </div>
      </dl>
    </header>
  );
}
