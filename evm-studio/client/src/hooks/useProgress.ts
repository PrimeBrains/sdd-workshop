/**
 * Task 3.2: useProgress フック
 * Requirements: 5.1, 5.2, 5.3, 5.8
 */

import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'

/**
 * 指定プロジェクト・日付のスナップショット一覧を取得する
 * 既存スナップショットの初期値取得に使用（要件 5.8）
 */
export function useProgressByDate(
  projectId: number | null,
  snapshotDate: string | null,
) {
  return trpc.progress.getByDate.useQuery(
    {
      projectId: projectId ?? 0,
      snapshotDate: snapshotDate ?? '',
    },
    {
      enabled: !!projectId && !!snapshotDate,
    },
  )
}

/**
 * 進捗スナップショットを記録するミューテーション（要件 5.3）
 * 成功後に progress.getByDate のキャッシュを invalidate する
 */
export function useRecordProgress() {
  const qc = useQueryClient()

  return trpc.progress.record.useMutation({
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trpc', 'progress', 'getByDate'] })
    },
  })
}

/**
 * プロジェクト一覧を取得する（要件 5.1）
 */
export function useProjects() {
  return trpc.projects.list.useQuery()
}

/**
 * 指定プロジェクトのタスク一覧を取得する（要件 5.2）
 */
export function useTasksByProject(projectId: number | null) {
  return trpc.tasks.listByProject.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: !!projectId },
  )
}
