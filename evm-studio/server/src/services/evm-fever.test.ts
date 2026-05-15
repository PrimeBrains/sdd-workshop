import { describe, expect, it } from 'vitest'
import { calculateFever } from './evm-fever.js'
import type { Holiday, ProgressSnapshot, Task, TaskDependency } from '../db/schema.js'

/**
 * calculateFever の単体テスト（Requirements 6.1-6.6, 11.3）。
 *
 * 検証ポイント:
 * - バッファ非存在で `null` を返す（要件 6.5）。
 * - GREEN / YELLOW / RED ゾーンの境界（要件 6.3）。
 * - `bufferTotalDays === 0` のゼロ除算防御（要件 6.6）。
 * - trail が `trendWindowDays` 範囲内のスナップショット日付ごとに時系列順で構築される（要件 6.4）。
 * - クリティカルチェーン BAC === 0 のゼロ除算防御（要件 6.6）。
 */

// ─── 共通フィクスチャ ───────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    projectId: 1,
    externalId: null,
    name: 'タスク',
    estimateDays: 0,
    plannedStart: '2026-05-01',
    plannedEnd: '2026-05-10',
    actualStart: null,
    actualEnd: null,
    parentId: null,
    assigneeId: null,
    level: 1,
    sortOrder: 0,
    isBuffer: false,
    isLeaf: true,
    remarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<ProgressSnapshot>): ProgressSnapshot {
  return {
    id: 1,
    taskId: 1,
    snapshotDate: '2026-05-10',
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

// ─── テスト ─────────────────────────────────────────────────────────────────

describe('calculateFever', () => {
  it('バッファタスク非存在のとき null を返す（要件 6.5）', () => {
    // バッファタスクを持たない 2 つの非バッファタスクのみ
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'A', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({
        id: 2,
        name: 'B',
        estimateDays: 5,
        plannedStart: '2026-05-06',
        plannedEnd: '2026-05-10',
      }),
    ]
    const dependencies: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 },
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies,
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).toBeNull()
  })

  it('GREEN ゾーンを判定する（consumption=0.2, completion=0.5 → 0.2 < 0.5*0.67=0.335 → GREEN）', () => {
    // クリティカルチェーン: T1 → T2、各 5 日 → BAC=10
    // バッファ: B1 = 10 日（バッファ総日数=10）
    // T1: progressPct=100 → EV=5, acDays=7 → 遅延 = 7-5 = 2
    // T2: progressPct=0  → EV=0, acDays=0 → 遅延 0
    // 完了 EV = 5 / 10 = 0.5、累積遅延 = 2 / 10 = 0.2
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'T1', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({
        id: 2,
        name: 'T2',
        estimateDays: 5,
        plannedStart: '2026-05-06',
        plannedEnd: '2026-05-10',
      }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 10, isBuffer: true }),
    ]
    const dependencies: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 },
    ]
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 7 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 0, acDays: 0 }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies,
      snapshots,
      holidays: noHolidays,
    })

    expect(result).not.toBeNull()
    expect(result!.bufferConsumption).toBeCloseTo(0.2)
    expect(result!.criticalChainCompletion).toBeCloseTo(0.5)
    expect(result!.zone).toBe('GREEN')
  })

  it('YELLOW ゾーンを判定する（consumption=0.4, completion=0.5 → 0.335 <= 0.4 < 0.5 → YELLOW）', () => {
    // 同じ構成で acDays=9 にして遅延 4 → consumption=0.4
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'T1', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({
        id: 2,
        name: 'T2',
        estimateDays: 5,
        plannedStart: '2026-05-06',
        plannedEnd: '2026-05-10',
      }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 10, isBuffer: true }),
    ]
    const dependencies: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 },
    ]
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 9 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 0, acDays: 0 }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies,
      snapshots,
      holidays: noHolidays,
    })

    expect(result).not.toBeNull()
    expect(result!.bufferConsumption).toBeCloseTo(0.4)
    expect(result!.criticalChainCompletion).toBeCloseTo(0.5)
    expect(result!.zone).toBe('YELLOW')
  })

  it('RED ゾーンを判定する（consumption=0.6, completion=0.5 → 0.6 >= 0.5 → RED）', () => {
    // acDays=11 にして遅延 6 → consumption=0.6
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'T1', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({
        id: 2,
        name: 'T2',
        estimateDays: 5,
        plannedStart: '2026-05-06',
        plannedEnd: '2026-05-10',
      }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 10, isBuffer: true }),
    ]
    const dependencies: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 },
    ]
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 11 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 0, acDays: 0 }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies,
      snapshots,
      holidays: noHolidays,
    })

    expect(result).not.toBeNull()
    expect(result!.bufferConsumption).toBeCloseTo(0.6)
    expect(result!.criticalChainCompletion).toBeCloseTo(0.5)
    expect(result!.zone).toBe('RED')
  })

  it('bufferTotalDays=0 のとき bufferConsumption=0 として扱う（要件 6.6）', () => {
    // バッファタスクは存在するが estimateDays=0 → バッファ総日数=0
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'T1', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 0, isBuffer: true }),
    ]
    const dependencies: TaskDependency[] = []
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 10 }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies,
      snapshots,
      holidays: noHolidays,
    })

    expect(result).not.toBeNull()
    // ゼロ除算回避: bufferConsumption は 0
    expect(result!.bufferConsumption).toBe(0)
    // 完了率は EV=5 / BAC=5 = 1.0
    expect(result!.criticalChainCompletion).toBeCloseTo(1.0)
    // consumption=0 < completion*0.67=0.67 → GREEN
    expect(result!.zone).toBe('GREEN')
  })

  it('trail を trendWindowDays 範囲内のスナップショット日付ごとに時系列順で生成する（要件 6.4）', () => {
    // baseDate=2026-05-20、trendWindowDays=10 → 範囲 2026-05-11 〜 2026-05-20
    // 範囲内: 2026-05-13, 2026-05-18, 2026-05-20 の 3 日付
    // 範囲外: 2026-05-05（除外される）
    const tasks: Task[] = [
      makeTask({
        id: 1,
        name: 'T1',
        estimateDays: 10,
        plannedStart: '2026-05-01',
        plannedEnd: '2026-05-20',
      }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 10, isBuffer: true }),
    ]
    const dependencies: TaskDependency[] = []
    const snapshots: ProgressSnapshot[] = [
      // 範囲外（trendWindowDays=10 → 開始日 2026-05-11 より前）
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-05', progressPct: 20, acDays: 2 }),
      // 範囲内
      makeSnapshot({ id: 2, taskId: 1, snapshotDate: '2026-05-13', progressPct: 50, acDays: 6 }),
      makeSnapshot({ id: 3, taskId: 1, snapshotDate: '2026-05-18', progressPct: 70, acDays: 9 }),
      makeSnapshot({ id: 4, taskId: 1, snapshotDate: '2026-05-20', progressPct: 80, acDays: 10 }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-20',
      tasks,
      dependencies,
      snapshots,
      holidays: noHolidays,
      trendWindowDays: 10,
    })

    expect(result).not.toBeNull()
    // trail は 3 点（範囲内のスナップショット日付の数）
    expect(result!.trail).toHaveLength(3)

    // 時系列順に検証
    // 2026-05-13: progress=50 → EV=5, AC=6 → 遅延=1, consumption=0.1, completion=0.5
    expect(result!.trail[0]!.x).toBeCloseTo(0.5)
    expect(result!.trail[0]!.y).toBeCloseTo(0.1)
    // 2026-05-18: progress=70 → EV=7, AC=9 → 遅延=2, consumption=0.2, completion=0.7
    expect(result!.trail[1]!.x).toBeCloseTo(0.7)
    expect(result!.trail[1]!.y).toBeCloseTo(0.2)
    // 2026-05-20: progress=80 → EV=8, AC=10 → 遅延=2, consumption=0.2, completion=0.8
    expect(result!.trail[2]!.x).toBeCloseTo(0.8)
    expect(result!.trail[2]!.y).toBeCloseTo(0.2)

    // baseDate の値は trail の最終点と一致
    expect(result!.bufferConsumption).toBeCloseTo(0.2)
    expect(result!.criticalChainCompletion).toBeCloseTo(0.8)
  })

  it('スナップショット 0 件のとき trail は空配列、ratio は 0', () => {
    const tasks: Task[] = [
      makeTask({ id: 1, name: 'T1', estimateDays: 5, plannedEnd: '2026-05-05' }),
      makeTask({ id: 99, name: 'Buffer', estimateDays: 10, isBuffer: true }),
    ]

    const result = calculateFever({
      baseDate: '2026-05-10',
      tasks,
      dependencies: [],
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).not.toBeNull()
    expect(result!.bufferConsumption).toBe(0)
    expect(result!.criticalChainCompletion).toBe(0)
    expect(result!.trail).toEqual([])
    // consumption=0 < completion*0.67=0 → false（厳密 < ）。完了 0 ⇒ YELLOW or RED?
    // 0 < 0*0.67=0 → false なので GREEN ではない。0 < 0*1.0=0 → false なので YELLOW ではない。→ RED
    expect(result!.zone).toBe('RED')
  })
})
