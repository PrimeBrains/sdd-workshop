/**
 * SpecDocumentPage — `/specs/:feature/:document` のディスパッチページ
 * （tasks.md 3.2 / Requirements 1.4, 3.9 / design.md ルート表・File Structure Plan）。
 *
 * - document パラメータを DocumentKind（語彙は SpecActionSlot の単一定義を再利用）へ
 *   検証し、種別ごとの明示的 switch でビューへディスパッチする。4.x の構造化ビューア
 *   （RequirementsView / DesignView / TasksView）はこの switch の該当 case を置き換える
 *   （requirements は 4.1 で RequirementsView へ置換済み）
 * - 未知の document パラメータは概要 `/specs/:feature` へリダイレクトする。URL が
 *   ビュー位置の唯一の真実（design.md State Management）であり、未知 URL を既知ビューへ
 *   フォールバックさせるルーターの規律（1.4）に揃えた選択（not-found 表示ではなく遷移）
 * - URL ハッシュのフォーカス対象はデータ到着後に useHashScrollRestore で復元する（3.9）
 * - 構造化ビューア / フォールバック描画（情報無欠落の範囲で契約が運ぶ内容を全描画）:
 *   - brief / research: MarkdownDoc（全文 + セクション。2.7 と同経路）
 *   - requirements: RequirementsView（4.1）
 *   - design: DesignView（4.2。セクションツリーナビ + 本文 + Traceability テーブル）
 *   - tasks: 4.3 までのフォールバック。tasks + otherBlocks を position 順にマージし、
 *     タスク階層・マーカー・注記と raw ブロック全文を描画
 * - 不在成果物（null）は「未作成」の非エラー表示（Requirement 1.3 パターン）
 * - 読込中 LoadingSkeleton / 失敗 ErrorPanel + 再試行（Requirement 1.5 パターン）
 * - ビューの key は feature + document（URL 由来）で安定させ、データ更新（SSE 再取得 →
 *   7.2）でアンマウントされないようにする
 *
 * アンカー ID（`req-<id>` / `task-<id>`）は design.md JumpNavigation の規約に揃えた
 * 暫定払い出し。5.2 の anchors.ts（anchorIdOf）が規約の単一所有者となり、4.x ビューアは
 * そちらを使用する。
 */
import { useMemo, type JSX } from "react";
import { Navigate, useParams } from "react-router";
import type { RawBlock } from "@contracts/document";
import type { SpecDetail, TaskEntry, TasksDoc } from "@contracts/spec";
import type { RefToken } from "@contracts/trace";
import { useSpecDetail } from "@/api/useSpecDetail";
import { toDocumentKind, type DocumentKind } from "@/app/SpecActionSlot";
import { DesignView } from "@/features/viewer/DesignView";
import { RequirementsView } from "@/features/viewer/RequirementsView";
import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { RawBlockView } from "@/markdown/RawBlockView";
import { useHashScrollRestore } from "@/navigation/useHashScrollRestore";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

export function SpecDocumentPage(): JSX.Element {
  // ルートパラメータ由来（`/specs/:feature/:document` で必ず供給される。?? "" は型の絞り込みのみ）
  const params = useParams();
  const feature = params.feature ?? "";
  const kind = toDocumentKind(params.document);
  const detail = useSpecDetail(feature);

  // フォーカス対象の復元はドキュメント本体の描画後（データ到着後）に 1 回だけ行う（3.9）
  useHashScrollRestore(kind !== null && detail.data !== undefined);

  if (kind === null) {
    // 未知 document → 概要へ（URL がビュー位置の真実。未知 URL は既知ビューへフォールバック: 1.4）
    return <Navigate to={`/specs/${feature}`} replace />;
  }

  return (
    <section data-testid="spec-document-page">
      <h1 data-testid="spec-document-heading" className="text-lg font-semibold">
        {feature}/{kind}
      </h1>
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
      return detail.tasks !== null ? <TasksFallback doc={detail.tasks} /> : <MissingArtifact kind={kind} />;
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

/** RefToken 列の原文表示（解釈しない: 構造化解釈は RefChip 5.x の責務） */
function refsRawText(refs: readonly RefToken[]): string {
  return refs.map((ref) => ref.raw).join(", ");
}

// ---------------------------------------------------------------------------
// tasks フォールバック（4.3 TasksView までの最小フォールバック）
// ---------------------------------------------------------------------------

function TaskItem({ task }: { task: TaskEntry }): JSX.Element {
  return (
    // アンカー ID `task-<id>`（design.md JumpNavigation 規約。5.2 anchors.ts が単一所有者になる）
    <div id={`task-${task.id}`} className="text-sm">
      <p>
        <span className="font-mono">{task.checked ? "[x]" : "[ ]"}</span>{" "}
        <span className="font-mono font-semibold">{task.id}</span> {task.description}
        {task.parallel && <span className="ml-1 text-slate-500">(P)</span>}
        {task.optional && <span className="ml-1 text-slate-500">（後送り可）</span>}
      </p>
      {task.details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {task.details.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
      {task.requirements.length > 0 && (
        <p className="mt-1 text-slate-600">Requirements: {refsRawText(task.requirements)}</p>
      )}
      {task.depends.length > 0 && <p className="mt-1 text-slate-600">Depends: {task.depends.join(", ")}</p>}
      {task.boundary !== null && <p className="mt-1 text-slate-600">Boundary: {task.boundary}</p>}
      {task.subtasks.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-slate-200 pl-4">
          {task.subtasks.map((subtask) => (
            <TaskItem key={subtask.id} task={subtask} />
          ))}
        </div>
      )}
    </div>
  );
}

type MergedTasksBlock = TaskEntry | RawBlock;

/** tasks + otherBlocks を position（startOffset）順にマージする（情報無欠落、2.5） */
function mergeTasksBlocks(doc: TasksDoc): MergedTasksBlock[] {
  return [...doc.tasks, ...doc.otherBlocks].sort(
    (a, b) => a.position.startOffset - b.position.startOffset,
  );
}

/** 4.3 TasksView までの最小フォールバック。契約が運ぶ全フィールドを文書順で描画する */
function TasksFallback({ doc }: { doc: TasksDoc }): JSX.Element {
  const blocks = useMemo(() => mergeTasksBlocks(doc), [doc]);
  return (
    <article className="space-y-3">
      {blocks.map((block) =>
        "kind" in block ? (
          <RawBlockView key={block.position.startOffset} markdown={block.markdown} reason={block.reason} />
        ) : (
          <TaskItem key={block.position.startOffset} task={block} />
        ),
      )}
    </article>
  );
}
