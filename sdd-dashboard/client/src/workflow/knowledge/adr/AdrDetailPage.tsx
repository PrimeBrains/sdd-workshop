/**
 * AdrDetailPage — ADR 本文画面（design.md「Feature: knowledge → AdrDetailPage」/
 * requirements 7.2, 7.3）。
 *
 * - ルートパラメータ `:id`（= AdrSummary.name = 拡張子なしファイル名。sdd-core
 *   GET /api/adr/:id の :id 定義に一致）の ADR を useAdrDoc で取得する。
 * - frontmatter !== null: メタ（id / title / status バッジ / date / app / specs /
 *   requirements / supersedes / superseded_by）をヘッダ表示し、本文（Context / Decision /
 *   Consequences / Alternatives）を review-ui の MarkdownDoc で散文描画する（7.2）。
 * - frontmatter === null（パース不正）: ADR を省略せず、RawBlockView で raw content を描画し、
 *   診断（diagnostics）を非エラー表示する（7.3）。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { useParams } from "react-router";

import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { RawBlockView } from "@/markdown/RawBlockView";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { useAdrDoc } from "@/workflow/api/useAdrDoc";

import { AdrStatusBadge } from "./AdrStatusBadge";

/** リポジトリ横断（app === null）の表示ラベル（7.5 と整合）。 */
const CROSS_CUTTING_LABEL = "リポジトリ横断";

export function AdrDetailPage(): JSX.Element {
  // ルート定義（/adr/:id）により id は常に存在する（= AdrSummary.name）。
  const { id = "" } = useParams();
  const query = useAdrDoc(id);

  if (query.isPending) {
    return <LoadingSkeleton label={`ADR「${id}」を読み込み中…`} />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const doc = query.data;

  // 7.3: frontmatter 不正は ADR を省略せず raw + 診断にフォールバックする（エラー扱いしない）。
  if (doc.frontmatter === null) {
    return (
      <section data-testid="adr-detail-page" className="space-y-4 p-4">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-800">{doc.name}</h1>
        </header>

        {doc.diagnostics.length > 0 ? (
          <ul data-testid="adr-diagnostics" className="space-y-1">
            {doc.diagnostics.map((diag, index) => (
              <li
                key={`${diag.kind}-${index}`}
                data-testid="adr-diagnostic"
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
              >
                <span className="font-semibold">{diag.kind}</span>: {diag.message}
              </li>
            ))}
          </ul>
        ) : null}

        <RawBlockView markdown={doc.content} reason="frontmatter のパースに失敗しました" />
      </section>
    );
  }

  const fm = doc.frontmatter;

  return (
    <section data-testid="adr-detail-page" className="space-y-4 p-4">
      <header data-testid="adr-detail-header" className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span data-testid="adr-detail-id" className="font-mono text-sm text-slate-500">
            {fm.id}
          </span>
          <h1 data-testid="adr-detail-title" className="text-lg font-semibold text-slate-800">
            {fm.title}
          </h1>
          <AdrStatusBadge status={fm.status} />
        </div>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm text-slate-600">
          <dt className="font-medium text-slate-500">date</dt>
          <dd data-testid="adr-detail-date">{fm.date}</dd>

          <dt className="font-medium text-slate-500">app</dt>
          <dd data-testid="adr-detail-app">{fm.app ?? CROSS_CUTTING_LABEL}</dd>

          <dt className="font-medium text-slate-500">specs</dt>
          <dd data-testid="adr-detail-specs">{fm.specs.length > 0 ? fm.specs.join(", ") : "—"}</dd>

          <dt className="font-medium text-slate-500">requirements</dt>
          <dd data-testid="adr-detail-requirements">
            {fm.requirements.length > 0 ? fm.requirements.join(", ") : "—"}
          </dd>

          <dt className="font-medium text-slate-500">supersedes</dt>
          <dd data-testid="adr-detail-supersedes">{fm.supersedes ?? "—"}</dd>

          <dt className="font-medium text-slate-500">superseded_by</dt>
          <dd data-testid="adr-detail-superseded-by">{fm.superseded_by ?? "—"}</dd>
        </dl>
      </header>

      {/* 本文（Context / Decision / Consequences / Alternatives）を散文描画（7.2）。 */}
      <div data-testid="adr-detail-body">
        <MarkdownDoc doc={doc} />
      </div>
    </section>
  );
}

export default AdrDetailPage;
