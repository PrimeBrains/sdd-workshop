/**
 * AdrListPage — ADR 一覧画面（design.md「Feature: knowledge → AdrListPage」/
 * requirements 7.1, 7.4, 7.5）。
 *
 * - useAdrList の全 ADR を、frontmatter `app` 別に groupByApp でグルーピングする（app 名昇順、
 *   `app === null` は末尾の「リポジトリ横断」グループ — 7.4, 7.5）。各 AdrSummary は app を
 *   トップレベルに持たない（app は frontmatter 内）ため、{ app, summary } へ射影してから渡す。
 *   frontmatter が null（パース不正）の ADR は app null → リポジトリ横断グループに入り、省略しない。
 * - 各グループ内は frontmatter `id` 昇順で並べる。frontmatter null の ADR は id を持たないため
 *   末尾に回す（安定）。
 * - 各 ADR 行は id・タイトル・AdrStatusBadge（status 色分け）・date・関連 specs を併記し（7.1）、
 *   /adr/:id（:id = AdrSummary.name = 拡張子なしファイル名）への react-router Link とする。
 *   frontmatter null の行は name + 診断インジケータを表示する（クラッシュさせない）。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { Link } from "react-router";
import type { AdrSummary } from "@contracts/resources";

import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";
import { badgeClass, chipClass } from "@/shared/ui";

import { useAdrList } from "@/workflow/api/useAdrList";
import { groupByApp } from "@/workflow/model/grouping";

import { AdrStatusBadge } from "./AdrStatusBadge";

/** app をトップレベルに昇格させた groupByApp 入力（app は frontmatter 由来、null は横断へ）。 */
interface AdrItem {
  app: string | null;
  summary: AdrSummary;
}

/** null グループ（app === null）の見出しラベル（7.5）。 */
const CROSS_CUTTING_LABEL = "リポジトリ横断";

/** グループ内ソート: frontmatter id 昇順。frontmatter null（id なし）は末尾へ（安定）。 */
function compareById(a: AdrItem, b: AdrItem): number {
  const ai = a.summary.frontmatter?.id;
  const bi = b.summary.frontmatter?.id;
  if (ai === undefined && bi === undefined) {
    return 0;
  }
  if (ai === undefined) {
    return 1;
  }
  if (bi === undefined) {
    return -1;
  }
  return ai - bi;
}

export function AdrListPage(): JSX.Element {
  const query = useAdrList();

  if (query.isPending) {
    return <LoadingSkeleton label="ADR を読み込み中…" />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  // app は AdrSummary トップレベルではなく frontmatter 内にあるため射影してから groupByApp。
  const items: AdrItem[] = query.data.map((summary) => ({
    app: summary.frontmatter?.app ?? null,
    summary,
  }));
  const groups = groupByApp(items);

  return (
    <section data-testid="workflow-adr-list-page" className="space-y-6 p-4">
      <header>
        <h1 className="mb-1 text-[19px] font-bold">ADR</h1>
        <p className="text-ink-soft text-[12.5px]">
          プロジェクト横断のアーキテクチャ決定（ADR）を所属アプリ別に一覧表示します。
        </p>
      </header>

      {groups.map((group) => {
        const sorted = [...group.items].sort(compareById);
        return (
          <div
            key={group.app ?? "__cross_cutting__"}
            data-testid="adr-app-group"
            data-app={group.app ?? ""}
            className="space-y-2"
          >
            <h2 className="text-sm font-semibold text-ink">
              {group.app ?? CROSS_CUTTING_LABEL}
            </h2>

            <ul className="space-y-2">
              {sorted.map(({ summary }) => {
                const fm = summary.frontmatter;
                if (fm === null) {
                  // frontmatter 不正の ADR も省略せず name + 診断インジケータで表示する。
                  return (
                    <li key={summary.name} data-testid={`adr-item-${summary.name}`}>
                      <Link
                        to={`/adr/${summary.name}`}
                        data-testid="adr-list-item"
                        className="flex items-center justify-between gap-3 rounded-md border border-dashed border-warn-line bg-warn-soft/40 px-4 py-3 text-sm text-ink hover:bg-warn-soft"
                      >
                        <span className="font-medium">{summary.name}</span>
                        <span data-testid="adr-item-diagnostic" className={badgeClass("warn")}>
                          メタデータ不正
                        </span>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={summary.name} data-testid={`adr-item-${summary.name}`}>
                    <Link
                      to={`/adr/${summary.name}`}
                      data-testid="adr-list-item"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm hover:bg-paper-warm"
                    >
                      <span data-testid="adr-item-id" className="font-mono text-ink-soft">
                        {fm.id}
                      </span>
                      <span data-testid="adr-item-title" className="font-medium">
                        {fm.title}
                      </span>
                      <AdrStatusBadge status={fm.status} />
                      <span data-testid="adr-item-date" className="text-xs text-ink-soft">
                        {fm.date}
                      </span>
                      {fm.specs.length > 0 ? (
                        <span data-testid="adr-item-specs" className="flex flex-wrap gap-1">
                          {fm.specs.map((spec) => (
                            <span key={spec} className={chipClass("plain")}>
                              {spec}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export default AdrListPage;
