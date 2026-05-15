import { describe, expect, it } from 'vitest'
import { buildSpiTrend } from './evm-trend.js'
import type { Holiday, Member, ProgressSnapshot, Project, Task } from '../db/schema.js'

/**
 * buildSpiTrend の単体テスト（Requirements 5.1-5.6）。
 *
 * 仕様:
 * - スナップショット日付の集合 D を `[project.startDate, baseDate]` 範囲から抽出し、
 *   `trendWindowDays` 指定時は `baseDate` から遡って N 日分のみを残す。
 * - D を昇順に並べ、各 d で `calculateEvmMetrics({ baseDate: d, ... })` を実行し
 *   `{ d: 'MM-DD', spi, cpi }` を時系列順に返す。
 * - スナップショット 0 件のとき `[]` を返す。
 * - `spi === null` の点（プロジェクト開始時点で pv=0 になるケース）はそのまま含める。
 */

// 共通フィクスチャ -----------------------------------------------------------

const baseProject: Pick<Project, 'startDate' | 'endDate'> = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
}

const baseMember: Member = {
  id: 1,
  projectId: 1,
  externalId: null,
  name: '田中',
  role: null,
  initials: null,
  availabilityRate: 1.0,
  assignmentStart: null,
  assignmentEnd: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const baseTask: Task = {
  id: 1,
  projectId: 1,
  externalId: null,
  name: 'タスクA',
  estimateDays: 10,
  plannedStart: '2026-05-04',
  plannedEnd: '2026-05-15',
  actualStart: null,
  actualEnd: null,
  parentId: null,
  assigneeId: 1,
  level: 1,
  sortOrder: 0,
  isBuffer: false,
  isLeaf: true,
  remarks: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeSnapshot(overrides: Partial<ProgressSnapshot>): ProgressSnapshot {
  return {
    id: 1,
    taskId: 1,
    snapshotDate: '2026-05-13',
    progressPct: 0,
    pvDays: 0,
    evDays: 0,
    acDays: 0,
    note: null,
    createdAt: new Date(),
    ...overrides,
  }
}

const noHolidays: Holiday[] = []

// ---------------------------------------------------------------------------

describe('buildSpiTrend', () => {
  it('スナップショット 0 件のとき空配列を返す（要件 5.6）', () => {
    const result = buildSpiTrend({
      baseDate: '2026-05-13',
      project: baseProject,
      tasks: [baseTask],
      members: [baseMember],
      holidays: noHolidays,
      snapshots: [],
    })

    expect(result).toEqual([])
  })

  it('windowDays 未指定: プロジェクト開始日から baseDate までの全範囲を対象にする（要件 5.3）', () => {
    // baseDate=2026-05-13、複数日のスナップショット
    // 全 4 日のスナップショットが昇順に並んで返ることを確認する
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-13', progressPct: 100, acDays: 10 }),
      makeSnapshot({ id: 2, taskId: 1, snapshotDate: '2026-05-04', progressPct: 20, acDays: 2 }),
      makeSnapshot({ id: 3, taskId: 1, snapshotDate: '2026-05-08', progressPct: 50, acDays: 5 }),
      makeSnapshot({ id: 4, taskId: 1, snapshotDate: '2026-05-11', progressPct: 80, acDays: 8 }),
    ]

    const result = buildSpiTrend({
      baseDate: '2026-05-13',
      project: baseProject,
      tasks: [baseTask],
      members: [baseMember],
      holidays: noHolidays,
      snapshots,
    })

    // 4 件返ることと昇順に並んでいることを確認
    expect(result).toHaveLength(4)
    expect(result.map((p) => p.d)).toEqual(['05-04', '05-08', '05-11', '05-13'])
    // MM-DD 形式
    for (const point of result) {
      expect(point.d).toMatch(/^\d{2}-\d{2}$/)
    }
  })

  it('windowDays 指定: baseDate から遡って N 日分のみを残す（要件 5.2）', () => {
    // baseDate=2026-05-13、windowDays=7 → 対象範囲: 2026-05-07 ～ 2026-05-13
    // 範囲外 (2026-05-04) のスナップショットは除外される
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-04', progressPct: 20, acDays: 2 }),
      makeSnapshot({ id: 2, taskId: 1, snapshotDate: '2026-05-08', progressPct: 50, acDays: 5 }),
      makeSnapshot({ id: 3, taskId: 1, snapshotDate: '2026-05-11', progressPct: 80, acDays: 8 }),
      makeSnapshot({ id: 4, taskId: 1, snapshotDate: '2026-05-13', progressPct: 100, acDays: 10 }),
    ]

    const result = buildSpiTrend({
      baseDate: '2026-05-13',
      trendWindowDays: 7,
      project: baseProject,
      tasks: [baseTask],
      members: [baseMember],
      holidays: noHolidays,
      snapshots,
    })

    // 05-04 は範囲外で除外、残り 3 件
    expect(result).toHaveLength(3)
    expect(result.map((p) => p.d)).toEqual(['05-08', '05-11', '05-13'])
  })

  it('plannedStart より前の日付では pv=0 となり spi=null の点を含める（要件 5.5）', () => {
    // baseTask.plannedStart = '2026-05-04'
    // スナップショット '2026-05-01' (plannedStart より前) → pv=0 → spi=null
    // スナップショット '2026-05-13' → pv > 0 → spi 算出可能
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-01', progressPct: 0, acDays: 0 }),
      makeSnapshot({ id: 2, taskId: 1, snapshotDate: '2026-05-13', progressPct: 100, acDays: 10 }),
    ]

    const result = buildSpiTrend({
      baseDate: '2026-05-13',
      project: baseProject,
      tasks: [baseTask],
      members: [baseMember],
      holidays: noHolidays,
      snapshots,
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.d).toBe('05-01')
    expect(result[0]?.spi).toBeNull()
    expect(result[1]?.d).toBe('05-13')
    expect(result[1]?.spi).not.toBeNull()
  })

  it('同日に複数タスクのスナップショットがあっても重複なくユニーク日付ごとに 1 ポイント生成する（要件 5.4）', () => {
    const taskA: Task = { ...baseTask, id: 1, estimateDays: 10 }
    const taskB: Task = { ...baseTask, id: 2, estimateDays: 5 }

    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-08', progressPct: 50, acDays: 5 }),
      makeSnapshot({ id: 2, taskId: 2, snapshotDate: '2026-05-08', progressPct: 60, acDays: 3 }),
      makeSnapshot({ id: 3, taskId: 1, snapshotDate: '2026-05-13', progressPct: 100, acDays: 10 }),
      makeSnapshot({ id: 4, taskId: 2, snapshotDate: '2026-05-13', progressPct: 100, acDays: 5 }),
    ]

    const result = buildSpiTrend({
      baseDate: '2026-05-13',
      project: baseProject,
      tasks: [taskA, taskB],
      members: [baseMember],
      holidays: noHolidays,
      snapshots,
    })

    expect(result).toHaveLength(2)
    expect(result.map((p) => p.d)).toEqual(['05-08', '05-13'])
  })
})
