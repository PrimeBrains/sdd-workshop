/**
 * SteeringDocPage — steering 文書本文画面（design.md「Feature: knowledge → SteeringDocPage」/
 * requirements 5.2）。
 *
 * - ルートパラメータ `:name` の steering 文書を useSteeringDoc で取得する。
 * - SteeringDoc（content + sections）を review-ui の MarkdownDoc で全文描画する（5.2。
 *   情報無欠落は MarkdownDoc が依拠する markdown 基盤の不変則に乗る — 独自描画を持たない）。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { useParams } from "react-router";

import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { useSteeringDoc } from "@/workflow/api/useSteeringDoc";

export function SteeringDocPage(): JSX.Element {
  // ルート定義（/steering/:name）により name は常に存在する。
  const { name = "" } = useParams();
  const query = useSteeringDoc(name);

  if (query.isPending) {
    return <LoadingSkeleton label={`steering「${name}」を読み込み中…`} />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const doc = query.data;

  return (
    <section data-testid="steering-doc-page" className="space-y-4 p-4">
      <header>
        <h1 className="mb-1 text-[19px] font-bold">{doc.name}</h1>
      </header>
      {/* SteeringDoc は { content, sections } を持ち MarkdownContent を構造的に満たす */}
      <MarkdownDoc doc={doc} />
    </section>
  );
}

export default SteeringDocPage;
