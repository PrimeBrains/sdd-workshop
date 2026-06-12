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

/** スケルトン .tabs button 準拠: 13px / padding 8px 16px / 下罫線 2px（タブ列の罫線へ -2px で重ねる） */
const TAB_BASE = "-mb-0.5 inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-[13px]";

export function DocumentTabs({ label, items }: DocumentTabsProps): JSX.Element {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-0.5 border-b-2 border-line">
      {items.map((item) =>
        item.available ? (
          <Link
            key={item.key}
            data-testid={`doc-tab-${item.key}`}
            data-state="available"
            to={item.to}
            className={`${TAB_BASE} border-transparent text-ink-soft hover:border-brand hover:text-ink`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.key}
            data-testid={`doc-tab-${item.key}`}
            data-state="missing"
            aria-disabled="true"
            className={`${TAB_BASE} cursor-default border-transparent text-gray-mid`}
          >
            {item.label}
            <span className="text-xs">未作成</span>
          </span>
        ),
      )}
    </nav>
  );
}
