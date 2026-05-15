/**
 * Task 3.1: useEvm フック
 * Requirements: 13.1-13.7
 *
 * `trpc.evm.calculate.useQuery` を TanStack Query でラップする。
 * - 入力 `{ projectId: number | null, baseDate: string }`
 * - `projectId === null` または `baseDate` が `YYYY-MM-DD` 形式でない場合は `enabled: false`
 * - queryKey は tRPC が自動生成
 * - 戻り値の `data` は tRPC が推論する `EvmCalculateOutput` 型を保持
 */

import { trpc } from '../lib/trpc'

export interface UseEvmInput {
  projectId: number | null
  /** 'YYYY-MM-DD' 形式の基準日 */
  baseDate: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * EVM 計算結果を取得するフック (WorkbenchPage 専用)。
 */
export function useEvm({ projectId, baseDate }: UseEvmInput) {
  return trpc.evm.calculate.useQuery(
    { projectId: projectId!, baseDate },
    {
      enabled: projectId !== null && ISO_DATE_RE.test(baseDate),
      staleTime: 5 * 60 * 1000,
    },
  )
}

/**
 * 旧来の引数列スタイルの薄いラッパー。
 * Phase 1-2 の `DashboardPage` 互換性のため残置。Phase 4 で DashboardPage を削除する際に同時に撤去する。
 */
export function useEvmCalculate(projectId: number | null, baseDate: string | null) {
  return trpc.evm.calculate.useQuery(
    { projectId: projectId!, baseDate: baseDate! },
    { enabled: !!projectId && !!baseDate, staleTime: 5 * 60 * 1000 },
  )
}
