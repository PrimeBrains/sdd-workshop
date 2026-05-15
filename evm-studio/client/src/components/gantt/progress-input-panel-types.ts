/**
 * Task 5.1: ProgressInputPanel 型定義
 * Requirements: 6.1, 6.2
 *
 * ProgressInputPanel コンポーネントの props 契約および補助型を定義する。
 * `ProgressSnapshot` は tRPC ルーターの推論型から導出することで、
 * サーバー側スキーマと自動的に同期する。
 */

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '../../../../server/src/router'

type RouterOutputs = inferRouterOutputs<AppRouter>

/**
 * 単一タスクの最新スナップショット型。
 * `progress.getLatest` の戻り値（`ProgressSnapshot | null`）から
 * `null` を除外して非 null 化したもの。
 */
export type ProgressSnapshot = NonNullable<RouterOutputs['progress']['getLatest']>

/**
 * ProgressInputPanel が受け入れるタスク情報の形状。
 * 親コンポーネント（GanttFullscreen 等）が GanttTaskOutput や WBS から
 * 必要なフィールドを抽出して渡す。
 *
 * - `bac`: 見積工数 (estimateDays / MD)
 * - `spi`: 現時点の SPI（null = 未計算）
 * - `ancestors`: パンくず用の祖先タスク（root → 親 の順）
 * - `plannedStart` / `plannedEnd`: ISO-8601 `YYYY-MM-DD`
 */
export interface ProgressInputTask {
  id: number
  code: string
  name: string
  assigneeName: string | null
  plannedStart: string
  plannedEnd: string
  bac: number
  spi: number | null
  ancestors: Array<{ id: number; name: string }>
}

/**
 * ProgressInputPanel の props 契約。
 *
 * - `projectStartISO`: 計画線比較で使う基準日（プロジェクト開始日）
 * - `baseDate`: 「今日」扱いの基準日。スナップショット入力の `max` 属性に使う
 * - `snapshotDate`: 現在選択中のスナップショット日（親が制御）
 * - `onSnapshotDateChange`: ユーザーが日付を変更したときに親へ通知
 * - `onClose`: パネルを閉じるとき（キャンセル or 保存成功時）に呼ばれる
 * - `onSaved?`: 保存成功後、保存されたスナップショットを通知する任意 callback
 */
export interface ProgressInputPanelProps {
  task: ProgressInputTask
  projectStartISO: string
  baseDate: string
  snapshotDate: string
  onSnapshotDateChange: (date: string) => void
  onClose: () => void
  onSaved?: (snapshot: ProgressSnapshot) => void
}
