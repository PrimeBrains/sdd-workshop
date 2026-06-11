/**
 * MatrixPage — トレーサビリティマトリクス画面（`/specs/:feature/matrix`）
 * （tasks.md 7.1 / Requirements 5.1, 5.5 / design.md「MatrixPage + MatrixGrid」・
 * ルート表・File Structure Plan `features/matrix/MatrixPage.tsx`）。
 *
 * - データは `useTraceIndex(feature)`（5.1）で取得した `TraceIndex` のみ。loading → LoadingSkeleton、
 *   error → ErrorPanel + 再試行（Requirement 1.5）。グラフ取得後にカバレッジグリッドを描画する。
 * - グリッドはグラフのエッジを as-is に描画する（UI 側のカバレッジ再判定なし: 5.5）。
 * - 本タスク（7.1）はカバレッジグリッド + エッジ/source マークまで。未カバー行ハイライト・
 *   broken-link / unparsable-ref の DiagnosticsPanel・セルジャンプは 7.2 の責務。下の `<section>` は
 *   グリッドを保持しつつ 7.2 の DiagnosticsPanel を後置できる構成にしてある。
 *
 * 書込操作 UI は持たない（読み取り専用ビュー: Requirement 8.1）。
 */
import type { JSX } from "react";
import { useParams } from "react-router";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";
import { useTraceIndex } from "@/trace/useTraceIndex";
import { MatrixGrid } from "./MatrixGrid";

export function MatrixPage(): JSX.Element {
  // feature はルートパラメータ由来（`/specs/:feature/matrix` で必ず供給される）
  const feature = useParams().feature ?? "";
  const { index, query } = useTraceIndex(feature);

  return (
    <section data-testid="matrix-page" className="flex h-full flex-col">
      <h1 data-testid="matrix-page-heading" className="text-lg font-semibold">
        {feature}/matrix
      </h1>

      {query.isPending && <LoadingSkeleton label="トレーサビリティを読み込み中…" />}
      {query.isError && (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {/* index はグラフ取得済み（!isPending && !isError）のとき非 null（5.1） */}
      {index !== null && (
        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          <MatrixGrid index={index} />
          {/* 7.2: ここに DiagnosticsPanel（broken-link / unparsable-ref）を後置する */}
        </div>
      )}
    </section>
  );
}
