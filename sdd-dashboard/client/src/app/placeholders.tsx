/**
 * ルートプレースホルダ（tasks.md 1.3）。
 *
 * ルートレジストリと URL によるビュー復元（Requirement 1.4）を成立させるための
 * 最小表示。実ページは後続タスクがここへの参照を実装へ置き換える:
 * SpecListPage / SpecOverviewPage = 2.x、SpecDocumentPage = 3.2、
 * ComparePage = 7.x、MatrixPage = 8.x、ValidationReportPage = 6.x。
 *
 * 書込操作 UI（button・form 等）は一切置かない（Requirement 8.1）。
 */
import type { JSX } from "react";
import { useParams } from "react-router";

export function SpecListPagePlaceholder(): JSX.Element {
  return (
    <h1 data-testid="spec-list-page" className="text-lg font-semibold">
      スペック一覧
    </h1>
  );
}

export function SpecOverviewPagePlaceholder(): JSX.Element {
  const { feature } = useParams();
  return (
    <h1 data-testid="spec-overview-page" className="text-lg font-semibold">
      {feature}
    </h1>
  );
}

export function SpecDocumentPagePlaceholder(): JSX.Element {
  const { feature, document } = useParams();
  return (
    <h1 data-testid="spec-document-page" className="text-lg font-semibold">
      {feature}/{document}
    </h1>
  );
}

export function ComparePagePlaceholder(): JSX.Element {
  const { feature } = useParams();
  return (
    <h1 data-testid="compare-page" className="text-lg font-semibold">
      {feature}/compare
    </h1>
  );
}

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
