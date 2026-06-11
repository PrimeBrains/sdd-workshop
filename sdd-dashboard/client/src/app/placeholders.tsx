/**
 * ルートプレースホルダ（tasks.md 1.3）。
 *
 * ルートレジストリと URL によるビュー復元（Requirement 1.4）を成立させるための
 * 最小表示。実ページは後続タスクがここへの参照を実装へ置き換える:
 * MatrixPage = 7.x、ValidationReportPage = 8.x。
 * （SpecListPage は 2.1、SpecOverviewPage は 2.2、SpecDocumentPage は 3.2、
 * ComparePage は 6.1 で実装済み → features/）
 *
 * 書込操作 UI（button・form 等）は一切置かない（Requirement 8.1）。
 */
import type { JSX } from "react";
import { useParams } from "react-router";

export function MatrixPagePlaceholder(): JSX.Element {
  const { feature } = useParams();
  return (
    <h1 data-testid="matrix-page" className="text-lg font-semibold">
      {feature}/matrix
    </h1>
  );
}

export function ValidationReportPagePlaceholder(): JSX.Element {
  const { feature, type } = useParams();
  return (
    <h1 data-testid="validation-report-page" className="text-lg font-semibold">
      {feature}/validation/{type}
    </h1>
  );
}
