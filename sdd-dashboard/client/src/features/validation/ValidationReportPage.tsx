/**
 * ValidationReportPage — validation レポート（gap / design / impl）1 件の本文表示画面
 * （design.md「ValidationList + ValidationReportPage」・ルート表
 * `/specs/:feature/validation/:type` / Requirements 6.2, 6.3, 6.4, 1.5）。
 *
 * `useSpecDetail(feature)` の `SpecDetail.validations`（sdd-core 7.4）から `:type` の
 * レポートを 1 件選び、解釈せず提示する:
 * - 6.2（正常）: frontmatter メタ（type / date / decision）をバッジで示し、本文（content）を
 *   markdown 層の安全設定（`safeMarkdownOptions` — RawBlockView と単一定義）で構造化描画する。
 *   mermaid / 生 HTML 不活性化 / 外部 URL 無効化はその層に委譲する（2.6, 2.8, 8.2）
 * - 6.3（frontmatter 破損）: sdd-core は frontmatter パース失敗時も全文を `content` に保持し
 *   `diagnostics`（parse-failure）を付けて返す。診断が存在する場合は DiagnosticBadge で理由を示し、
 *   本文を RawBlockView で生 markdown 全文として描画する（情報無欠落原則。content を欠落させない）
 * - 6.4（未生成）: 当該 type のレポートが validations に無い → 「未生成」の非エラー表示（1.3 と同型）
 * - 1.5: 読込中は LoadingSkeleton、取得失敗は ErrorPanel + 再試行（404 SPEC_NOT_FOUND もこの経路）
 *
 * 注: ValidationReport の本文は `content`（全文）+ `sections`（見出しツリー）で提供され、
 * `DocBlock[]` ではない。よって構造化描画は brief / research と同じ markdown 層に委譲する
 * （design.md の「DocBlockList で構造化描画」は本文が DocBlock で来る場合の表現で、本契約では
 * content ベースの markdown 層が同じ structured/raw・情報無欠落の役割を果たす）。
 * 書込操作 UI は置かない（Requirement 8.1。再試行は ErrorPanel の確立済み導線のみ）。
 */
import type { JSX } from "react";
import { useParams } from "react-router";
import Markdown from "react-markdown";
import type { ValidationReport, ValidationType } from "@contracts/resources";
import { useSpecDetail } from "@/api/useSpecDetail";
import { DiagnosticBadge } from "@/features/viewer/DiagnosticBadge";
import { safeMarkdownOptions } from "@/markdown/RawBlockView";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

const BADGE_BASE = "inline-flex items-center rounded border px-1.5 py-0.5 text-xs";

/** frontmatter メタのバッジ列（type / date / decision。値は解釈せずそのまま、欠落は注記） */
function ReportMeta({ report }: { report: ValidationReport }): JSX.Element {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span
        data-testid="validation-meta-type"
        className={`${BADGE_BASE} border-sky-300 bg-sky-50 font-medium text-sky-800`}
      >
        {report.type}
      </span>
      <span
        data-testid="validation-meta-date"
        className={`${BADGE_BASE} border-slate-300 bg-slate-50 text-slate-600`}
      >
        {report.date ?? "日付なし"}
      </span>
      <span
        data-testid="validation-meta-decision"
        className={`${BADGE_BASE} border-emerald-300 bg-emerald-50 text-emerald-800`}
      >
        {report.decision ?? "判定なし"}
      </span>
    </div>
  );
}

/**
 * レポート本文の描画。frontmatter 破損（diagnostics 非空）なら診断 + 生全文を、
 * 正常なら content を markdown 層で構造化描画する。いずれも content 全文を欠落させない。
 */
function ReportBody({ report }: { report: ValidationReport }): JSX.Element {
  const malformed = report.diagnostics.length > 0;
  return (
    <>
      {malformed && (
        <div className="mt-4 space-y-2">
          {report.diagnostics.map((diagnostic, index) => (
            <DiagnosticBadge key={index} diagnostic={diagnostic} />
          ))}
        </div>
      )}
      <article
        data-testid="validation-report-body"
        data-mode={malformed ? "raw" : "structured"}
        className={
          malformed
            ? "mt-4 rounded border border-dashed border-amber-400/70 bg-amber-50/40 px-3 py-2"
            : "mt-4 space-y-3 leading-relaxed"
        }
      >
        <Markdown {...safeMarkdownOptions}>{report.content}</Markdown>
      </article>
    </>
  );
}

/** 当該 type が未生成のときの非エラー表示（6.4。不在はエラーではない） */
function NotGenerated({ type }: { type: string }): JSX.Element {
  return (
    <p
      data-testid="validation-report-not-generated"
      className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
    >
      validation レポート（{type}）はまだ生成されていません
    </p>
  );
}

const VALIDATION_TYPES = ["gap", "design", "impl"] as const satisfies readonly ValidationType[];

function isValidationType(value: string | undefined): value is ValidationType {
  return VALIDATION_TYPES.includes(value as ValidationType);
}

export function ValidationReportPage(): JSX.Element {
  // ルートパラメータ由来（`/specs/:feature/validation/:type` で必ず供給される）
  const { feature, type } = useParams();
  const detail = useSpecDetail(feature ?? "");

  const report =
    detail.data !== undefined && isValidationType(type)
      ? detail.data.validations.find((candidate) => candidate.type === type)
      : undefined;

  return (
    <section data-testid="validation-report-page">
      <h1 data-testid="validation-report-heading" className="text-lg font-semibold">
        {feature}/validation/{type}
      </h1>
      {detail.isPending && <LoadingSkeleton label="validation レポートを読み込み中…" />}
      {detail.isError && (
        <ErrorPanel
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      )}
      {detail.data !== undefined &&
        (report !== undefined ? (
          <>
            <ReportMeta report={report} />
            <ReportBody report={report} />
          </>
        ) : (
          <NotGenerated type={type ?? ""} />
        ))}
    </section>
  );
}
