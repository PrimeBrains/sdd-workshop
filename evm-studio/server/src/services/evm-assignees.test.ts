import { describe, expect, it } from 'vitest'
import { aggregateAssignees, aggregateAssigneesAt } from './evm-assignees.js'
import type { Holiday, Member, ProgressSnapshot, Task } from '../db/schema.js'

/**
 * aggregateAssignees の単体テスト。
 *
 * 仕様 (Requirements 3.1 - 3.10):
 * - メンバーごとに担当タスクをグループ化し、bac / ev / pv / ac を合計する。
 * - pv は `calculateTaskPv` を再利用し、メンバーの availabilityRate を適用する。
 * - pv > 0 かつ ac > 0 のとき spi = ev / pv、cpi = ev / ac、それ以外は null。
 * - status: spi < 0.8 → 'critical'、< 0.9 → 'warning'、>= 0.9 または null → 'normal'。
 * - 担当タスクなしのメンバーも {bac:0, ev:0, pv:0, ac:0, spi:null, cpi:null, status:'normal'} で 1 件返す。
 * - is_buffer=true のタスクは集計から除外する。
 */

// 共通テストフィクスチャ -----------------------------------------------------

const baseMember: Member = {
  id: 0,
  projectId: 1,
  externalId: null,
  name: '',
  role: null,
  initials: null,
  availabilityRate: 1.0,
  assignmentStart: null,
  assignmentEnd: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const baseTask: Task = {
  id: 0,
  projectId: 1,
  externalId: null,
  name: '',
  estimateDays: 0,
  plannedStart: '2026-05-11',
  plannedEnd: '2026-05-15',
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

describe('aggregateAssignees', () => {
  it('複数タスクを持つメンバー: bac/ev/pv/ac を合計し spi/cpi/status を算出する（要件 3.1-3.8）', () => {
    // baseDate: 2026-05-20 → 両タスクとも完了想定 (baseDate >= plannedEnd)
    // task1: estimateDays=10, progress=80% → ev=8、pv=10、ac=8 (per task)
    // task2: estimateDays=5,  progress=100% → ev=5、pv=5、ac=5 (per task)
    // 合計 bac=15, ev=13, pv=15, ac=13 → spi=13/15≈0.8667 ('warning'), cpi=1.0
    const member: Member = { ...baseMember, id: 10, name: '田中', availabilityRate: 1.0 }
    const task1: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 10,
      estimateDays: 10,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const task2: Task = {
      ...baseTask,
      id: 2,
      assigneeId: 10,
      estimateDays: 5,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 80, acDays: 8 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 100, acDays: 5 }),
    ]

    const result = aggregateAssignees({
      baseDate: '2026-05-20',
      members: [member],
      tasks: [task1, task2],
      snapshots,
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    const entry = result[0]!
    expect(entry.id).toBe(10)
    expect(entry.name).toBe('田中')
    expect(entry.bac).toBe(15)
    expect(entry.ev).toBe(13)
    expect(entry.pv).toBe(15)
    expect(entry.ac).toBe(13)
    expect(entry.spi).toBeCloseTo(13 / 15, 5)
    expect(entry.cpi).toBeCloseTo(1.0, 5)
    expect(entry.status).toBe('warning')
  })

  it('タスク未割当メンバー: 全て 0 で status="normal" を返す（要件 3.9）', () => {
    const member: Member = { ...baseMember, id: 20, name: '無タスク' }
    const result = aggregateAssignees({
      baseDate: '2026-05-13',
      members: [member],
      tasks: [],
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 20,
      name: '無タスク',
      bac: 0,
      ev: 0,
      pv: 0,
      ac: 0,
      spi: null,
      cpi: null,
      status: 'normal',
    })
  })

  it('availabilityRate=0.5 のとき PV 計算に反映される（要件 3.3）', () => {
    // task: plannedStart=2026-05-11, baseDate=2026-05-13 (中間日)
    // 稼働日数 N=3、estimateDays=10
    // availabilityRate=1.0 → min(3*1.0, 10) = 3
    // availabilityRate=0.5 → min(3*0.5, 10) = 1.5
    const member: Member = { ...baseMember, id: 30, name: '半稼働', availabilityRate: 0.5 }
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 30,
      estimateDays: 10,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-20',
    }

    const result = aggregateAssignees({
      baseDate: '2026-05-13',
      members: [member],
      tasks: [task],
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.pv).toBeCloseTo(1.5, 5)
    // ac=0 → cpi=null、pv=1.5/ac=0 → spi=null
    expect(result[0]!.spi).toBeNull()
    expect(result[0]!.cpi).toBeNull()
    expect(result[0]!.status).toBe('normal')
  })

  it('spi=null のとき status は "normal" を返す（要件 3.9）', () => {
    // pv=0 となるケース: baseDate < plannedStart (タスクは未開始)
    const member: Member = { ...baseMember, id: 40, name: '未開始タスク' }
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 40,
      estimateDays: 5,
      plannedStart: '2026-06-01',
      plannedEnd: '2026-06-10',
    }

    const result = aggregateAssignees({
      baseDate: '2026-05-13',
      members: [member],
      tasks: [task],
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.pv).toBe(0)
    expect(result[0]!.ev).toBe(0)
    expect(result[0]!.ac).toBe(0)
    expect(result[0]!.spi).toBeNull()
    expect(result[0]!.cpi).toBeNull()
    expect(result[0]!.status).toBe('normal')
  })

  it('spi < 0.8 のとき status="critical" を返す', () => {
    // ev/pv = 0.5/10 = 0.05 → critical
    const member: Member = { ...baseMember, id: 50, name: '遅延', availabilityRate: 1.0 }
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 50,
      estimateDays: 10,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 5, acDays: 1 }),
    ]

    const result = aggregateAssignees({
      baseDate: '2026-05-20',
      members: [member],
      tasks: [task],
      snapshots,
      holidays: noHolidays,
    })

    expect(result[0]!.spi).toBeLessThan(0.8)
    expect(result[0]!.status).toBe('critical')
  })

  it('isBuffer=true のタスクは bac/ev/pv/ac の集計から除外される', () => {
    // 担当者のバッファタスクは集計から除外されるべき
    const member: Member = { ...baseMember, id: 60, name: 'バッファ担当' }
    const normalTask: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 60,
      estimateDays: 4,
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const bufferTask: Task = {
      ...baseTask,
      id: 2,
      assigneeId: 60,
      estimateDays: 10,
      isBuffer: true,
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 4 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 100, acDays: 9 }),
    ]

    const result = aggregateAssignees({
      baseDate: '2026-05-20',
      members: [member],
      tasks: [normalTask, bufferTask],
      snapshots,
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    // バッファ除外 → bac=4, ev=4, pv=4, ac=4
    expect(result[0]!.bac).toBe(4)
    expect(result[0]!.ev).toBe(4)
    expect(result[0]!.pv).toBe(4)
    expect(result[0]!.ac).toBe(4)
    expect(result[0]!.spi).toBe(1)
    expect(result[0]!.cpi).toBe(1)
    expect(result[0]!.status).toBe('normal')
  })

  it('aggregateAssigneesAt: prevDate 時点の snapshot から baseDate 時点と異なる ev/spi/cpi を返す（要件 2.4）', () => {
    // task1 (estimateDays=10) はメンバー田中担当
    //   - 2026-05-12 (prevDate) の snapshot: progress=30%, acDays=5 → ev=3, ac=5  → cpi=0.6
    //   - 2026-05-13 (baseDate) の snapshot: progress=80%, acDays=8 → ev=8, ac=8  → cpi=1.0
    // baseDate / prevDate 双方で task はすでに完了領域 (plannedEnd<=prevDate) → pv は同一 (10)
    const member: Member = { ...baseMember, id: 70, name: '田中', availabilityRate: 1.0 }
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 70,
      estimateDays: 10,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-12',
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, snapshotDate: '2026-05-12', progressPct: 30, acDays: 5 }),
      makeSnapshot({ id: 2, taskId: 1, snapshotDate: '2026-05-13', progressPct: 80, acDays: 8 }),
    ]

    // baseDate 集計 (status 付き) -- 全 snapshots を渡す想定
    const baseResult = aggregateAssignees({
      baseDate: '2026-05-13',
      members: [member],
      tasks: [task],
      snapshots,
      holidays: noHolidays,
    })

    // prevDate 集計 (status / name / bac 無し) -- prevDate 以前の snapshots に絞って渡す
    const prevSnapshots = snapshots.filter((s) => s.snapshotDate <= '2026-05-12')
    const prevResult = aggregateAssigneesAt({
      baseDate: '2026-05-12',
      members: [member],
      tasks: [task],
      snapshots: prevSnapshots,
      holidays: noHolidays,
    })

    expect(prevResult).toHaveLength(1)
    const prev = prevResult[0]!

    // フィールド集合: id / ev / pv / ac / spi / cpi のみ。name / bac / status は含めない。
    expect(Object.keys(prev).sort()).toEqual(['ac', 'cpi', 'ev', 'id', 'pv', 'spi'].sort())
    expect(prev.id).toBe(70)

    // prevDate snapshot 由来: ev=3, ac=5
    expect(prev.ev).toBe(3)
    expect(prev.ac).toBe(5)
    // pv は baseDate と同様 estimateDays=10 (タスク完了済み)
    expect(prev.pv).toBe(10)
    // spi=3/10=0.3, cpi=3/5=0.6
    expect(prev.spi).toBeCloseTo(0.3, 5)
    expect(prev.cpi).toBeCloseTo(0.6, 5)

    // baseDate 結果と比較して数値が差分を持つことを確認
    const base = baseResult[0]!
    expect(base.ev).toBe(8)
    expect(base.spi).toBeCloseTo(0.8, 5)
    expect(base.cpi).toBeCloseTo(1.0, 5)
    expect(prev.ev).not.toBe(base.ev)
    expect(prev.spi).not.toBe(base.spi)
    expect(prev.cpi).not.toBe(base.cpi)
  })

  it('aggregateAssigneesAt: 担当タスクなしのメンバーも 1 件返す（全 0、spi/cpi=null）', () => {
    const member: Member = { ...baseMember, id: 80, name: '無タスク' }
    const result = aggregateAssigneesAt({
      baseDate: '2026-05-12',
      members: [member],
      tasks: [],
      snapshots: [],
      holidays: noHolidays,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 80,
      ev: 0,
      pv: 0,
      ac: 0,
      spi: null,
      cpi: null,
    })
  })

  it('複数メンバー: 各メンバーの担当タスクのみが集計される', () => {
    const memberA: Member = { ...baseMember, id: 100, name: 'A' }
    const memberB: Member = { ...baseMember, id: 200, name: 'B' }
    const taskA: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 100,
      estimateDays: 4,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const taskB: Task = {
      ...baseTask,
      id: 2,
      assigneeId: 200,
      estimateDays: 2,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 100, acDays: 4 }),
      makeSnapshot({ id: 2, taskId: 2, progressPct: 100, acDays: 2 }),
    ]

    const result = aggregateAssignees({
      baseDate: '2026-05-20',
      members: [memberA, memberB],
      tasks: [taskA, taskB],
      snapshots,
      holidays: noHolidays,
    })

    expect(result).toHaveLength(2)
    const a = result.find((r) => r.id === 100)!
    const b = result.find((r) => r.id === 200)!
    expect(a.bac).toBe(4)
    expect(b.bac).toBe(2)
  })
})
