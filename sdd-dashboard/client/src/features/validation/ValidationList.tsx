/**
 * validation レポート一覧（design.md「ValidationList + ValidationReportPage」、
 * Requirements 6.1, 6.4）。
 *
 * `SpecDetail.validations`（sdd-core 7.4）から存在するレポートを type / date / decision の
 * バッジ付きで一覧表示し、`/specs/:feature/validation/:type` への Link にする（6.1）。
 * gap / design / impl のうち欠落している type は「未生成」プレースホルダの非リンク要素で
 * 表示する（不在はエラーではない、6.4 / 1.3 の不在パターンと同型）。
 *
 * 純粋な表示コンポーネント。データ取得・解釈はしない（validations は呼び出し側が供給）。
 */
import type { JSX } from "react";
import { Link } from "react-router";
import type { ValidationReport, ValidationType } from "@contracts/resources";

/** 一覧の表示順（`/specs/:feature/validation/:type` の type 語彙と同一） */
const VALIDATION_TYPES = ["gap", "design", "impl"] as const satisfies readonly ValidationType[];

const ROW_BASE =
  "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm";
const BADGE_BASE = "inline-flex items-center rounded border px-1.5 py-0.5 text-xs";

interface ValidationListProps {
  feature: string;
  validations: readonly ValidationReport[];
}

/** 存在するレポート行: type / date / decision バッジ + 詳細ルートへの Link */
function ExistingItem({
  feature,
  report,
}: {
  feature: string;
  report: ValidationReport;
}): JSX.Element {
  return (
    <Link
      data-testid={`validation-item-${report.type}`}
      data-state="available"
      to={`/specs/${feature}/validation/${report.type}`}
      className={`${ROW_BASE} border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50`}
    >
      <span
        data-testid={`validation-type-${report.type}`}
        className={`${BADGE_BASE} border-sky-300 bg-sky-50 font-medium text-sky-800`}
      >
        {report.type}
      </span>
      <span
        data-testid={`validation-date-${report.type}`}
        className={`${BADGE_BASE} border-slate-300 bg-slate-50 text-slate-600`}
      >
        {report.date ?? "日付なし"}
      </span>
      <span
        data-testid={`validation-decision-${report.type}`}
        className={`${BADGE_BASE} border-emerald-300 bg-emerald-50 text-emerald-800`}
      >
        {report.decision ?? "判定なし"}
      </span>
    </Link>
  );
}

/** 未生成の type: 「未生成」プレースホルダの非リンク表示（非エラー、6.4） */
function MissingItem({ type }: { type: ValidationType }): JSX.Element {
  return (
    <span
      data-testid={`validation-item-${type}`}
      data-state="missing"
      aria-disabled="true"
      className={`${ROW_BASE} cursor-default border-slate-200 bg-slate-50 text-slate-300`}
    >
      <span className={`${BADGE_BASE} border-slate-200 bg-white text-slate-400`}>{type}</span>
      <span className="text-xs">未生成</span>
    </span>
  );
}

export function ValidationList({ feature, validations }: ValidationListProps): JSX.Element {
  const byType = new Map<ValidationType, ValidationReport>(
    validations.map((report) => [report.type, report]),
  );
  return (
    <ul data-testid="validation-list" className="flex flex-col gap-2">
      {VALIDATION_TYPES.map((type) => {
        const report = byType.get(type);
        return (
          <li key={type}>
            {report !== undefined ? (
              <ExistingItem feature={feature} report={report} />
            ) : (
              <MissingItem type={type} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
