/**
 * Task 3.1: useEvm フック
 * Requirements: 4.1
 */

import { trpc } from '../lib/trpc'

/**
 * EVM 計算結果を取得する
 * projectId または baseDate が null のときクエリを無効化する（enabled: false）
 * staleTime: 5分（300,000ms）でキャッシュを保持する
 */
export function useEvmCalculate(projectId: number | null, baseDate: string | null) {
  return trpc.evm.calculate.useQuery(
    { projectId: projectId!, baseDate: baseDate! },
    { enabled: !!projectId && !!baseDate, staleTime: 5 * 60 * 1000 },
  )
}
