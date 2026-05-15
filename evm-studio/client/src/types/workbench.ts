/**
 * Workbench で利用するドメイン型の集約。
 *
 * tRPC ルーター (`server/src/api/evm.ts` の `EvmCalculateOutput`) の出力に基づくが、
 * クライアント側で型同期を簡潔に保つために再エクスポートする形にしている。
 * 一部の補助型（`WorkbenchProject` / `MemberInfo` 等）は UI 専用に定義する。
 */

import type { EvmCalculateOutput } from '../../../server/src/api/evm'

export type WorkbenchEvm = EvmCalculateOutput

/** Summary (現在値 + spiDelta / cpiDelta 含む) */
export type WorkbenchSummary = WorkbenchEvm['summary']

/** 前日比サマリー (prevDay は null の可能性あり) */
export type WorkbenchPrevDay = WorkbenchEvm['prevDay']

/** Assignee EVM 1 件分 */
export type AssigneeEvm = WorkbenchEvm['assignees'][number]

/** Alert 1 件分 */
export type AlertEntry = WorkbenchEvm['alerts'][number]

/** SPI トレンドポイント 1 件分 */
export type SpiTrendPoint = WorkbenchEvm['spiTrend'][number]

/** Fever チャート (null 可能) */
export type FeverChart = NonNullable<WorkbenchEvm['fever']>

/** Task EVM 1 件分 */
export type TaskEvm = WorkbenchEvm['tasks'][number]

/** Gantt メタデータ */
export type GanttMeta = WorkbenchEvm['gantt']

/**
 * Workbench で必要な最小プロジェクト情報。
 * 実際の DB 型 `Project` から UI で必要な列のみを抜粋する。
 */
export interface WorkbenchProject {
  id: number
  name: string
  code: string
  status: string
  startDate: string
  endDate: string
}

/** プロジェクトメンバー (Inspector / ProjectRail で参照) */
export interface MemberInfo {
  id: number
  name: string
  role: string
  initials: string
}

/** 派生したタスクメトリクス (Inspector で利用) */
export interface DerivedTaskMetrics {
  bac: number
  pv: number
  ev: number
  ac: number
  cpi: number | null
}
