/**
 * TasksView — tasks.md の構造化ビューア
 * （tasks.md 4.3 / Requirement 2.4 / design.md TasksView・File Structure Plan）。
 *
 * - `TaskEntry` 階層をメジャー → サブタスクの入れ子で描画する（`subtasks` をネスト）。
 *   各タスクに完了状態の checkbox 表示（`checked`）・`(P)` バッジ（`parallel`）・
 *   `*` バッジ（`optional` = 後送り）を出す（2.4）
 * - 各タスクに `requirements`（RefToken 列を静的チップで原文表示）・`depends`
 *   （タスクアンカー `#task-<id>` へのリンク）・`boundary`（テキスト）・`details`
 *   （bullet）を描画する（2.4）
 * - 各タスクに要素アンカー `task-<id>` を払い出す（design.md JumpNavigation 規約・
 *   3.2 の暫定払い出しと互換。anchors.ts（anchorIdOf）が規約の単一所有者でありそれを使用する）
 * - tasks + otherBlocks を position（startOffset）順にマージし、raw フォールバックを含め
 *   DocBlockList 経由で文書順に描画する（情報無欠落、2.5）
 * - チェックボックスは読み取り専用の表示のみ（完了状態の変更は行わない、8.1）。input /
 *   button を使わず装飾要素で表現する
 * - 参照チップは 5.3（RefChip）までは静的・非インタラクティブで、RefToken の kind 別に
 *   原文（raw）を忠実に表示する
 * - DocBlockList の memo 前提を守るため、renderStructured はモジュールレベル関数で参照安定
 *
 * 境界: TasksView（タスク階層・マーカー・注記）のみ。RefChip の対応先解決・ジャンプ（5.3）、
 * anchors.ts / useJump（5.2）、trace index（5.1）は本タスクの範囲外。
 */
import { useMemo, type JSX, type ReactNode } from "react";
import type { DocBlock } from "@contracts/document";
import type { TaskEntry, TasksDoc } from "@contracts/spec";
import type { NodeRef, RefToken } from "@contracts/trace";
import { RefChip } from "@/features/crosslink/RefChip";
import { DocBlockList, type StructuredBlock } from "@/markdown/DocBlockList";
import { anchorIdOf } from "@/navigation/anchors";

export interface TasksViewProps {
  doc: TasksDoc;
}

/** タスクアンカー ID（`task-<id>`）。anchors.ts（anchorIdOf）が規約の単一所有者 */
function taskAnchorId(id: string): string {
  return anchorIdOf({ type: "task", id });
}

/** RefToken の安定キー（同一タスク内で raw が重複しても位置で区別する） */
function refTokenKey(token: RefToken, index: number): string {
  return `${index}:${token.raw}`;
}

/**
 * 参照チップ列。各 RefToken を RefChip（5.3）に委譲する。origin はこのタスクノード
 * （タスク → 参照している要件へジャンプする方向 → 3.2）。
 */
function RefChipList({ refs, origin }: { refs: readonly RefToken[]; origin: NodeRef }): JSX.Element {
  return (
    <span className="flex flex-wrap gap-1">
      {refs.map((token, index) => (
        <RefChip key={refTokenKey(token, index)} token={token} origin={origin} />
      ))}
    </span>
  );
}

/**
 * 完了状態の読み取り専用表示（8.1: 完了状態の変更は行わない）。
 * input / button を使わず装飾要素で表現し、状態は data-checked で公開する。
 */
function CompletionMark({ checked }: { checked: boolean }): JSX.Element {
  return (
    <span
      data-testid="task-checkbox"
      data-checked={checked}
      aria-hidden="true"
      className="shrink-0 font-mono text-slate-500"
    >
      {checked ? "[x]" : "[ ]"}
    </span>
  );
}

