/**
 * 成果物タブ（design.md File Structure Plan「成果物タブ（不在はディム表示）」、
 * Requirements 1.2, 1.3）。
 *
 * 存在する項目のみ該当ルートへの Link として提示し、不在項目はディム表示 +
 * 「未作成」の非リンク要素にする（クリックしても遷移もエラーも起きない）。
 * 有無の解釈はしない純粋な表示コンポーネント（availability は呼び出し側が
 * `SpecSummary.artifacts` から導出する）。
 */
import type { JSX } from "react";
import { Link } from "react-router";

/** タブ 1 項目分の表示指示（SpecOverviewPage が artifacts から組み立てる） */
export interface DocumentTabItem {
  /** data-testid（`doc-tab-{key}`）に使う安定キー */
  key: string;
  /** タブの表示ラベル */
  label: string;
  /** 成果物の有無（`SpecSummary.artifacts` 由来） */
  available: boolean;
  /** available 時の遷移先ルート */
  to: string;
}

interface DocumentTabsProps {
  /** タブ群の見出し（nav の aria-label） */
  label: string;
  items: readonly DocumentTabItem[];
}

const TAB_BASE = "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm";

export function DocumentTabs({ label, items }: DocumentTabsProps): JSX.Element {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) =>
        item.available ? (
          <Link
            key={item.key}
            data-testid={`doc-tab-${item.key}`}
            data-state="available"
            to={item.to}
            className={`${TAB_BASE} border-slate-300 bg-white font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.key}
            data-testid={`doc-tab-${item.key}`}
            data-state="missing"
            aria-disabled="true"
            className={`${TAB_BASE} cursor-default border-slate-200 bg-slate-50 text-slate-300`}
          >
            {item.label}
            <span className="text-xs">未作成</span>
          </span>
        ),
      )}
    </nav>
  );
}
