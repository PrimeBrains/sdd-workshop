/**
 * SpecDocumentPage — `/specs/:feature/:document` のディスパッチページ
 * （tasks.md 3.2 / Requirements 1.4, 3.9 / design.md ルート表・File Structure Plan）。
 *
 * - document パラメータを DocumentKind（語彙は SpecActionSlot の単一定義を再利用）へ
 *   検証し、種別ごとの明示的 switch でビューへディスパッチする。4.x の構造化ビューア
 *   （RequirementsView / DesignView / TasksView）はこの switch の該当 case を置き換える
 *   （requirements/design/tasks は 4.1-4.3 で構造化ビューアへ置換済み）
 * - 未知の document パラメータは概要 `/specs/:feature` へリダイレクトする。URL が
 *   ビュー位置の唯一の真実（design.md State Management）であり、未知 URL を既知ビューへ
 *   フォールバックさせるルーターの規律（1.4）に揃えた選択（not-found 表示ではなく遷移）
 * - URL ハッシュのフォーカス対象はデータ到着後に useHashScrollRestore で復元する（3.9）
 * - 構造化ビューア / フォールバック描画（情報無欠落の範囲で契約が運ぶ内容を全描画）:
 *   - brief / research: MarkdownDoc（全文 + セクション。2.7 と同経路）
 *   - requirements: RequirementsView（4.1）
 *   - design: DesignView（4.2。セクションツリーナビ + 本文 + Traceability テーブル）
 *   - tasks: TasksView（4.3。タスク階層・マーカー・注記 + raw ブロックを文書順に描画）
 * - 不在成果物（null）は「未作成」の非エラー表示（Requirement 1.3 パターン）
 * - 読込中 LoadingSkeleton / 失敗 ErrorPanel + 再試行（Requirement 1.5 パターン）
 * - ビューの key は feature + document（URL 由来）で安定させ、データ更新（SSE 再取得 →
 *   7.2）でアンマウントされないようにする
 *
 * アンカー ID（`req-<id>` / `task-<id>`）は design.md JumpNavigation の規約に揃える。
 * anchors.ts（anchorIdOf）が規約の単一所有者であり、4.x ビューアはそちらを使用する。
 */
import { type JSX } from "react";
import { Navigate, useParams } from "react-router";
import type { SpecDetail } from "@contracts/spec";
import { useSpecDetail } from "@/api/useSpecDetail";
import { toDocumentKind, type DocumentKind } from "@/app/SpecActionSlot";
import { JumpBackBar } from "@/features/crosslink/JumpBackBar";
import { DesignView } from "@/features/viewer/DesignView";
import { RequirementsView } from "@/features/viewer/RequirementsView";
import { TasksView } from "@/features/viewer/TasksView";
import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { CrosslinkJumpProvider } from "@/navigation/JumpContext";
import { JumpHistoryProvider } from "@/navigation/jumpHistory";
import { useHashScrollRestore } from "@/navigation/useHashScrollRestore";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";
import { TraceIndexProvider } from "@/trace/TraceIndexContext";
import { useTraceIndex } from "@/trace/useTraceIndex";

export function SpecDocumentPage(): JSX.Element {
  // ルートパラメータ由来（`/specs/:feature/:document` で必ず供給される。?? "" は型の絞り込みのみ）
  const params = useParams();
  const feature = params.feature ?? "";
  const kind = toDocumentKind(params.document);
  const detail = useSpecDetail(feature);
  // RefChip（5.3）の対応先解決用に trace グラフを取得し index を Context で配布する。
  // loading 中は index === null で、RefChip は素のテキストへグレースフルに退避する。
  const { index: traceIndex } = useTraceIndex(feature);

  // フォーカス対象の復元はドキュメント本体の描画後（データ到着後）に 1 回だけ行う（3.9）
  useHashScrollRestore(kind !== null && detail.data !== undefined);

  if (kind === null) {
    // 未知 document → 概要へ（URL がビュー位置の真実。未知 URL は既知ビューへフォールバック: 1.4）
    return <Navigate to={`/specs/${feature}`} replace />;
  }

  return (
    // JumpHistoryProvider / CrosslinkJumpProvider / TraceIndexProvider はドキュメント切替
    // （下の keyed div の remount）を跨いで安定させる。クロスドキュメントジャンプの着地・
    // 3.10 フォールバック・ジャンプ履歴（5.4）は RefChip 自身が unmount しても継続する必要があるため
    // （JumpContext.tsx / jumpHistory.ts 参照）。JumpHistoryProvider は CrosslinkJumpProvider が
    // 履歴を push / back するため外側に置く。
    <JumpHistoryProvider>
      <CrosslinkJumpProvider>
        <TraceIndexProvider index={traceIndex}>
          <section data-testid="spec-document-page">
            <h1 data-testid="spec-document-heading" className="text-lg font-semibold">
              {feature}/{kind}
            </h1>
            {/* 出自へ戻る UI（履歴が無いときは自身で非表示 → 3.4） */}
            <JumpBackBar />
            {detail.isPending && <LoadingSkeleton label="ドキュメントを読み込み中…" />}
            {detail.isError && (
              <ErrorPanel
                error={detail.error}
                onRetry={() => {
                  void detail.refetch();
                }}
              />
            )}
            {detail.data !== undefined && (
              // key は URL 由来（feature + document）で安定させる（7.2 の前提: データ同一性で key しない）
              <div key={`${feature}/${kind}`} className="mt-4">
                <DocumentView kind={kind} detail={detail.data} />
              </div>
            )}
          </section>
        </TraceIndexProvider>
      </CrosslinkJumpProvider>
    </JumpHistoryProvider>
  );
}

/**
 * DocumentKind ごとの明示的ディスパッチ。4.x（RequirementsView / DesignView / TasksView）は
 * 該当 case の Fallback をそのまま置き換える。
 */
function DocumentView({ kind, detail }: { kind: DocumentKind; detail: SpecDetail }): JSX.Element {
  switch (kind) {
    case "brief":
      return detail.brief !== null ? <MarkdownDoc doc={detail.brief} /> : <MissingArtifact kind={kind} />;
    case "requirements":
      return detail.requirements !== null ? (
        <RequirementsView doc={detail.requirements} />
      ) : (
        <MissingArtifact kind={kind} />
      );
    case "design":
      return detail.design !== null ? <DesignView doc={detail.design} /> : <MissingArtifact kind={kind} />;
    case "tasks":
      return detail.tasks !== null ? <TasksView doc={detail.tasks} /> : <MissingArtifact kind={kind} />;
    case "research":
      return detail.research !== null ? <MarkdownDoc doc={detail.research} /> : <MissingArtifact kind={kind} />;
  }
}

/** 不在成果物の非エラー表示（Requirement 1.3 パターン: 不在はエラーではない） */
function MissingArtifact({ kind }: { kind: DocumentKind }): JSX.Element {
  return (
    <p
      data-testid="document-missing"
      className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
    >
      {kind} は未作成です
    </p>
  );
}
