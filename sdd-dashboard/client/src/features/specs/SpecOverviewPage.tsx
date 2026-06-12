/**
 * スペック概要画面（design.md ルート表 `/specs/:feature`、Requirements 1.2, 1.3）。
 *
 * `useSpecDetail` の `SpecDetail.summary` を解釈せずそのまま提示する:
 * - 成果物（brief / requirements / design / tasks / research）と validation レポート
 *   （gap / design / impl）を DocumentTabs で選択可能に提示する（1.2）
 * - `artifacts` が false の項目はディム表示 + 「未作成」の非リンク（不在はエラーではない、1.3）
 * - spec.json 診断は非致命の注記として表示し、タブ提示を妨げない
 * - 読込中は LoadingSkeleton、失敗時は ErrorPanel + 再試行（Requirement 1.5 パターン）。
 *   404 SPEC_NOT_FOUND は一覧へ戻る導線を併置する（design.md Error Handling 表）
 * - 書込操作 UI は置かない（Requirement 8.1。再試行は ErrorPanel の確立済み導線のみ）
 */
import type { JSX } from "react";
import { Link, useParams } from "react-router";
import type { ArtifactName, SpecSummary } from "@contracts/spec";
import { useSpecDetail } from "@/api/useSpecDetail";
import { DocumentTabs, type DocumentTabItem } from "@/features/specs/DocumentTabs";
import { SpecMetaBadges } from "@/features/specs/SpecMetaBadges";
import { ValidationList } from "@/features/validation/ValidationList";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

/** ドキュメント成果物の表示順（`/specs/:feature/:document` の document 語彙と同一） */
const DOCUMENT_ARTIFACTS = [
  "brief",
  "requirements",
  "design",
  "tasks",
  "research",
] as const satisfies readonly ArtifactName[];

function documentItems(
  feature: string,
  artifacts: SpecSummary["artifacts"],
): DocumentTabItem[] {
  return DOCUMENT_ARTIFACTS.map((name) => ({
    key: name,
    label: name,
    available: artifacts[name],
    to: `/specs/${feature}/${name}`,
  }));
}

/** spec.json 診断の非致命表示（throw せず注記としてタブ提示と共存させる） */
function DiagnosticsNote({ diagnostics }: { diagnostics: SpecSummary["diagnostics"] }): JSX.Element {
  return (
    <div
      data-testid="spec-diagnostics"
      role="note"
      className="mt-3 rounded-md border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink"
    >
      <p className="font-medium">診断 {diagnostics.length} 件</p>
      <ul className="mt-1 list-disc pl-5">
        {diagnostics.map((diagnostic, index) => (
          <li key={index}>{diagnostic.message}</li>
        ))}
      </ul>
    </div>
  );
}

export function SpecOverviewPage(): JSX.Element {
  // ルートパラメータ由来（`/specs/:feature` で必ず供給される。?? "" は型の絞り込みのみ）
  const { feature } = useParams();
  const detail = useSpecDetail(feature ?? "");

  return (
    <section data-testid="spec-overview-page">
      <h1 data-testid="spec-overview-heading" className="mb-1 text-[19px] font-bold">
        {feature}
      </h1>
      {detail.isPending && <LoadingSkeleton label="スペック概要を読み込み中…" />}
      {detail.isError && (
        <>
          <ErrorPanel
            error={detail.error}
            onRetry={() => {
              void detail.refetch();
            }}
          />
          {detail.error.code === "SPEC_NOT_FOUND" && (
            <Link
              data-testid="back-to-list"
              to="/specs"
              className="m-4 inline-block text-sm font-medium text-brand underline hover:text-chip-ink"
            >
              一覧へ戻る
            </Link>
          )}
        </>
      )}
      {detail.data !== undefined && (
        <>
          <div className="mt-2">
            <SpecMetaBadges summary={detail.data.summary} />
          </div>
          {detail.data.summary.diagnostics.length > 0 && (
            <DiagnosticsNote diagnostics={detail.data.summary.diagnostics} />
          )}
          <h2 className="mt-5 text-sm font-semibold text-ink">成果物</h2>
          <div className="mt-2">
            <DocumentTabs
              label="成果物"
              items={documentItems(detail.data.summary.feature, detail.data.summary.artifacts)}
            />
          </div>
          <h2 className="mt-5 text-sm font-semibold text-ink">validation レポート</h2>
          <div className="mt-2">
            <ValidationList
              feature={detail.data.summary.feature}
              validations={detail.data.validations}
            />
          </div>
        </>
      )}
    </section>
  );
}
