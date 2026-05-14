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
  // baseDate フォーマット検証 (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    throw new AppError(ErrorCode.EVM_INVALID_BASE_DATE, `Invalid baseDate format: ${baseDate}`)
  }

  // availabilityRate 範囲チェック [0, 1]
  if (availabilityRate < 0 || availabilityRate > 1) {
    throw new AppError(
      ErrorCode.EVM_INVALID_AVAILABILITY_RATE,
      `availabilityRate must be in [0, 1], got: ${availabilityRate}`,
    )
  }

  // バッファタスクは PV = 0
  if (task.isBuffer) {
    return 0
  }

  // plannedStart が未設定の場合は 0
  if (task.plannedStart === null) {
    return 0
  }

  // baseDate < plannedStart → 0
  if (baseDate < task.plannedStart) {
    return 0
  }

  // baseDate >= plannedEnd → estimate_days
  if (task.plannedEnd !== null && baseDate >= task.plannedEnd) {
    return task.estimateDays
  }

  // 中間日: min(N * availabilityRate, estimateDays)
  const workingDays = countWorkingDays(task.plannedStart, baseDate, holidays)
  return Math.min(workingDays * availabilityRate, task.estimateDays)
}

/**
 * プロジェクト全体の累積 PV を算出する（is_buffer タスク除外）
 * assigneeId から members を引いて availabilityRate を取得する（見つからない場合は 1.0 を使用）
 */
export function calculateProjectPv(input: EvmInput): number {
  const { tasks, members, holidays, baseDate } = input
  return tasks
    .filter((t) => !t.isBuffer)
    .reduce((sum, task) => {
      const member =
        task.assigneeId !== null
          ? members.find((m) => m.id === task.assigneeId) ?? null
          : null
      const availabilityRate = member?.availabilityRate ?? 1.0
      return sum + calculateTaskPv(task, baseDate, availabilityRate, holidays)
    }, 0)
}

/**
 * タスク単体の EV を算出する
 * EV = estimate_days × (progress_pct / 100)
 */
export function calculateTaskEv(task: Task, progressPct: number): number {
  return task.estimateDays * (progressPct / 100)
}

/**
 * プロジェクト全体の累積 EV を算出する（is_buffer タスク除外）
 * snapshots から progressPct を参照する
 */
export function calculateProjectEv(
  tasks: Task[],
  snapshots: ProgressSnapshot[],
): number {
  return tasks
    .filter((t) => !t.isBuffer)
    .reduce((sum, task) => {
      const snapshot = snapshots.find((s) => s.taskId === task.id)
      const progressPct = snapshot?.progressPct ?? 0
      return sum + calculateTaskEv(task, progressPct)
    }, 0)
}

/**
 * プロジェクト全体の AC を算出する
 * AC = ProgressSnapshot.acDays の合計
 */
export function calculateProjectAc(snapshots: ProgressSnapshot[]): number {
  return snapshots.reduce((sum, s) => sum + s.acDays, 0)
}

/**
 * EVM 全メトリクスを一括算出する
 */
export function calculateEvmMetrics(input: EvmInput): ProjectEvmMetrics {
  const { tasks, members, holidays, snapshots, baseDate } = input

  // バッファ除外タスクのみを対象にする
  const nonBufferTasks = tasks.filter((t) => !t.isBuffer)

  // BAC = バッファ除外タスクの estimateDays 合計
  const bac = nonBufferTasks.reduce((sum, t) => sum + t.estimateDays, 0)

  // プロジェクト PV / EV / AC
  const pv = calculateProjectPv(input)
  const ev = calculateProjectEv(tasks, snapshots)
  const ac = calculateProjectAc(snapshots)

  // 派生メトリクス（プロジェクト単位）
  const spi: number | null = pv > 0 ? ev / pv : null
  const cpi: number | null = ac > 0 ? ev / ac : null
  const eac: number | null = spi !== null ? bac / spi : null
  const vac: number | null = eac !== null ? bac - eac : null
  const etc: number | null = eac !== null ? eac - ac : null
  const tcpi: number | null = bac - ac !== 0 ? (bac - ev) / (bac - ac) : null

  // タスク単位のメトリクスを算出
  const taskMetrics: TaskEvmMetrics[] = nonBufferTasks.map((task) => {
    const member =
      task.assigneeId !== null
        ? members.find((m) => m.id === task.assigneeId) ?? null
        : null
    const availabilityRate = member?.availabilityRate ?? 1.0

    const taskPv = calculateTaskPv(task, baseDate, availabilityRate, holidays)

    const snapshot = snapshots.find((s) => s.taskId === task.id)
    const progressPct = snapshot?.progressPct ?? 0
    const taskEv = calculateTaskEv(task, progressPct)
    const taskAc = snapshot?.acDays ?? 0

    const taskSpi: number | null = taskPv > 0 ? taskEv / taskPv : null
    const taskCpi: number | null = taskAc > 0 ? taskEv / taskAc : null

    const isOverdue =
      task.plannedEnd !== null &&
      baseDate > task.plannedEnd &&
      progressPct < 100

    const alertLevel = evaluateAlertLevel(taskSpi, 0, isOverdue)

    return {
      taskId: task.id,
      pv: taskPv,
      ev: taskEv,
      ac: taskAc,
      spi: taskSpi,
      cpi: taskCpi,
      alertLevel,
    }
  })

  return {
    bac,
    pv,
    ev,
    ac,
    spi,
    cpi,
    eac,
    vac,
    etc,
    tcpi,
    taskMetrics,
  }
}

/**
 * アラートレベルを評価する
 *
 * 優先順位:
 * 1. SPI = null (PV = 0) → NA（要件 4.5）
 * 2. isOverdue（planned_end 超過・未完了）→ OVERDUE（要件 4.4）
 * 3. SPI < 0.8 または delayDays > 5 → CRITICAL_DELAY（要件 4.1）
 * 4. SPI < 0.9 または delayDays > 0 → WARNING_DELAY（要件 4.2）
 * 5. SPI >= 0.9 → NORMAL（要件 4.3）
 */
export function evaluateAlertLevel(
  spi: number | null,
  delayDays: number,
  isOverdue: boolean,
): AlertLevel {
  if (spi === null) {
    return 'NA'
  }
  if (isOverdue) {
    return 'OVERDUE'
  }
  if (spi < 0.8 || delayDays > 5) {
    return 'CRITICAL_DELAY'
  }
  if (spi < 0.9 || delayDays > 0) {
    return 'WARNING_DELAY'
  }
  return 'NORMAL'
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
