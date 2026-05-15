import type { Holiday, ProgressSnapshot, Task, TaskDependency } from '../db/schema.js'
import { findCriticalPath } from './critical-path.js'

/**
 * CCPM フィーバーチャート計算（Requirements 6.1-6.6, 11.3）。
 *
 * - クリティカルチェーンを `critical-path.ts` の `findCriticalPath` で特定する
 *   （`isBuffer === true` のタスクは除外される）。循環依存検出時は
 *   `findCriticalPath` 内で `EVM_CIRCULAR_DEPENDENCY` が伝播する（要件 11.3）。
 * - プロジェクトがバッファタスク（`isBuffer === true`）を持たない場合は `null` を返す（要件 6.5）。
 * - `bufferConsumption = 累積遅延日数 / バッファ総日数`
 *   - 累積遅延日数 = クリティカルチェーン上のタスクの `acDays - evDays`
 *     （AC が EV を超過した分が遅延の現れとして消費されたバッファ日数。負値は遅延なしとして 0 にクランプ）
 *   - バッファ総日数 = `isBuffer === true` タスクの `estimateDays` 合計
 *   - `バッファ総日数 === 0` のとき `0` を返す（ゼロ除算回避、要件 6.6）。
 * - `criticalChainCompletion = 完了 EV / クリティカルチェーン BAC`
 *   - 完了 EV = クリティカルチェーン上のタスクの `estimateDays * progressPct / 100` 合計
 *   - クリティカルチェーン BAC = クリティカルチェーン上タスクの `estimateDays` 合計
 *   - `バッファタスクは含まない`（クリティカルチェーンの定義は非バッファ）
 *   - `BAC === 0` のとき `0` を返す（ゼロ除算回避、要件 6.6）。
 * - ゾーン判定（要件 6.3）:
 *   - `bufferConsumption < criticalChainCompletion * 0.67` → `GREEN`
 *   - `bufferConsumption < criticalChainCompletion * 1.0`  → `YELLOW`
 *   - それ以上                                            → `RED`
 * - `trail` は `trendWindowDays`（デフォルト 30）日分のスナップショット日付を昇順に並べ、
 *   各時点の `(x: criticalChainCompletion, y: bufferConsumption)` を時系列順に返す（要件 6.4）。
 *
 * 純粋関数。DB I/O・グローバル変数・現在時刻参照を一切持たない。
 */

const DEFAULT_TREND_WINDOW_DAYS = 30

export type FeverChartZone = 'GREEN' | 'YELLOW' | 'RED'

export interface FeverPoint {
  /** クリティカルチェーン完了率 */
  x: number
  /** バッファ消費率 */
  y: number
}

export interface FeverChart {
  bufferConsumption: number
  criticalChainCompletion: number
  zone: FeverChartZone
  trail: ReadonlyArray<FeverPoint>
}

export interface CalculateFeverInput {
  baseDate: string
  tasks: ReadonlyArray<Task>
  dependencies: ReadonlyArray<TaskDependency>
  snapshots: ReadonlyArray<ProgressSnapshot>
  holidays: ReadonlyArray<Holiday>
  /** trail の対象期間。未指定時はデフォルト 30 日。 */
  trendWindowDays?: number
}

/**
 * `baseDate` から `windowDays - 1` 日前の日付を 'YYYY-MM-DD' で返す。
 * UTC ベース計算でタイムゾーンずれを避ける。
 */
function calculateWindowStart(baseDate: string, windowDays: number): string {
  const parts = baseDate.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() - (windowDays - 1))
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * 指定したスナップショット集合から、各タスクの「`date` 以前の最新スナップショット」を採用する。
 * `evm-trend.ts` と同じ採用ルール（taskId ごとに最新 snapshotDate を 1 件採用）。
 */
function snapshotsAt(
  snapshots: ReadonlyArray<ProgressSnapshot>,
  date: string,
): ProgressSnapshot[] {
  const byTask = new Map<number, ProgressSnapshot>()
  for (const snap of snapshots) {
    if (snap.snapshotDate > date) continue
    const existing = byTask.get(snap.taskId)
    if (existing === undefined || snap.snapshotDate > existing.snapshotDate) {
      byTask.set(snap.taskId, snap)
    }
  }
  return Array.from(byTask.values())
}

/**
 * ゾーン判定（要件 6.3）。
 */
function decideZone(bufferConsumption: number, criticalChainCompletion: number): FeverChartZone {
  if (bufferConsumption < criticalChainCompletion * 0.67) {
    return 'GREEN'
  }
  if (bufferConsumption < criticalChainCompletion * 1.0) {
    return 'YELLOW'
  }
  return 'RED'
}

