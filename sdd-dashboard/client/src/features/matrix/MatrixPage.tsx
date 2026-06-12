/**
 * MatrixPage — トレーサビリティマトリクス画面（`/specs/:feature/matrix`）
 * （tasks.md 7.1 / Requirements 5.1, 5.5 / design.md「MatrixPage + MatrixGrid」・
 * ルート表・File Structure Plan `features/matrix/MatrixPage.tsx`）。
 *
 * - データは `useTraceIndex(feature)`（5.1）で取得した `TraceIndex` のみ。loading → LoadingSkeleton、
 *   error → ErrorPanel + 再試行（Requirement 1.5）。グラフ取得後にカバレッジグリッドを描画する。
 * - グリッドはグラフのエッジを as-is に描画する（UI 側のカバレッジ再判定なし: 5.5）。
 * - 7.1 はカバレッジグリッド + エッジ/source マークまで。7.2（本タスク）で未カバー行ハイライト
 *   （MatrixGrid 内）・broken-link / unparsable-ref の DiagnosticsPanel・マトリクスからの遷移を追加した。
 *
 * マトリクスからの遷移（5.4 / design.md「行ヘッダ / セルクリック → 該当ビューへ jumpTo」）:
 * - MatrixGrid は `onJump(node: NodeRef)` でクリック対象ノードを通知する。
 * - 本ページはアンカー ID 規約の単一所有者 `anchorIdOf`（5.2）でノードをアンカーへ写像し、
 *   `navigate(/specs/:feature/<document>#<anchor>)` でクロスドキュメント遷移する（react-router push）。
 *   着地側 SpecDocumentPage が useHashScrollRestore（3.2/5.5）でスクロール + ハイライト復元する。
 *   MatrixPage は `:document` を持たないルート（/matrix）上にあり useJump の着地経路には乗らないため、
 *   遷移のみを担い、着地解決は着地ページへ委ねる（責務分離）。
 *
 * 書込操作 UI は持たない（読み取り専用ビュー: Requirement 8.1。クリックは読み取り遷移）。
 */
import type { JSX } from "react";
import { useNavigate, useParams } from "react-router";
import type { NodeRef } from "@contracts/trace";
import { anchorIdOf } from "@/navigation/anchors";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";
import { useTraceIndex } from "@/trace/useTraceIndex";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { MatrixGrid } from "./MatrixGrid";

/** NodeRef の種別 → 着地ドキュメント（requirements / design / tasks）。 */
function documentOf(node: NodeRef): "requirements" | "design" | "tasks" {
  switch (node.type) {
    case "requirement":
      return "requirements";
    case "design":
      return "design";
    case "task":
      return "tasks";
  }
}

export function MatrixPage(): JSX.Element {
  // feature はルートパラメータ由来（`/specs/:feature/matrix` で必ず供給される）
  const feature = useParams().feature ?? "";
  const navigate = useNavigate();
  const { index, query } = useTraceIndex(feature);

  // クリック対象ノード → `/specs/:feature/<document>#<anchor>` へ push 遷移（5.4）。
  // anchorIdOf（5.2）でアンカー規約を共有し、着地側のハッシュ復元で対象が強調される。
  const handleJump = (node: NodeRef): void => {
    const anchor = anchorIdOf(node);
    navigate(`/specs/${feature}/${documentOf(node)}#${anchor}`);
  };

  return (
    <section data-testid="matrix-page" className="flex h-full flex-col">
      <h1 data-testid="matrix-page-heading" className="mb-1 text-[19px] font-bold">
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
          <MatrixGrid index={index} onJump={handleJump} />
          {/* broken-link / unparsable-ref を raw・発生元・行付きで一覧（5.3）。
              design-uncovered / task-uncovered はここには出さず行ハイライトを駆動する。 */}
          <DiagnosticsPanel index={index} />
        </div>
      )}
    </section>
  );
}
