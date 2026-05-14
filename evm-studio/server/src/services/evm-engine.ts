import type { Holiday, Member, ProgressSnapshot, Task } from '../db/schema.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

// --- 出力型 ---

export type AlertLevel = 'CRITICAL_DELAY' | 'WARNING_DELAY' | 'NORMAL' | 'OVERDUE' | 'NA'

/** タスク単位の EVM メトリクス */
export interface TaskEvmMetrics {
  taskId: number
  pv: number
  ev: number
  ac: number
  spi: number | null
  cpi: number | null
  alertLevel: AlertLevel
}

/** プロジェクト単位の EVM サマリー */
export interface ProjectEvmMetrics {
  bac: number
  pv: number
  ev: number
  ac: number
  spi: number | null
  cpi: number | null
  eac: number | null
  vac: number | null
  etc: number | null
  tcpi: number | null
  taskMetrics: TaskEvmMetrics[]
}

export type FeverChartZone = 'GREEN' | 'YELLOW' | 'RED'

/** CCPM フィーバーチャートデータ */
export interface FeverChartData {
  bufferConsumption: number
  criticalChainCompletion: number
  zone: FeverChartZone
}

/** EVM 計算に必要なスナップショット入力 */
export interface EvmInput {
  tasks: Task[]
  members: Member[]
  holidays: Holiday[]
  snapshots: ProgressSnapshot[]
  baseDate: string
}

// --- ユーティリティ ---

/**
 * 'YYYY-MM-DD' 文字列を UTC ベースの Date オブジェクトに変換する
 */
function parseUTCDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(Date.UTC(year, month - 1, day))
}

// --- 公開関数 ---

/**
 * planned_start から baseDate までの稼働日数を算出する
 * 土日・holidays を除外する
 * 内部ユーティリティ（テスト可能性のためエクスポート）
 */
export function countWorkingDays(
  plannedStart: string,
  baseDate: string,
  holidays: Holiday[],
): number {
  const start = parseUTCDate(plannedStart)
  const end = parseUTCDate(baseDate)

  // plannedStart > baseDate の場合は 0 を返す
  if (start > end) {
    return 0
  }

  // holidays の date セットを作成（高速ルックアップ用）
  const holidaySet = new Set(holidays.map((h) => h.date))

  let count = 0
  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay()
    const isSaturday = dayOfWeek === 6
    const isSunday = dayOfWeek === 0

    if (!isSaturday && !isSunday) {
      // UTC ベースで 'YYYY-MM-DD' 形式に変換して祝日チェック
      const year = current.getUTCFullYear()
      const month = String(current.getUTCMonth() + 1).padStart(2, '0')
      const day = String(current.getUTCDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      if (!holidaySet.has(dateStr)) {
        count++
      }
    }

    // 翌日へ進む（UTC ベースで +1 日）
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return count
}

/**
 * タスク単体の PV を算出する（fill-to-capacity モデル WBS-CMN-013）
 */
export function calculateTaskPv(
  task: Task,
  baseDate: string,
  availabilityRate: number,
  holidays: Holiday[],
): number {
  throw new AppError(ErrorCode.EVM_INVALID_BASE_DATE, 'Not implemented')
}

/**
 * プロジェクト全体の累積 PV を算出する（is_buffer タスク除外）
 */
export function calculateProjectPv(input: EvmInput): number {
  return 0
}

/**
 * タスク単体の EV を算出する
 * EV = estimate_days × (progress_pct / 100)
 */
export function calculateTaskEv(task: Task, progressPct: number): number {
  return 0
}

/**
 * プロジェクト全体の累積 EV を算出する（is_buffer タスク除外）
 */
export function calculateProjectEv(
  tasks: Task[],
  snapshots: ProgressSnapshot[],
): number {
  return 0
}

/**
 * プロジェクト全体の AC を算出する
 */
export function calculateProjectAc(snapshots: ProgressSnapshot[]): number {
  return 0
}

/**
 * EVM 全メトリクスを一括算出する
 */
export function calculateEvmMetrics(input: EvmInput): ProjectEvmMetrics {
  return {
    bac: 0,
    pv: 0,
    ev: 0,
    ac: 0,
    spi: null,
    cpi: null,
    eac: null,
    vac: null,
    etc: null,
    tcpi: null,
    taskMetrics: [],
  }
}

/**
 * アラートレベルを評価する
 */
export function evaluateAlertLevel(
  spi: number | null,
  delayDays: number,
  isOverdue: boolean,
): AlertLevel {
  return 'NA'
}

/**
 * CCPM フィーバーチャートデータを算出する
 */
export function calculateFeverChart(
  cumulativeDelayDays: number,
  bufferTotalDays: number,
  completedEvOnChain: number,
  bacOfChain: number,
): FeverChartData {
  return {
    bufferConsumption: 0,
    criticalChainCompletion: 0,
    zone: 'GREEN',
  }
}