/** depends（先行タスク ID 列）をタスクアンカーへのリンクとして描画する */
function DependsLinks({ depends }: { depends: readonly string[] }): JSX.Element {
  return (
    <span className="flex flex-wrap gap-2">
      {depends.map((id) => (
        <a
          key={id}
          data-testid="task-depends-link"
          href={`#${taskAnchorId(id)}`}
          className="font-mono text-xs text-sky-700 hover:underline"
        >
          {id}
        </a>
      ))}
    </span>
  );
}

/** 1 タスク（メジャー or サブ）の描画。サブタスクは要素配下に入れ子描画する */
function TaskItem({ task }: { task: TaskEntry }): JSX.Element {
  return (
    <div
      id={taskAnchorId(task.id)}
      data-testid="task-item"
      // 比較ビュー（6.2）の選択起点。delegation で NodeRef を復元するための種別 / ID。
      data-node-type="task"
      data-node-id={task.id}
      className="text-sm"
    >
      {/* タスク自身の行（マーカー・注記・details）。サブタスクは別の入れ子ブロックに分離し、
          このタスク固有の内容だけを task-row として参照可能にする */}
      <div data-testid="task-row" data-task-id={task.id}>
        <p className="flex flex-wrap items-baseline gap-1">
        <CompletionMark checked={task.checked} />
        <span className="font-mono font-semibold">{task.id}</span>
        <span>{task.description}</span>
        {task.parallel && (
          <span
            data-testid="task-parallel-badge"
            className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-700"
          >
            (P)
          </span>
        )}
        {task.optional && (
          <span
            data-testid="task-optional-badge"
            title="後送り可"
            className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-700"
          >
            *
          </span>
        )}
      </p>

      {task.details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-6">
          {task.details.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}

      {task.requirements.length > 0 && (
        <p className="mt-1 flex flex-wrap items-baseline gap-1 text-slate-600">
          <span className="text-xs font-semibold text-slate-500">Requirements</span>
          <RefChipList refs={task.requirements} origin={{ type: "task", id: task.id }} />
        </p>
      )}

      {task.depends.length > 0 && (
        <p className="mt-1 flex flex-wrap items-baseline gap-1 text-slate-600">
          <span className="text-xs font-semibold text-slate-500">Depends</span>
          <DependsLinks depends={task.depends} />
        </p>
      )}

        {task.boundary !== null && (
          <p className="mt-1 text-slate-600">
            <span className="text-xs font-semibold text-slate-500">Boundary</span>{" "}
            <span data-testid="task-boundary">{task.boundary}</span>
          </p>
        )}
      </div>

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

/** マージ後リストの structured ペイロード（タスクエントリ） */
type TaskPayload = Omit<TaskEntry, "position">;

/**
 * tasks + otherBlocks を position（startOffset）順にマージする。
 * サーバー側不変則（position 連結 = 元文書全体）を表示順でも保つ（情報無欠落、2.5）。
 * tasks は構造化ブロックとして `kind: "structured"` を補って DocBlock 列に正規化する。
 */
function mergeTasksBlocks(doc: TasksDoc): Array<DocBlock<TaskPayload>> {
  const taskBlocks: Array<DocBlock<TaskPayload>> = doc.tasks.map((task) => ({
    ...task,
    kind: "structured",
  }));
  return [...taskBlocks, ...doc.otherBlocks].sort(
    (a, b) => a.position.startOffset - b.position.startOffset,
  );
}

/** マージ後リストの structured 描画（モジュールレベルで参照安定 — DocBlockList の memo 前提） */
function renderTaskBlock(block: StructuredBlock<TaskPayload>): ReactNode {
  return <TaskItem task={block} />;
}

export function TasksView({ doc }: TasksViewProps): JSX.Element {
  const blocks = useMemo(() => mergeTasksBlocks(doc), [doc]);
  return (
    <article data-testid="tasks-view" className="space-y-3">
      <DocBlockList<TaskPayload> blocks={blocks} renderStructured={renderTaskBlock} />
    </article>
  );
}
