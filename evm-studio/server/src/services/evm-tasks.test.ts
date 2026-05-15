import { describe, expect, it } from 'vitest'
import { rollupTasks, type TaskEvm } from './evm-tasks.js'
import type { Holiday, Member, ProgressSnapshot, Project, Task } from '../db/schema.js'

/**
 * rollupTasks の単体テスト（Requirements 7.1-7.7）。
 *
 * カバレッジ:
 *   1. 葉タスクの SPI 計算（pv > 0 で ev/pv、pv = 0 で null）
 *   2. 親タスクの BAC 加重平均（progress）と ev/pv 合計（spi）
 *   3. WBS code 階層辞書順ソート（1 < 1.1 < 1.2 < 2）
 *   4. assignee 解決（id → Member.name）
 *   5. buffer フラグと EV ロールアップ対象外の挙動
 */

// ─── 共通フィクスチャ ───────────────────────────────────────────────────

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

const baseProject: Pick<Project, 'startDate'> = { startDate: '2026-05-11' }

function makeSnapshot(overrides: Partial<ProgressSnapshot>): ProgressSnapshot {
  return {
    id: 1,
    taskId: 1,
    snapshotDate: '2026-05-13',
    progressPct: 0,
    pvDays: 0,
    evDays: 0,
    acDays: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

const noHolidays: Holiday[] = []

// ─── テスト ─────────────────────────────────────────────────────────────

describe('rollupTasks', () => {
  it('葉タスク: 最新スナップショットの progress と pv>0 のとき spi = ev/pv を返す（要件 7.4）', () => {
    // task1: estimateDays=10, plannedStart=2026-05-11, plannedEnd=2026-05-15
    // baseDate=2026-05-20 → baseDate >= plannedEnd なので pv = 10
    // progressPct=80 → ev = 8 → spi = 8/10 = 0.8
    const task1: Task = {
      ...baseTask,
      id: 1,
      name: 'タスクA',
      estimateDays: 10,
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 1, progressPct: 80, acDays: 6 }),
    ]

    const result = rollupTasks({
      project: baseProject,
      tasks: [task1],
      members: [],
      snapshots,
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    expect(result).toHaveLength(1)
    const r = result[0]!
    expect(r.id).toBe(1)
    expect(r.leaf).toBe(true)
    expect(r.progress).toBe(80)
    expect(r.spi).toBeCloseTo(0.8, 5)
    expect(r.bac).toBe(10)
  })

  it('親タスク: 子葉タスクの BAC 加重平均で progress、ev 合計 / pv 合計で spi を算出する（要件 7.5）', () => {
    // parent (id=10): 子葉 task11(id=11, est=10, progress=100), task12(id=12, est=5, progress=80)
    // baseDate=2026-05-20 → 両葉ともに pv = estimateDays
    // child11: ev=10, pv=10, child12: ev=4, pv=5
    // 親 progress = (10*100 + 5*80) / (10+5) = 1400/15 ≈ 93.333
    // 親 spi = (10+4) / (10+5) = 14/15 ≈ 0.9333
    const parent: Task = {
      ...baseTask,
      id: 10,
      name: '親',
      isLeaf: false,
      level: 1,
      sortOrder: 0,
    }
    const child11: Task = {
      ...baseTask,
      id: 11,
      name: '子1',
      parentId: 10,
      estimateDays: 10,
      level: 2,
      sortOrder: 0,
      isLeaf: true,
    }
    const child12: Task = {
      ...baseTask,
      id: 12,
      name: '子2',
      parentId: 10,
      estimateDays: 5,
      level: 2,
      sortOrder: 1,
      isLeaf: true,
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 11, progressPct: 100, acDays: 10 }),
      makeSnapshot({ id: 2, taskId: 12, progressPct: 80, acDays: 4 }),
    ]

    const result = rollupTasks({
      project: baseProject,
      tasks: [parent, child11, child12],
      members: [],
      snapshots,
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    const parentEvm = result.find((r) => r.id === 10) as TaskEvm
    expect(parentEvm).toBeDefined()
    expect(parentEvm.leaf).toBe(false)
    expect(parentEvm.progress).toBeCloseTo(1400 / 15, 5)
    expect(parentEvm.spi).toBeCloseTo(14 / 15, 5)
  })

  it('WBS code 階層辞書順で安定ソート: 1 < 1.1 < 1.2 < 2（要件 7.7）', () => {
    // ルート2件 + それぞれの子をルート2件が先・子が後と混在順で渡しても
    // code 順に並べ替えられる。
    const root1: Task = {
      ...baseTask,
      id: 1,
      name: '要件',
      isLeaf: false,
      level: 1,
      sortOrder: 0,
    }
    const root2: Task = {
      ...baseTask,
      id: 2,
      name: '設計',
      isLeaf: false,
      level: 1,
      sortOrder: 1,
    }
    const child11: Task = {
      ...baseTask,
      id: 11,
      name: '要件1',
      parentId: 1,
      level: 2,
      sortOrder: 0,
      isLeaf: true,
      estimateDays: 3,
    }
    const child12: Task = {
      ...baseTask,
      id: 12,
      name: '要件2',
      parentId: 1,
      level: 2,
      sortOrder: 1,
      isLeaf: true,
      estimateDays: 2,
    }

    // 意図的に逆順で渡す
    const result = rollupTasks({
      project: baseProject,
      tasks: [child12, root2, child11, root1],
      members: [],
      snapshots: [],
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    expect(result.map((r) => r.code)).toEqual(['1', '1.1', '1.2', '2'])
  })

  it('assignee: Task.assigneeId を Member.name に解決する（要件 7.6）', () => {
    const member: Member = { ...baseMember, id: 100, name: '田中 美咲' }
    const task1: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 100,
      estimateDays: 5,
    }
    const task2: Task = {
      ...baseTask,
      id: 2,
      assigneeId: null, // 未割当
      estimateDays: 5,
      sortOrder: 1,
    }

    const result = rollupTasks({
      project: baseProject,
      tasks: [task1, task2],
      members: [member],
      snapshots: [],
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    const r1 = result.find((r) => r.id === 1) as TaskEvm
    const r2 = result.find((r) => r.id === 2) as TaskEvm
    expect(r1.assignee).toBe('田中 美咲')
    expect(r2.assignee).toBe(null)
  })

  it('buffer フラグ: バッファタスクは buffer=true で保持され、親ロールアップ対象外（要件 7.3）', () => {
    // 親(id=10) 配下に 葉(non-buffer, id=11) + バッファ(id=12) を置き、
    // バッファが progress 加重平均に含まれないことを確認。
    const parent: Task = {
      ...baseTask,
      id: 10,
      name: '工程',
      isLeaf: false,
    }
    const leaf: Task = {
      ...baseTask,
      id: 11,
      name: '実装',
      parentId: 10,
      estimateDays: 10,
      isLeaf: true,
      sortOrder: 0,
    }
    const buffer: Task = {
      ...baseTask,
      id: 12,
      name: 'プロジェクトバッファ',
      parentId: 10,
      estimateDays: 5,
      isLeaf: true,
      isBuffer: true,
      sortOrder: 1,
    }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ id: 1, taskId: 11, progressPct: 60, acDays: 5 }),
    ]

    const result = rollupTasks({
      project: baseProject,
      tasks: [parent, leaf, buffer],
      members: [],
      snapshots,
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    const bufferEvm = result.find((r) => r.id === 12) as TaskEvm
    expect(bufferEvm).toBeDefined()
    expect(bufferEvm.buffer).toBe(true)
    expect(bufferEvm.progress).toBe(0)
    expect(bufferEvm.spi).toBe(null)
    // assignee はバッファのため null
    expect(bufferEvm.assignee).toBe(null)

    // 親の progress は葉(60%) のみで構成され、バッファの 5d 分は含まれない
    const parentEvm = result.find((r) => r.id === 10) as TaskEvm
    expect(parentEvm.progress).toBeCloseTo(60, 5)
  })

  it('start / end: Project.startDate からの相対日数（整数）を返す（要件 7.2）', () => {
    // project.startDate = 2026-05-11
    // task.plannedStart = 2026-05-13 (offset 2), plannedEnd = 2026-05-20 (offset 9)
    const task1: Task = {
      ...baseTask,
      id: 1,
      plannedStart: '2026-05-13',
      plannedEnd: '2026-05-20',
      estimateDays: 5,
    }
    const result = rollupTasks({
      project: { startDate: '2026-05-11' },
      tasks: [task1],
      members: [],
      snapshots: [],
      holidays: noHolidays,
      baseDate: '2026-05-25',
    })

    const r = result[0]!
    expect(r.start).toBe(2)
    expect(r.end).toBe(9)
    expect(Number.isInteger(r.start)).toBe(true)
    expect(Number.isInteger(r.end)).toBe(true)
  })

  it('葉タスク: pv = 0 のとき spi は null（要件 7.4）', () => {
    // baseDate < plannedStart → pv = 0 → spi = null
    const task1: Task = {
      ...baseTask,
      id: 1,
      estimateDays: 5,
      plannedStart: '2026-06-01',
      plannedEnd: '2026-06-10',
    }
    const result = rollupTasks({
      project: baseProject,
      tasks: [task1],
      members: [],
      snapshots: [],
      holidays: noHolidays,
      baseDate: '2026-05-20',
    })

    expect(result[0]!.spi).toBe(null)
  })
})
