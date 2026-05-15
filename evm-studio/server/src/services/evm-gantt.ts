import type { Project } from '../db/schema.js'

/**
 * ガント描画用日付軸メタデータ（Requirements 8.1-8.6）。
 *
 * - `startISO` / `endISO`: プロジェクト開始日・終了日（'YYYY-MM-DD'）
 * - `totalDays`: `startISO` から `endISO` までの暦日数（両端含む）
 * - `baseDay`: `startISO` から `baseDate` までの相対日数（整数）。
 *   `baseDate < startISO` のとき 0、`baseDate > endISO` のとき `totalDays - 1` にクリップ。
 * - `months`: `startISO ～ endISO` の範囲に含まれる各月初の
 *   相対日数 `d` と日本語月ラベル `l`（例: `'5月'`）を時系列順に返す。
 *   `startISO` を含む月は先頭に必ず含める（`startISO` が月初でない場合は `d=0` ラベルは当該月）。
 *
 * 純粋関数。DB I/O・グローバル変数・現在時刻参照を一切持たない。
 */

export interface GanttMeta {
  startISO: string
  endISO: string
  totalDays: number
  baseDay: number
  months: ReadonlyArray<{ d: number; l: string }>
}

export interface BuildGanttMetaInput {
  project: Pick<Project, 'startDate' | 'endDate'>
  baseDate: string
}

/**
 * 'YYYY-MM-DD' を UTC ベースの Date に変換する。タイムゾーンずれを避けるために UTC を採用。
 */
function parseISODateUTC(iso: string): Date {
  const parts = iso.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * 2 つの 'YYYY-MM-DD' 日付の差分を日数（整数）で返す（b - a）。
 * 両端を含む計算ではなく、純粋な差分（同一日なら 0）。
 */
function diffDays(aISO: string, bISO: string): number {
  const a = parseISODateUTC(aISO).getTime()
  const b = parseISODateUTC(bISO).getTime()
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((b - a) / msPerDay)
}

export function buildGanttMeta(input: BuildGanttMetaInput): GanttMeta {
  const { project, baseDate } = input
  const startISO = project.startDate
  const endISO = project.endDate

  // totalDays: 両端を含む暦日数（同一日なら 1）
  const totalDays = diffDays(startISO, endISO) + 1

  // baseDay: startISO からの相対日数（整数）。範囲外はクリップ
  let baseDay: number
  if (baseDate < startISO) {
    baseDay = 0
  } else if (baseDate > endISO) {
    baseDay = totalDays - 1
  } else {
    baseDay = diffDays(startISO, baseDate)
  }

  // months: 範囲内の各「月初（または startISO を含む月の起点）」を時系列順に列挙
  const months: Array<{ d: number; l: string }> = []
  const start = parseISODateUTC(startISO)
  const end = parseISODateUTC(endISO)

  // startISO を含む月を先頭に必ず含める（startISO が月初でない場合は d=0 ラベル当該月）
  months.push({
    d: 0,
    l: `${start.getUTCMonth() + 1}月`,
  })

  // 次の月初から end まで月単位で進める
  let cursorYear = start.getUTCFullYear()
  let cursorMonth = start.getUTCMonth() + 1 // 0-based → 1-based の「次月」起点に進めるため +1
  // cursorMonth が 12 を超えたら翌年に繰り上げ
  if (cursorMonth > 11) {
    cursorMonth = 0
    cursorYear += 1
  }

  while (true) {
    const firstOfMonth = new Date(Date.UTC(cursorYear, cursorMonth, 1))
    if (firstOfMonth.getTime() > end.getTime()) break

    const dISO = `${cursorYear}-${String(cursorMonth + 1).padStart(2, '0')}-01`
    months.push({
      d: diffDays(startISO, dISO),
      l: `${cursorMonth + 1}月`,
    })

    cursorMonth += 1
    if (cursorMonth > 11) {
      cursorMonth = 0
      cursorYear += 1
    }
  }

  return {
    startISO,
    endISO,
    totalDays,
    baseDay,
    months,
  }
}
