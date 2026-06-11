/**
 * SteeringListPage — steering 文書一覧画面（design.md「Feature: knowledge → SteeringListPage」/
 * requirements 5.1）。
 *
 * - useSteeringList の全 steering 文書を一覧表示する（5.1。欠落させない）。
 * - 各エントリは /steering/:name への react-router Link で、表示テキストは `title ?? name`。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { Link } from "react-router";

import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { useSteeringList } from "@/workflow/api/useSteeringList";

export function SteeringListPage(): JSX.Element {
  const query = useSteeringList();

  if (query.isPending) {
    return <LoadingSkeleton label="steering 文書を読み込み中…" />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const docs = query.data;

  return (
    <section data-testid="workflow-steering-list-page" className="space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-800">Steering</h1>
        <p className="text-sm text-slate-600">
          プロジェクト横断のルール・文脈をまとめた steering 文書の一覧です。
        </p>
      </header>

      <ul data-testid="steering-list" className="space-y-2">
        {docs.map((doc) => (
          <li key={doc.name}>
            <Link
              to={`/steering/${doc.name}`}
              className="block rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {doc.title ?? doc.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SteeringListPage;
