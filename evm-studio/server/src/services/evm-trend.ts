import type { Holiday, Member, ProgressSnapshot, Project, Task } from '../db/schema.js'
import { calculateEvmMetrics } from './evm-engine.js'

/**
 * SPI/CPI 時系列ポイント配列生成（Requirements 5.1-5.6）。
 *
 * - スナップショット日付の集合 D を `[project.startDate, baseDate]` 範囲から抽出する。
 * - `trendWindowDays` 指定時は `baseDate - trendWindowDays + 1` から `baseDate` までに絞る。
 * - 指定なしは `project.startDate` から `baseDate` までの全範囲を対象。
 * - D を昇順に並べ、各 `d ∈ D` で `calculateEvmMetrics({ baseDate: d, ... })` を実行し、
 *   `{ d: 'MM-DD', spi, cpi }` を時系列順に返す。
 * - `spi === null` / `cpi === null` の点はそのまま含める（クライアント側で欠損として扱う）。
 * - スナップショット 0 件のとき `[]` を返す。
 *
 * 純粋関数。DB I/O・グローバル変数・現在時刻参照を一切持たない。
 */

export interface BuildSpiTrendInput {
  baseDate: string
  /**
   * 直近 N 日分のみを対象にしたい場合に指定する。
   * 未指定時は `project.startDate ～ baseDate` の全範囲を対象にする。
   */
  trendWindowDays?: number
  project: Pick<Project, 'startDate' | 'endDate'>
  tasks: ReadonlyArray<Task>
  members: ReadonlyArray<Member>
  holidays: ReadonlyArray<Holiday>
  snapshots: ReadonlyArray<ProgressSnapshot>
}

export interface SpiTrendPoint {
  /** 'MM-DD' 形式の日付ラベル */
  d: string
  spi: number | null
  cpi: number | null
}

/**
 * 'YYYY-MM-DD' から 'MM-DD' を切り出す（純粋なスライス処理）。
 * 入力フォーマットの厳密検証は `calculateEvmMetrics` 側に委ねる。
 */
function toMonthDay(isoDate: string): string {
  return isoDate.slice(5)
}

/**
 * `baseDate` から `trendWindowDays - 1` 日前の日付を 'YYYY-MM-DD' で返す。
 * UTC ベースで計算しタイムゾーンずれを起こさない。
 */
function calculateWindowStart(baseDate: string, trendWindowDays: number): string {
  const parts = baseDate.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() - (trendWindowDays - 1))
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function buildSpiTrend(input: BuildSpiTrendInput): ReadonlyArray<SpiTrendPoint> {
  const { baseDate, trendWindowDays, project, tasks, members, holidays, snapshots } = input

  if (snapshots.length === 0) {
    return []
  }

  // 対象範囲の下限を決定する。
  // - trendWindowDays 指定時: baseDate から遡って N 日分（baseDate - (N-1)）
  // - 未指定時: project.startDate
  const rangeStart =
    trendWindowDays !== undefined && trendWindowDays > 0
      ? calculateWindowStart(baseDate, trendWindowDays)
      : project.startDate

  // ユニークな snapshotDate を抽出し、[rangeStart, baseDate] に収まるものだけ採用する。
  const uniqueDates = new Set<string>()
  for (const snap of snapshots) {
    if (snap.snapshotDate >= rangeStart && snap.snapshotDate <= baseDate) {
      uniqueDates.add(snap.snapshotDate)
    }
  }

  if (uniqueDates.size === 0) {
    return []
  }

  // 昇順に並べる（ISO 文字列は辞書順 = 時系列順）
  const sortedDates = Array.from(uniqueDates).sort()

  // 入力配列を毎ポイントで使い回せるよう、変換コストを 1 度だけ払う
  const tasksArr = tasks as Task[]
  const membersArr = members as Member[]
  const holidaysArr = holidays as Holiday[]

  return sortedDates.map<SpiTrendPoint>((date) => {
    // 各日付時点のスナップショットだけを渡し、calculateEvmMetrics に再計算させる。
    // 同一タスクで複数スナップショットが残ると最初のものが採用されてしまうため、
    // taskId ごとに「date 以前で最新」を 1 件ずつ採用する。
    const snapshotsByTask = new Map<number, ProgressSnapshot>()
    for (const snap of snapshots) {
      if (snap.snapshotDate > date) continue
      const existing = snapshotsByTask.get(snap.taskId)
      if (existing === undefined || snap.snapshotDate > existing.snapshotDate) {
        snapshotsByTask.set(snap.taskId, snap)
      }
    }
    const snapshotsAtDate = Array.from(snapshotsByTask.values())

    const metrics = calculateEvmMetrics({
      baseDate: date,
      tasks: tasksArr,
      members: membersArr,
      holidays: holidaysArr,
      snapshots: snapshotsAtDate,
      project,
    })

    return {
      d: toMonthDay(date),
      spi: metrics.spi,
      cpi: metrics.cpi,
    }
  })
}
