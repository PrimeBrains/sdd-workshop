/**
 * ComparePage — 2 ペイン比較画面（`/specs/:feature/compare?left=<doc>&right=<doc>`）
 * （tasks.md 6.1 / Requirements 4.1, 4.2 / design.md「ComparePage + useCorrespondence」・
 * ルート表・File Structure Plan `features/compare/ComparePage.tsx`）。
 *
 * - ペイン構成（左右の文書種別）は URL クエリ（left / right）から導出する。クエリが無い／
 *   未知の値のときは既定（left=requirements / right=design）にフォールバックする。
 *   URL がビュー位置の唯一の真実（design.md State Management）であり、リロード・共有リンクで
 *   同じペイン構成が復元される（Requirement 1.4 と同規律 / 4.1, 4.2 の完了条件）
 * - 各ペインのセレクタ変更は当該ペインのクエリキーのみ書き換える（`setSearchParams`）。
 *   セレクタ操作の履歴汚染を避けるため `replace: true` を用いる（リロード復元はクエリが
 *   状態であるため push/replace いずれでも成立する。セレクタはビュー切替なので replace を選択）
 * - データは useSpecDetail で取得し、LoadingSkeleton / ErrorPanel + 再試行（Requirement 1.5）
 * - ペイン内の RefChip（5.3）が対応先解決・ジャンプできるよう、SpecDocumentPage と同じ
 *   TraceIndexProvider + CrosslinkJumpProvider + JumpHistoryProvider で包む。4.4 の完全な
 *   左右対応付け（ハイライト連動）は 6.2 の useCorrespondence で実装する（本タスクは
 *   並列表示とペイン構成の URL 同期まで）
 *
 * 書込操作 UI は持たない（セレクタは view-state であってリポジトリへの書込ではない: 8.1）。
 */
import { type JSX } from "react";
import { useParams, useSearchParams } from "react-router";
import { useSpecDetail } from "@/api/useSpecDetail";
import { toDocumentKind, type DocumentKind } from "@/app/SpecActionSlot";
import { ComparePane } from "@/features/compare/ComparePane";
import { CrosslinkJumpProvider } from "@/navigation/JumpContext";
import { JumpHistoryProvider } from "@/navigation/jumpHistory";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";
import { TraceIndexProvider } from "@/trace/TraceIndexContext";
import { useTraceIndex } from "@/trace/useTraceIndex";

/** ペイン構成の既定（design.md: 左=requirements / 右=design） */
const DEFAULT_LEFT: DocumentKind = "requirements";
const DEFAULT_RIGHT: DocumentKind = "design";

export function ComparePage(): JSX.Element {
  // feature はルートパラメータ由来（`/specs/:feature/compare` で必ず供給される）
  const params = useParams();
  const feature = params.feature ?? "";
  const [searchParams, setSearchParams] = useSearchParams();

  // ペイン構成は URL クエリの唯一の真実から導出（未知・不在は既定へフォールバック: 1.4）
  const leftKind = toDocumentKind(searchParams.get("left") ?? undefined) ?? DEFAULT_LEFT;
  const rightKind = toDocumentKind(searchParams.get("right") ?? undefined) ?? DEFAULT_RIGHT;

  const detail = useSpecDetail(feature);
  // RefChip（5.3）の対応先解決用に trace グラフを取得し index を Context で配布する。
  // loading 中は index === null で、RefChip は素のテキストへグレースフルに退避する。
  const { index: traceIndex } = useTraceIndex(feature);

  /** 指定ペインのクエリキーのみ書き換える（他ペインの構成は保持する） */
  function setPaneKind(key: "left" | "right", next: DocumentKind): void {
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.set(key, next);
        return updated;
      },
      // セレクタはビュー切替（view-state）。履歴汚染を避けるため replace。
      // クエリが状態なのでリロード復元は replace でも成立する。
      { replace: true },
    );
  }

  return (
    // SpecDocumentPage と同じ provider 構成で包み、ペイン内 RefChip の対応先解決・
    // ジャンプ・履歴を成立させる（JumpHistoryProvider が CrosslinkJumpProvider の外側）。
    <JumpHistoryProvider>
      <CrosslinkJumpProvider>
        <TraceIndexProvider index={traceIndex}>
          <section data-testid="compare-page" className="flex h-full flex-col">
            <h1 data-testid="compare-page-heading" className="text-lg font-semibold">
              {feature}/compare
            </h1>
            {detail.isPending && <LoadingSkeleton label="比較ドキュメントを読み込み中…" />}
            {detail.isError && (
              <ErrorPanel
                error={detail.error}
                onRetry={() => {
                  void detail.refetch();
                }}
              />
            )}
            {detail.data !== undefined && (
              <div className="mt-4 flex min-h-0 flex-1 gap-4">
                <ComparePane
                  side="left"
                  kind={leftKind}
                  detail={detail.data}
                  onKindChange={(next) => setPaneKind("left", next)}
                />
                <ComparePane
                  side="right"
                  kind={rightKind}
                  detail={detail.data}
                  onKindChange={(next) => setPaneKind("right", next)}
                />
              </div>
            )}
          </section>
        </TraceIndexProvider>
      </CrosslinkJumpProvider>
    </JumpHistoryProvider>
  );
}