/**
 * 指定スナップショット集合から、`chainTaskIds` のクリティカルチェーン上で
 * `(bufferConsumption, criticalChainCompletion)` を算出する。
 *
 * - `bufferTotalDays === 0` → `bufferConsumption = 0`
 * - `bacOfChain === 0`      → `criticalChainCompletion = 0`
 */
function calculateRatios(args: {
  chainTaskIds: ReadonlyArray<number>
  bufferTotalDays: number
  bacOfChain: number
  taskById: ReadonlyMap<number, Task>
  snapshotsAtDate: ReadonlyArray<ProgressSnapshot>
}): { bufferConsumption: number; criticalChainCompletion: number } {
  const { chainTaskIds, bufferTotalDays, bacOfChain, taskById, snapshotsAtDate } = args

  const chainIdSet = new Set(chainTaskIds)
  let evOnChain = 0
  let cumulativeDelayDays = 0

  for (const snap of snapshotsAtDate) {
    if (!chainIdSet.has(snap.taskId)) continue
    const task = taskById.get(snap.taskId)
    if (task === undefined) continue
    // EV = estimateDays * (progressPct / 100)
    const taskEv = task.estimateDays * (snap.progressPct / 100)
    evOnChain += taskEv
    // 遅延 = AC - EV（AC が EV を超過した分のみカウント、負値は 0）
    const delay = snap.acDays - taskEv
    if (delay > 0) {
      cumulativeDelayDays += delay
    }
  }

  const bufferConsumption =
    bufferTotalDays > 0 ? cumulativeDelayDays / bufferTotalDays : 0
  const criticalChainCompletion = bacOfChain > 0 ? evOnChain / bacOfChain : 0

  return { bufferConsumption, criticalChainCompletion }
}

export function calculateFever(input: CalculateFeverInput): FeverChart | null {
  const { baseDate, tasks, dependencies, snapshots, trendWindowDays } = input

  // バッファタスク非存在 → null（要件 6.5）
  const bufferTasks = tasks.filter((t) => t.isBuffer)
  if (bufferTasks.length === 0) {
    return null
  }

  // クリティカルチェーンを特定（findCriticalPath は isBuffer=true を除外する）
  const cp = findCriticalPath({
    tasks: tasks as Task[],
    dependencies: dependencies as TaskDependency[],
  })
  const chainTaskIds = cp.criticalPath

  // タスク ID → Task のマップ
  const taskById = new Map<number, Task>(tasks.map((t) => [t.id, t]))

  // クリティカルチェーン BAC（非バッファのみ） + バッファ総日数
  const bacOfChain = chainTaskIds.reduce((sum, id) => {
    const t = taskById.get(id)
    return t !== undefined ? sum + t.estimateDays : sum
  }, 0)
  const bufferTotalDays = bufferTasks.reduce((sum, t) => sum + t.estimateDays, 0)

  // baseDate 時点の比率を算出
  const snapshotsAtBase = snapshotsAt(snapshots, baseDate)
  const { bufferConsumption, criticalChainCompletion } = calculateRatios({
    chainTaskIds,
    bufferTotalDays,
    bacOfChain,
    taskById,
    snapshotsAtDate: snapshotsAtBase,
  })

  const zone = decideZone(bufferConsumption, criticalChainCompletion)

  // trail を構築:
  //   trendWindowDays 日分のスナップショット日付を昇順に並べ、各時点の (x, y) を時系列順に格納
  const windowDays =
    trendWindowDays !== undefined && trendWindowDays > 0
      ? trendWindowDays
      : DEFAULT_TREND_WINDOW_DAYS
  const rangeStart = calculateWindowStart(baseDate, windowDays)

  const uniqueDates = new Set<string>()
  for (const snap of snapshots) {
    if (snap.snapshotDate >= rangeStart && snap.snapshotDate <= baseDate) {
      uniqueDates.add(snap.snapshotDate)
    }
  }
  const sortedDates = Array.from(uniqueDates).sort()

  const trail: FeverPoint[] = sortedDates.map((date) => {
    const snapsAt = snapshotsAt(snapshots, date)
    const ratios = calculateRatios({
      chainTaskIds,
      bufferTotalDays,
      bacOfChain,
      taskById,
      snapshotsAtDate: snapsAt,
    })
    return {
      x: ratios.criticalChainCompletion,
      y: ratios.bufferConsumption,
    }
  })

  return {
    bufferConsumption,
    criticalChainCompletion,
    zone,
    trail,
  }
}
