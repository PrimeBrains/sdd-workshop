/**
 * Planned Comparison Module
 *
 * 計画線比較ロジック（純関数）。
 * Progress Input Panel から切り離してテスト可能にするため、副作用なしの純関数として実装する。
 *
 * Requirements: 8.1, 8.2, 8.3
 */

const MS_PER_DAY = 86_400_000

/**
 * ISO-8601 日付文字列 (`YYYY-MM-DD` または full ISO) を UTC ベースの日数オフセットに変換する。
 * `Date` のミリ秒値を 86400000 で割って整数日に丸める。
 */
function toDayOffset(iso: string): number {
  const ms = new Date(iso).getTime()
  return Math.floor(ms / MS_PER_DAY)
}

export interface CalculatePlannedPctInput {
  /** プロジェクト開始日 (ISO-8601, 通常 `YYYY-MM-DD`) */
  projectStartISO: string
  /** スナップショット日付 (ISO-8601, 通常 `YYYY-MM-DD`) */
  snapshotDate: string
  /** タスク計画開始日 (ISO-8601) */
  taskPlannedStart: string
  /** タスク計画終了日 (ISO-8601) */
  taskPlannedEnd: string
}

/**
 * 計画線進捗率 (`plannedPct`) を 0〜100 の整数で返す純関数。
 *
 * 計算式:
 *   plannedPct = clamp(0, 100, round((snapshotOffset - taskStartOffset) / max(1, taskDuration) * 100))
 *
 * 特殊ケース:
 *   - snapshotDate < taskPlannedStart  → 0
 *   - snapshotDate >= taskPlannedEnd   → 100
 *   - taskDuration === 0               → 1 として扱う（ゼロ除算回避）
 */
export function calculatePlannedPct(input: CalculatePlannedPctInput): number {
  const { snapshotDate, taskPlannedStart, taskPlannedEnd } = input

  const snapshotOffset = toDayOffset(snapshotDate)
  const taskStartOffset = toDayOffset(taskPlannedStart)
  const taskEndOffset = toDayOffset(taskPlannedEnd)

  // 開始前
  if (snapshotOffset < taskStartOffset) {
    return 0
  }
  // 終了後（境界含む: snapshotDate >= taskPlannedEnd）
  if (snapshotOffset >= taskEndOffset) {
    return 100
  }

  const taskDuration = taskEndOffset - taskStartOffset
  // duration = 0 はゼロ除算回避のため 1 として扱う（要件 8.1）
  const effectiveDuration = Math.max(1, taskDuration)

  const rawPct = ((snapshotOffset - taskStartOffset) / effectiveDuration) * 100
  return Math.min(100, Math.max(0, Math.round(rawPct)))
}
