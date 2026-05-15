/**
 * Task 3.3: useProgress フック
 * Requirements: 7.1, 7.2, 7.3, 7.4
 *
 * 新しい progress tRPC ルーター（getLatest / getByDate / getHistory / record）に
 * 対応した React Query フックを提供する。
 */

import { trpc } from '../lib/trpc'

/**
 * 指定タスクの最新スナップショットを取得する（要件 7.1）
 * 戻り値の data 型は ProgressSnapshot | null | undefined
 */
export function useProgressLatest(taskId: number | null) {
  return trpc.progress.getLatest.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId },
  )
}

/**
 * 指定プロジェクト・日付のスナップショット一覧を取得する（要件 7.2）
 * 戻り値の data 型は ProgressSnapshot[] | undefined
 */
export function useProgressByDate(
  projectId: number | null,
  snapshotDate: string | null,
) {
  return trpc.progress.getByDate.useQuery(
    { projectId: projectId!, snapshotDate: snapshotDate! },
    { enabled: !!projectId && !!snapshotDate },
  )
}

/**
 * 指定タスクのスナップショット履歴（昇順）を取得する（要件 7.3）
 */
export function useProgressHistory(taskId: number | null) {
  return trpc.progress.getHistory.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId },
  )
}

/**
 * 進捗スナップショットを記録するミューテーション（要件 7.4）
 * 成功後に progress.getLatest / progress.getByDate / progress.getHistory の
 * キャッシュを invalidate する。
 */
export function useRecordProgress() {
  const utils = trpc.useUtils()

  return trpc.progress.record.useMutation({
    onSuccess: () => {
      void utils.progress.getLatest.invalidate()
      void utils.progress.getByDate.invalidate()
      void utils.progress.getHistory.invalidate()
    },
  })
}

/**
 * プロジェクト一覧を取得する（既存呼び出し元の互換維持: ProgressInputPage）
 */
export function useProjects() {
  return trpc.projects.list.useQuery()
}

/**
 * 指定プロジェクトのタスク一覧を取得する（既存呼び出し元の互換維持: ProgressInputPage）
 */
export function useTasksByProject(projectId: number | null) {
  return trpc.tasks.listByProject.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: !!projectId },
  )
}
