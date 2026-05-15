/**
 * Task 4.2a: deriveAncestors ユーティリティ
 * Requirements: 8.2
 *
 * 与えられたタスクの祖先タスク（ルート → 親 の順）を `code` 階層から逆引きする純関数。
 * 一致しないプレフィックスはスキップし、祖先欠落データに対しても安全に動作する。
 */

import type { TaskEvm } from '@/types/workbench'

/**
 * `task.code` を `'.'` で分割し、自身を除く各プレフィックスについて
 * `allTasks` から `code` が完全一致するタスクを探し、`{ id, name }` を
 * ルート → 親 の順に積んで返す。
 *
 * 例: `task.code === '1.2.3'` → プレフィックスは `['1', '1.2']`。
 *      それぞれに対応するタスクが見つかれば `[root, parent]` を返す。
 *
 * @param task - 対象タスク
 * @param allTasks - 検索対象の全タスク（プロジェクト内の TaskEvm[]）
 * @returns 祖先タスクの `{ id, name }` 配列（ルート → 親 の順）。一致なしは空配列。
 */
export function deriveAncestors(
  task: TaskEvm,
  allTasks: ReadonlyArray<TaskEvm>,
): Array<{ id: number; name: string }> {
  const parts = task.code.split('.')
  const ancestors: Array<{ id: number; name: string }> = []
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join('.')
    const parent = allTasks.find((t) => t.code === prefix)
    if (parent) ancestors.push({ id: parent.id, name: parent.name })
  }
  return ancestors
}
