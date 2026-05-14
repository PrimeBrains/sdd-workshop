import { describe, expect, it } from 'vitest'
import {
  countWorkingDays,
  calculateTaskPv,
  calculateProjectPv,
  calculateTaskEv,
  calculateProjectEv,
  calculateProjectAc,
  evaluateAlertLevel,
} from './evm-engine.js'
import type { Holiday, Member, ProgressSnapshot, Task } from '../db/schema.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

// ─── countWorkingDays ────────────────────────────────────────────────────────

describe('countWorkingDays', () => {
  it('祝日なし: 月〜金の5日間で5を返す', () => {
    // 2026-05-11(月) 〜 2026-05-15(金): 祝日なし → 5稼働日
    const result = countWorkingDays('2026-05-11', '2026-05-15', [])
    expect(result).toBe(5)
  })

  it('祝日あり: 祝日を除外した稼働日数を返す', () => {
    // 2026-05-11(月) 〜 2026-05-15(金): 2026-05-13(水)が祝日 → 4稼働日
    const holidays: Holiday[] = [{ id: 1, projectId: 1, date: '2026-05-13' }]
    const result = countWorkingDays('2026-05-11', '2026-05-15', holidays)
    expect(result).toBe(4)
  })

  it('土日を除外する', () => {
    // 2026-05-15(金) 〜 2026-05-18(月): 金・土・日・月 のうち土日除外 → 2稼働日
    const result = countWorkingDays('2026-05-15', '2026-05-18', [])
    expect(result).toBe(2)
  })

  it('開始日 = 終了日（平日）の場合に1を返す', () => {
    const result = countWorkingDays('2026-05-11', '2026-05-11', [])
    expect(result).toBe(1)
  })

  it('開始日 = 終了日（土曜）の場合に0を返す', () => {
    // 2026-05-16 は土曜
    const result = countWorkingDays('2026-05-16', '2026-05-16', [])
    expect(result).toBe(0)
  })

  // --- 具体的なテストケース ---

  it('平日のみ: 2026-05-11(月) から 2026-05-15(金) まで5稼働日を返す', () => {
    const result = countWorkingDays('2026-05-11', '2026-05-15', [])
    expect(result).toBe(5)
  })

  it('土日を除外: 2026-05-11(月) から 2026-05-18(月) まで6稼働日を返す', () => {
    // 月〜金(5) + 月(1) = 6。土日は除外
    const result = countWorkingDays('2026-05-11', '2026-05-18', [])
    expect(result).toBe(6)
  })

  it('祝日を除外: 2026-05-11(月) が祝日のとき 2026-05-11〜2026-05-15 は4稼働日', () => {
    const holidays: Holiday[] = [
      { id: 1, projectId: 1, date: '2026-05-11' },
    ]
    const result = countWorkingDays('2026-05-11', '2026-05-15', holidays)
    expect(result).toBe(4)
  })

  it('開始日 = 終了日（平日）のとき1を返す', () => {
    const result = countWorkingDays('2026-05-11', '2026-05-11', [])
    expect(result).toBe(1)
  })

  it('開始日 = 終了日（土曜）のとき0を返す', () => {
    // 2026-05-16 は土曜
    const result = countWorkingDays('2026-05-16', '2026-05-16', [])
    expect(result).toBe(0)
  })

  it('plannedStart > baseDate のとき 0 を返す', () => {
    const result = countWorkingDays('2026-05-20', '2026-05-15', [])
    expect(result).toBe(0)
  })

  it('土曜・日曜のみの範囲のとき 0 を返す', () => {
    // 2026-05-16(土) 〜 2026-05-17(日)
    const result = countWorkingDays('2026-05-16', '2026-05-17', [])
    expect(result).toBe(0)
  })

  it('複数祝日を除外できる', () => {
    // 2026-05-11(月) 〜 2026-05-15(金) の5日間で月・水を祝日にすると3稼働日
    const holidays: Holiday[] = [
      { id: 1, projectId: 1, date: '2026-05-11' },
      { id: 2, projectId: 1, date: '2026-05-13' },
    ]
    const result = countWorkingDays('2026-05-11', '2026-05-15', holidays)
    expect(result).toBe(3)
  })
})

// ─── calculateTaskPv / calculateProjectPv ───────────────────────────────────

// 共通のタスクベース（Task 型に合わせて全フィールドを揃える）
const baseTask: Task = {
  id: 1,
  projectId: 1,
  externalId: 'T001',
  name: 'テストタスク',
  estimateDays: 5,
  plannedStart: '2026-05-11',
  plannedEnd: '2026-05-20',
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

describe('calculateTaskPv', () => {
  // ─── バッファ除外 ───────────────────────────────────────────────────────────
  it('is_buffer=true のタスクは 0 を返す', () => {
    const task: Task = { ...baseTask, isBuffer: true }
    const result = calculateTaskPv(task, '2026-05-13', 1.0, [])
    expect(result).toBe(0)
  })

  // ─── 基準日 < 開始日 ────────────────────────────────────────────────────────
  it('基準日 < 開始日 → 0 を返す', () => {
    // plannedStart='2026-05-11', baseDate='2026-05-10'
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-20' }
    const result = calculateTaskPv(task, '2026-05-10', 1.0, [])
    expect(result).toBe(0)
  })

  // ─── 基準日 >= 終了日 ───────────────────────────────────────────────────────
  it('基準日 >= 終了日 → estimate_days を返す', () => {
    // plannedEnd='2026-05-15', baseDate='2026-05-20'
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-15', estimateDays: 5 }
    const result = calculateTaskPv(task, '2026-05-20', 1.0, [])
    expect(result).toBe(5)
  })

  it('基準日 = 終了日 → estimate_days を返す', () => {
    // plannedEnd='2026-05-15', baseDate='2026-05-15'
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-15', estimateDays: 5 }
    const result = calculateTaskPv(task, '2026-05-15', 1.0, [])
    expect(result).toBe(5)
  })

  // ─── 中間日: availability_rate=1.0 ──────────────────────────────────────────
  it('中間日・availability_rate=1.0: countWorkingDays(plannedStart, baseDate) と一致する（上限5）', () => {
    // 2026-05-11(月) 〜 2026-05-13(水): 平日3日 → min(3*1.0, 5) = 3
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-20', estimateDays: 5 }
    const result = calculateTaskPv(task, '2026-05-13', 1.0, [])
    expect(result).toBe(3)
  })

  // ─── availability_rate=0.6 でキャップ動作 ──────────────────────────────────
  it('availability_rate=0.6: N * 0.6 が estimateDays 未満の場合は N*0.6 を返す', () => {
    // 2026-05-11(月) 〜 2026-05-13(水): 3稼働日 → 3*0.6=1.8 < 5 → 1.8
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-20', estimateDays: 5 }
    const result = calculateTaskPv(task, '2026-05-13', 0.6, [])
    expect(result).toBeCloseTo(1.8)
  })

  it('availability_rate=0.6 でキャップ: N*rate が estimateDays を超える場合は estimateDays を返す', () => {
    // 2026-05-11(月) 〜 2026-05-19(火): 7稼働日 → 7*0.6=4.2 < 5 → 4.2
    // より厳しいケース: estimateDays=3, N=5, rate=0.8 → 4.0 > 3 → cap=3
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-20', estimateDays: 3 }
    // 5稼働日 * 0.8 = 4.0 > estimateDays(3) → cap → 3
    const result = calculateTaskPv(task, '2026-05-15', 0.8, [])
    expect(result).toBe(3)
  })

  // ─── 祝日ありの確認 ──────────────────────────────────────────────────────────
  it('祝日あり: 祝日の分だけ PV が減少する', () => {
    // 2026-05-11(月) 〜 2026-05-13(水): 平日3日、2026-05-12 祝日 → 2日 → min(2*1.0, 5)=2
    const holidays: Holiday[] = [{ id: 1, projectId: 1, date: '2026-05-12' }]
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: '2026-05-20', estimateDays: 5 }
    const result = calculateTaskPv(task, '2026-05-13', 1.0, holidays)
    expect(result).toBe(2)
  })

  // ─── バリデーションエラー ────────────────────────────────────────────────────
  it('不正な baseDate 形式 → AppError(EVM_INVALID_BASE_DATE) をスローする', () => {
    const task: Task = { ...baseTask }
    expect(() => calculateTaskPv(task, '20260513', 1.0, [])).toThrow(AppError)
    expect(() => calculateTaskPv(task, '20260513', 1.0, [])).toThrow(
      expect.objectContaining({ code: ErrorCode.EVM_INVALID_BASE_DATE }),
    )
  })

  it('availabilityRate=1.5 → AppError(EVM_INVALID_AVAILABILITY_RATE) をスローする', () => {
    const task: Task = { ...baseTask }
    expect(() => calculateTaskPv(task, '2026-05-13', 1.5, [])).toThrow(AppError)
    expect(() => calculateTaskPv(task, '2026-05-13', 1.5, [])).toThrow(
      expect.objectContaining({ code: ErrorCode.EVM_INVALID_AVAILABILITY_RATE }),
    )
  })

  it('availabilityRate=-0.1 → AppError(EVM_INVALID_AVAILABILITY_RATE) をスローする', () => {
    const task: Task = { ...baseTask }
    expect(() => calculateTaskPv(task, '2026-05-13', -0.1, [])).toThrow(AppError)
    expect(() => calculateTaskPv(task, '2026-05-13', -0.1, [])).toThrow(
      expect.objectContaining({ code: ErrorCode.EVM_INVALID_AVAILABILITY_RATE }),
    )
  })

  // ─── plannedStart/plannedEnd が null のケース ───────────────────────────────
  it('plannedStart=null → 0 を返す', () => {
    const task: Task = { ...baseTask, plannedStart: null }
    const result = calculateTaskPv(task, '2026-05-13', 1.0, [])
    expect(result).toBe(0)
  })

  it('plannedEnd=null の場合、中間日として計算する（cap なし）', () => {
    // plannedEnd が null → 終了条件に引っかからないので通常計算
    // plannedStart='2026-05-11', baseDate='2026-05-13' → 3稼働日 → 3
    const task: Task = { ...baseTask, plannedStart: '2026-05-11', plannedEnd: null }
    const result = calculateTaskPv(task, '2026-05-13', 1.0, [])
    expect(result).toBe(3)
  })
})

// 共通 Member ベース
const baseMember: Member = {
  id: 10,
  projectId: 1,
  externalId: 'M001',
  name: 'テストメンバー',
  availabilityRate: 1.0,
  assignmentStart: null,
  assignmentEnd: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('calculateProjectPv', () => {
  it('is_buffer=true タスクを PV 累積から除外する（要件 1.5）', () => {
    // is_buffer=true タスクは PV に含まれない
    const normalTask: Task = { ...baseTask, id: 1, isBuffer: false, plannedStart: '2026-05-11', plannedEnd: '2026-05-15', estimateDays: 4, assigneeId: null }
    const bufferTask: Task = { ...baseTask, id: 2, isBuffer: true, estimateDays: 10 }
    const result = calculateProjectPv({
      tasks: [normalTask, bufferTask],
      members: [],
      holidays: [],
      snapshots: [],
      baseDate: '2026-05-20',
    })
    // bufferTask は除外 → PV = normalTask の estimateDays = 4
    expect(result).toBe(4)
  })

  it('複数タスクの PV を合計する（要件 1.6）', () => {
    const task1: Task = { ...baseTask, id: 1, isBuffer: false, plannedStart: '2026-05-11', plannedEnd: '2026-05-13', estimateDays: 2, assigneeId: null }
    const task2: Task = { ...baseTask, id: 2, isBuffer: false, plannedStart: '2026-05-11', plannedEnd: '2026-05-15', estimateDays: 3, assigneeId: null }
    const result = calculateProjectPv({
      tasks: [task1, task2],
      members: [],
      holidays: [],
      snapshots: [],
      baseDate: '2026-05-20',
    })
    // どちらも baseDate >= plannedEnd → 2 + 3 = 5
    expect(result).toBe(5)
  })

  it('is_buffer=true タスクを累積 PV から除外する（要件 1.5）', () => {
    const normalTask: Task = {
      ...baseTask,
      id: 1,
      assigneeId: null,
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-20',
      estimateDays: 5,
    }
    const bufferTask: Task = {
      ...baseTask,
      id: 2,
      assigneeId: null,
      isBuffer: true,
      estimateDays: 3,
    }
    const result = calculateProjectPv({
      tasks: [normalTask, bufferTask],
      members: [],
      holidays: [],
      snapshots: [],
      baseDate: '2026-05-20',
    })
    // bufferTask は除外されるので normalTask の estimateDays=5 のみ
    expect(result).toBe(5)
  })

  it('複数タスクの PV を合計する（要件 1.6）', () => {
    const task1: Task = {
      ...baseTask,
      id: 1,
      assigneeId: null,
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
      estimateDays: 3,
    }
    const task2: Task = {
      ...baseTask,
      id: 2,
      assigneeId: null,
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-15',
      estimateDays: 4,
    }
    const result = calculateProjectPv({
      tasks: [task1, task2],
      members: [],
      holidays: [],
      snapshots: [],
      baseDate: '2026-05-20',
    })
    // どちらも baseDate >= plannedEnd → estimateDays の合計 = 3 + 4 = 7
    expect(result).toBe(7)
  })

  it('assigneeId に対応する Member の availabilityRate を使用する', () => {
    const member: Member = { ...baseMember, id: 10, availabilityRate: 0.5 }
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 10,
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-20',
      estimateDays: 10,
    }
    const result = calculateProjectPv({
      tasks: [task],
      members: [member],
      holidays: [],
      snapshots: [],
      // 中間日: 2026-05-13 → 3稼働日 → min(3*0.5, 10) = 1.5
      baseDate: '2026-05-13',
    })
    expect(result).toBeCloseTo(1.5)
  })

  it('assigneeId に対応する Member が見つからない場合は availabilityRate=1.0 を使用する', () => {
    const task: Task = {
      ...baseTask,
      id: 1,
      assigneeId: 999, // 存在しない ID
      isBuffer: false,
      plannedStart: '2026-05-11',
      plannedEnd: '2026-05-20',
      estimateDays: 10,
    }
    const result = calculateProjectPv({
      tasks: [task],
      members: [],
      holidays: [],
      snapshots: [],
      // 中間日: 2026-05-13 → 3稼働日 → min(3*1.0, 10) = 3
      baseDate: '2026-05-13',
    })
    expect(result).toBe(3)
  })
})

// ─── calculateTaskEv / calculateProjectEv / calculateProjectAc ──────────────

// 共通 ProgressSnapshot ベース
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

describe('calculateTaskEv', () => {
  it('progress_pct=0 → 0 を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 5 }
    expect(calculateTaskEv(task, 0)).toBe(0)
  })

  it('progress_pct=100 → estimate_days を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 5 }
    expect(calculateTaskEv(task, 100)).toBe(5)
  })

  it('is_buffer=true タスクは calculateTaskEv に渡されないことを前提とする（is_buffer 除外は calculateProjectEv で行う）', () => {
    // calculateTaskEv 自体は is_buffer を考慮しない（呼び出し側で除外）
    // progress_pct=50, estimateDays=6 の場合は 3 を返す
    const task: Task = { ...baseTask, isBuffer: true, estimateDays: 6 }
    expect(calculateTaskEv(task, 50)).toBeCloseTo(3)
  })

  it('progress_pct=0 → 0 を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 5 }
    expect(calculateTaskEv(task, 0)).toBe(0)
  })

  it('progress_pct=100 → estimate_days を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 5 }
    expect(calculateTaskEv(task, 100)).toBe(5)
  })

  it('progress_pct=50 → estimate_days * 0.5 を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 10 }
    expect(calculateTaskEv(task, 50)).toBe(5)
  })

  it('estimateDays=3, progress_pct=33 → 0.99 を返す（要件 2.1）', () => {
    const task: Task = { ...baseTask, estimateDays: 3 }
    expect(calculateTaskEv(task, 33)).toBeCloseTo(0.99)
  })
})

describe('calculateProjectEv', () => {
  it('is_buffer=true タスクを除外して EV を合計する（要件 2.2, 2.3）', () => {
    const normalTask: Task = { ...baseTask, id: 1, isBuffer: false, estimateDays: 8 }
    const bufferTask: Task = { ...baseTask, id: 2, isBuffer: true, estimateDays: 4 }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ taskId: 1, progressPct: 50 }),   // EV = 8 * 0.5 = 4
      makeSnapshot({ id: 2, taskId: 2, progressPct: 100 }), // bufferTask → 除外
    ]
    const result = calculateProjectEv([normalTask, bufferTask], snapshots)
    expect(result).toBe(4)
  })

  it('is_buffer=true タスクを除外して EV を合計する（要件 2.2, 2.3）', () => {
    const normalTask: Task = { ...baseTask, id: 1, isBuffer: false, estimateDays: 10 }
    const bufferTask: Task = { ...baseTask, id: 2, isBuffer: true, estimateDays: 5 }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ taskId: 1, progressPct: 50 }),  // EV = 10 * 0.5 = 5
      makeSnapshot({ id: 2, taskId: 2, progressPct: 80 }),  // bufferTask → 除外
    ]
    const result = calculateProjectEv([normalTask, bufferTask], snapshots)
    expect(result).toBe(5)
  })

  it('複数の非バッファタスクの EV を合計する（要件 2.2）', () => {
    const task1: Task = { ...baseTask, id: 1, isBuffer: false, estimateDays: 10 }
    const task2: Task = { ...baseTask, id: 2, isBuffer: false, estimateDays: 4 }
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ taskId: 1, progressPct: 100 }),  // EV = 10
      makeSnapshot({ id: 2, taskId: 2, progressPct: 50 }),  // EV = 2
    ]
    const result = calculateProjectEv([task1, task2], snapshots)
    expect(result).toBe(12)
  })

  it('スナップショットがないタスクは EV=0 として扱う', () => {
    const task1: Task = { ...baseTask, id: 1, isBuffer: false, estimateDays: 10 }
    const snapshots: ProgressSnapshot[] = []  // snapshot なし
    const result = calculateProjectEv([task1], snapshots)
    expect(result).toBe(0)
  })
})

describe('calculateProjectAc', () => {
  it('全スナップショットの acDays を合計する（要件 2.4）', () => {
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ acDays: 3 }),
      makeSnapshot({ id: 2, taskId: 2, acDays: 4 }),
    ]
    expect(calculateProjectAc(snapshots)).toBeCloseTo(7)
  })

  it('is_buffer=true タスクを AC 累積から除外する（備考: calculateProjectAc は snapshots のみを受け取るため、AC 除外はスナップショット渡し側で制御）', () => {
    // calculateProjectAc 自体は is_buffer を知らない。渡された snapshots の合算のみ行う。
    // is_buffer タスクのスナップショットを渡さない = 除外
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ acDays: 5 }), // 非バッファタスクのみ
    ]
    expect(calculateProjectAc(snapshots)).toBe(5)
  })

  it('全スナップショットの acDays を合計する（要件 2.4）', () => {
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ acDays: 2 }),
      makeSnapshot({ id: 2, taskId: 2, acDays: 3.5 }),
    ]
    expect(calculateProjectAc(snapshots)).toBeCloseTo(5.5)
  })

  it('スナップショットが空の場合 0 を返す（要件 2.4）', () => {
    expect(calculateProjectAc([])).toBe(0)
  })

  it('acDays が全て 0 の場合 0 を返す', () => {
    const snapshots: ProgressSnapshot[] = [
      makeSnapshot({ acDays: 0 }),
      makeSnapshot({ id: 2, taskId: 2, acDays: 0 }),
    ]
    expect(calculateProjectAc(snapshots)).toBe(0)
  })
})

// ─── calculateEvmMetrics (SPI/CPI/EAC/VAC/ETC/TCPI) ────────────────────────

import { calculateEvmMetrics } from './evm-engine.js'

// calculateEvmMetrics テスト用ヘルパー
function makeEvmInput(overrides: {
  tasks?: Task[]
  members?: Member[]
  holidays?: Holiday[]
  snapshots?: ProgressSnapshot[]
  baseDate?: string
}): Parameters<typeof calculateEvmMetrics>[0] {
  return {
    tasks: overrides.tasks ?? [],
    members: overrides.members ?? [],
    holidays: overrides.holidays ?? [],
    snapshots: overrides.snapshots ?? [],
    baseDate: overrides.baseDate ?? '2026-05-14',
  }
}

// 標準タスク (estimateDays=10, plannedStart=2026-05-01, plannedEnd=2026-05-10)
// baseDate=2026-05-14 → baseDate >= plannedEnd → PV = estimateDays = 10
const evmTask: Task = {
  ...baseTask,
  id: 1,
  estimateDays: 10,
  plannedStart: '2026-05-01',
  plannedEnd: '2026-05-10',
  isBuffer: false,
  assigneeId: null,
}

describe('calculateEvmMetrics', () => {
  describe('基本フィールド', () => {
    it('BAC はバッファ除外タスクの estimateDays 合計である（要件 3.x）', () => {
      const bufferTask: Task = { ...baseTask, id: 2, isBuffer: true, estimateDays: 5 }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask, bufferTask],
        baseDate: '2026-05-14',
      }))
      // バッファ除外 → BAC = 10
      expect(result.bac).toBe(10)
    })

    it('taskMetrics にバッファ以外の各タスクメトリクスが含まれる（要件 7.3）', () => {
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        baseDate: '2026-05-14',
      }))
      expect(result.taskMetrics).toHaveLength(1)
      expect(result.taskMetrics[0]?.taskId).toBe(1)
    })
  })

  describe('SPI', () => {
    it('PV=0 → SPI は null を返す（要件 3.2）', () => {
      // baseDate < plannedStart → PV=0
      const futureTask: Task = {
        ...baseTask,
        id: 1,
        estimateDays: 10,
        plannedStart: '2026-06-01',
        plannedEnd: '2026-06-10',
        isBuffer: false,
        assigneeId: null,
      }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [futureTask],
        baseDate: '2026-05-14',
      }))
      expect(result.pv).toBe(0)
      expect(result.spi).toBeNull()
    })

    it('PV>0, EV=6 → SPI = EV/PV = 0.6（要件 3.1）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 60 }), // EV = 10 * 0.6 = 6
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      // PV = 10 (baseDate >= plannedEnd), EV = 6
      expect(result.pv).toBe(10)
      expect(result.ev).toBeCloseTo(6)
      expect(result.spi).toBeCloseTo(0.6)
    })
  })

  describe('CPI', () => {
    it('AC=0 → CPI は null を返す（要件 3.4）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 50, acDays: 0 }),
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.ac).toBe(0)
      expect(result.cpi).toBeNull()
    })

    it('AC>0, EV=6, AC=8 → CPI = EV/AC = 0.75（要件 3.3）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 60, acDays: 8 }), // EV=6, AC=8
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.ev).toBeCloseTo(6)
      expect(result.ac).toBeCloseTo(8)
      expect(result.cpi).toBeCloseTo(0.75)
    })
  })

  describe('EAC', () => {
    it('SPI=null (PV=0) のとき EAC は null を返す（要件 3.5）', () => {
      const futureTask: Task = {
        ...baseTask,
        id: 1,
        estimateDays: 10,
        plannedStart: '2026-06-01',
        plannedEnd: '2026-06-10',
        isBuffer: false,
        assigneeId: null,
      }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [futureTask],
        baseDate: '2026-05-14',
      }))
      expect(result.spi).toBeNull()
      expect(result.eac).toBeNull()
    })

    it('SPI=0.8 のとき EAC = BAC/SPI = 12.5（要件 3.5）', () => {
      // BAC=10, EV=8, PV=10 → SPI=0.8 → EAC=10/0.8=12.5
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 80, acDays: 0 }), // EV=8
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.spi).toBeCloseTo(0.8)
      expect(result.eac).toBeCloseTo(12.5)
    })
  })

  describe('VAC', () => {
    it('EAC=null のとき VAC は null を返す（要件 3.6）', () => {
      const futureTask: Task = {
        ...baseTask,
        id: 1,
        estimateDays: 10,
        plannedStart: '2026-06-01',
        plannedEnd: '2026-06-10',
        isBuffer: false,
        assigneeId: null,
      }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [futureTask],
        baseDate: '2026-05-14',
      }))
      expect(result.eac).toBeNull()
      expect(result.vac).toBeNull()
    })

    it('BAC=10, EAC=12.5 → VAC = -2.5（要件 3.6）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 80, acDays: 0 }),
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.vac).toBeCloseTo(-2.5)
    })
  })

  describe('ETC', () => {
    it('EAC=null のとき ETC は null を返す（要件 3.7）', () => {
      const futureTask: Task = {
        ...baseTask,
        id: 1,
        estimateDays: 10,
        plannedStart: '2026-06-01',
        plannedEnd: '2026-06-10',
        isBuffer: false,
        assigneeId: null,
      }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [futureTask],
        baseDate: '2026-05-14',
      }))
      expect(result.eac).toBeNull()
      expect(result.etc).toBeNull()
    })

    it('EAC=12.5, AC=8 → ETC = 4.5（要件 3.7）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 80, acDays: 8 }),
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      // SPI=EV/PV, EV=8, PV=10 → SPI=0.8, EAC=BAC/SPI=10/0.8=12.5, ETC=EAC-AC=12.5-8=4.5
      expect(result.etc).toBeCloseTo(4.5)
    })
  })

  describe('TCPI', () => {
    it('BAC-AC=0 → TCPI は null を返す（要件 3.9）', () => {
      // AC=BAC=10 → BAC-AC=0
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 50, acDays: 10 }),
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.ac).toBe(10)
      expect(result.bac).toBe(10)
      expect(result.tcpi).toBeNull()
    })

    it('BAC=10, EV=4, AC=5 → TCPI = (10-4)/(10-5) = 1.2（要件 3.8）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 40, acDays: 5 }), // EV=4, AC=5
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.tcpi).toBeCloseTo(1.2)
    })
  })

  describe('taskMetrics', () => {
    it('各タスクに PV/EV/AC/SPI/CPI/alertLevel が含まれる（要件 7.3）', () => {
      const snapshots: ProgressSnapshot[] = [
        makeSnapshot({ taskId: 1, progressPct: 60, acDays: 8 }),
      ]
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots,
        baseDate: '2026-05-14',
      }))
      expect(result.taskMetrics).toHaveLength(1)
      const tm = result.taskMetrics[0]
      expect(tm).toBeDefined()
      if (tm) {
        expect(tm.taskId).toBe(1)
        expect(tm.pv).toBe(10)
        expect(tm.ev).toBeCloseTo(6)
        expect(tm.ac).toBeCloseTo(8)
        expect(tm.spi).toBeCloseTo(0.6)
        expect(tm.cpi).toBeCloseTo(0.75)
        // baseDate(2026-05-14) > plannedEnd(2026-05-10) かつ progressPct=60 < 100 → OVERDUE
        expect(tm.alertLevel).toBe('OVERDUE')
      }
    })

    it('タスク PV=0 のとき taskMetrics の SPI は null（要件 3.2）', () => {
      const futureTask: Task = {
        ...baseTask,
        id: 1,
        estimateDays: 10,
        plannedStart: '2026-06-01',
        plannedEnd: '2026-06-10',
        isBuffer: false,
        assigneeId: null,
      }
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [futureTask],
        baseDate: '2026-05-14',
      }))
      const tm = result.taskMetrics[0]
      expect(tm).toBeDefined()
      if (tm) {
        expect(tm.spi).toBeNull()
      }
    })

    it('タスク AC=0 のとき taskMetrics の CPI は null（要件 3.4）', () => {
      const result = calculateEvmMetrics(makeEvmInput({
        tasks: [evmTask],
        snapshots: [makeSnapshot({ taskId: 1, progressPct: 50, acDays: 0 })],
        baseDate: '2026-05-14',
      }))
      const tm = result.taskMetrics[0]
      expect(tm).toBeDefined()
      if (tm) {
        expect(tm.cpi).toBeNull()
      }
    })
  })
})

// ─── evaluateAlertLevel ─────────────────────────────────────────────────────

describe('evaluateAlertLevel', () => {
  it('SPI < 0.8 → CRITICAL_DELAY を返す（要件 4.1）', () => {
    expect(evaluateAlertLevel(0.75, 0, false)).toBe('CRITICAL_DELAY')
  })

  it('delayDays > 5（delayDays=7）→ CRITICAL_DELAY を返す（要件 4.1）', () => {
    // calculateEvmMetrics は delayDays=0 固定のため、直接 evaluateAlertLevel を呼び出す
    expect(evaluateAlertLevel(null, 7, false)).toBe('NA') // SPI=null → NA が優先
    // SPI が有効値でも delayDays=7 → CRITICAL_DELAY
    expect(evaluateAlertLevel(0.95, 7, false)).toBe('CRITICAL_DELAY')
  })

  it('0.8 <= SPI < 0.9（SPI=0.85）→ WARNING_DELAY を返す（要件 4.2）', () => {
    expect(evaluateAlertLevel(0.85, 0, false)).toBe('WARNING_DELAY')
  })

  it('delayDays=2（0 < delayDays <= 5）かつ SPI >= 0.9 → WARNING_DELAY を返す（要件 4.2）', () => {
    expect(evaluateAlertLevel(0.95, 2, false)).toBe('WARNING_DELAY')
  })

  it('SPI >= 0.9（SPI=0.95）かつ delayDays=0 → NORMAL を返す（要件 4.3）', () => {
    expect(evaluateAlertLevel(0.95, 0, false)).toBe('NORMAL')
  })

  it('planned_end 超過・未完了（isOverdue=true）→ OVERDUE を返す（要件 4.4）', () => {
    expect(evaluateAlertLevel(0.95, 0, true)).toBe('OVERDUE')
  })

  it('SPI=null → NA を返す（要件 4.5）', () => {
    expect(evaluateAlertLevel(null, 0, false)).toBe('NA')
  })

  // --- 具体的なテストケース ---

  it('SPI=null → NA を返す（要件 4.5）', () => {
    expect(evaluateAlertLevel(null, 0, false)).toBe('NA')
  })

  it('SPI=null かつ isOverdue=true でも NA を返す（NA が最優先）', () => {
    expect(evaluateAlertLevel(null, 3, true)).toBe('NA')
  })

  it('isOverdue=true → OVERDUE を返す（要件 4.4）', () => {
    // SPI が正常範囲でも overdue が優先される
    expect(evaluateAlertLevel(0.95, 0, true)).toBe('OVERDUE')
  })

  it('SPI < 0.8 → CRITICAL_DELAY を返す（要件 4.1）', () => {
    expect(evaluateAlertLevel(0.79, 0, false)).toBe('CRITICAL_DELAY')
    expect(evaluateAlertLevel(0.5, 0, false)).toBe('CRITICAL_DELAY')
  })

  it('delayDays > 5 → CRITICAL_DELAY を返す（要件 4.1）', () => {
    // SPI が 0.9 以上でも delayDays > 5 なら CRITICAL_DELAY
    expect(evaluateAlertLevel(0.95, 6, false)).toBe('CRITICAL_DELAY')
  })

  it('SPI=0.8（境界）かつ delayDays=0 → WARNING_DELAY を返さない（SPI<0.9 で WARNING）', () => {
    // SPI=0.8 は 0.8 以上 0.9 未満 → WARNING_DELAY
    expect(evaluateAlertLevel(0.8, 0, false)).toBe('WARNING_DELAY')
  })

  it('0.8 <= SPI < 0.9 → WARNING_DELAY を返す（要件 4.2）', () => {
    expect(evaluateAlertLevel(0.85, 0, false)).toBe('WARNING_DELAY')
  })

  it('delayDays > 0（かつ delayDays <= 5）かつ SPI >= 0.9 → WARNING_DELAY を返す（要件 4.2）', () => {
    expect(evaluateAlertLevel(0.95, 3, false)).toBe('WARNING_DELAY')
  })

  it('delayDays=5（境界）→ WARNING_DELAY を返す（要件 4.2）', () => {
    expect(evaluateAlertLevel(0.95, 5, false)).toBe('WARNING_DELAY')
  })

  it('delayDays=6（境界越え）→ CRITICAL_DELAY を返す（要件 4.1）', () => {
    expect(evaluateAlertLevel(0.95, 6, false)).toBe('CRITICAL_DELAY')
  })

  it('SPI >= 0.9 かつ delayDays=0 かつ isOverdue=false → NORMAL を返す（要件 4.3）', () => {
    expect(evaluateAlertLevel(0.9, 0, false)).toBe('NORMAL')
    expect(evaluateAlertLevel(1.0, 0, false)).toBe('NORMAL')
    expect(evaluateAlertLevel(1.2, 0, false)).toBe('NORMAL')
  })
})

// ─── calculateFeverChart ─────────────────────────────────────────────────────

import { calculateFeverChart } from './evm-engine.js'

describe('calculateFeverChart', () => {
  it('GREEN ゾーン判定を検証する（bufferConsumption=0.2, completion=0.5 → GREEN）', () => {
    // bufferConsumption=0.2, completion=0.5 → 0.2 < 0.5*0.67=0.335 → GREEN
    const result = calculateFeverChart(2, 10, 5, 10)
    expect(result.zone).toBe('GREEN')
  })

  it('YELLOW ゾーン判定を検証する（bufferConsumption=0.4, completion=0.5 → YELLOW）', () => {
    // bufferConsumption=0.4, completion=0.5 → 0.335 <= 0.4 < 0.5 → YELLOW
    const result = calculateFeverChart(4, 10, 5, 10)
    expect(result.zone).toBe('YELLOW')
  })

  it('RED ゾーン判定を検証する（bufferConsumption=0.6, completion=0.5 → RED）', () => {
    // bufferConsumption=0.6, completion=0.5 → 0.6 >= 0.5 → RED
    const result = calculateFeverChart(6, 10, 5, 10)
    expect(result.zone).toBe('RED')
  })

  it('バッファ消費率を正確に計算する（cumulativeDelayDays/bufferTotalDays）', () => {
    // cumulativeDelayDays=3, bufferTotalDays=15 → bufferConsumption=0.2
    const result = calculateFeverChart(3, 15, 5, 10)
    expect(result.bufferConsumption).toBeCloseTo(0.2)
  })

  it('クリティカルチェーン完了率を正確に計算する（completedEvOnChain/bacOfChain）', () => {
    // completedEvOnChain=7, bacOfChain=14 → criticalChainCompletion=0.5
    const result = calculateFeverChart(1, 10, 7, 14)
    expect(result.criticalChainCompletion).toBeCloseTo(0.5)
  })

  // --- 具体的なテストケース ---

  it('bufferConsumption と criticalChainCompletion を正確に計算する（要件 6.1, 6.2）', () => {
    // cumulativeDelayDays=2, bufferTotalDays=10 → bufferConsumption=0.2
    // completedEvOnChain=5, bacOfChain=10 → criticalChainCompletion=0.5
    const result = calculateFeverChart(2, 10, 5, 10)
    expect(result.bufferConsumption).toBeCloseTo(0.2)
    expect(result.criticalChainCompletion).toBeCloseTo(0.5)
  })

  it('GREEN: bufferConsumption < completion * 0.67 → GREEN を返す（要件 6.3）', () => {
    // bufferConsumption=0.2, completion=0.5 → 0.2 < 0.5*0.67=0.335 → GREEN
    const result = calculateFeverChart(2, 10, 5, 10)
    expect(result.zone).toBe('GREEN')
  })

  it('YELLOW: bufferConsumption >= completion*0.67 かつ < completion → YELLOW を返す（要件 6.4）', () => {
    // bufferConsumption=0.4, completion=0.5 → 0.4 >= 0.335 かつ 0.4 < 0.5 → YELLOW
    const result = calculateFeverChart(4, 10, 5, 10)
    expect(result.zone).toBe('YELLOW')
  })

  it('RED: bufferConsumption >= completion → RED を返す（要件 6.5）', () => {
    // bufferConsumption=0.6, completion=0.5 → 0.6 >= 0.5 → RED
    const result = calculateFeverChart(6, 10, 5, 10)
    expect(result.zone).toBe('RED')
  })

  it('GREEN/YELLOW 境界: bufferConsumption = completion*0.67 → YELLOW を返す（境界値）', () => {
    // completion=0.5, boundary=0.335, bufferConsumption=0.335 → YELLOW（< ではないので GREEN でない）
    // cumulativeDelayDays=3.35, bufferTotalDays=10 → bufferConsumption=0.335
    const result = calculateFeverChart(3.35, 10, 5, 10)
    expect(result.zone).toBe('YELLOW')
  })

  it('YELLOW/RED 境界: bufferConsumption = completion → RED を返す（境界値）', () => {
    // completion=0.5, bufferConsumption=0.5 → RED（< ではないので YELLOW でない）
    const result = calculateFeverChart(5, 10, 5, 10)
    expect(result.zone).toBe('RED')
  })

  it('bufferTotalDays=0 のとき bufferConsumption=0 を返す（ゼロ除算防御・要件 6.6）', () => {
    const result = calculateFeverChart(0, 0, 5, 10)
    expect(result.bufferConsumption).toBe(0)
    expect(Number.isNaN(result.bufferConsumption)).toBe(false)
  })

  it('bacOfChain=0 のとき criticalChainCompletion=0 を返す（ゼロ除算防御・要件 6.6）', () => {
    const result = calculateFeverChart(2, 10, 0, 0)
    expect(result.criticalChainCompletion).toBe(0)
    expect(Number.isNaN(result.criticalChainCompletion)).toBe(false)
  })

  it('完了率100%（criticalChainCompletion=1.0）でも正しくゾーン判定する（要件 7.1）', () => {
    // completion=1.0, bufferConsumption=0.5 → 0.5 < 1.0*0.67=0.67 → GREEN
    const result = calculateFeverChart(5, 10, 10, 10)
    expect(result.criticalChainCompletion).toBeCloseTo(1.0)
    expect(result.zone).toBe('GREEN')
  })

  it('完了率100%（criticalChainCompletion=1.0）で YELLOW ゾーン判定する（要件 7.1）', () => {
    // completion=1.0, bufferConsumption=0.8 → 0.67 <= 0.8 < 1.0 → YELLOW
    const result = calculateFeverChart(8, 10, 10, 10)
    expect(result.criticalChainCompletion).toBeCloseTo(1.0)
    expect(result.bufferConsumption).toBeCloseTo(0.8)
    expect(result.zone).toBe('YELLOW')
  })

  it('bufferConsumption が 1.0 超（バッファ超過）でも RED を返す（要件 7.3）', () => {
    // bufferConsumption=1.2, completion=0.5 → RED
    const result = calculateFeverChart(12, 10, 5, 10)
    expect(result.bufferConsumption).toBeCloseTo(1.2)
    expect(result.zone).toBe('RED')
  })
})

// ─── findCriticalPath (critical-path.ts) ────────────────────────────────────

import { findCriticalPath } from './critical-path.js'
import type { TaskDependency } from '../db/schema.js'

describe('findCriticalPath', () => {
  it('is_buffer=true タスクをパス探索から除外する（要件 5.1）', () => {
    // T1 → T2(buffer) → T3 の依存関係で、T2 がバッファのため終端は T1 になる
    const t1: Task = { ...baseTask, id: 1, plannedStart: '2026-05-01', plannedEnd: '2026-05-05', isBuffer: false }
    const t2: Task = { ...baseTask, id: 2, plannedStart: '2026-05-06', plannedEnd: '2026-05-20', isBuffer: true }
    const deps: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 }, // T2(buffer) は T1 に依存
    ]
    const result = findCriticalPath({ tasks: [t1, t2], dependencies: deps })
    // T2 は is_buffer=true なので除外 → クリティカルパスは [1] のみ
    expect(result.criticalPath).not.toContain(2)
    expect(result.criticalPath).toContain(1)
  })

  it('2経路（A→B→D と A→C→D）で plannedEnd 最遅の経路が選択される（要件 5.3）', () => {
    // A→B→D (plannedEnd: 05-20) と A→C→D (C の plannedEnd: 05-25)
    // B(05-10) と C(05-25) のどちらを経由するかで D の先行が決まる
    const tA: Task = { ...baseTask, id: 1, plannedStart: '2026-05-01', plannedEnd: '2026-05-05', isBuffer: false }
    const tB: Task = { ...baseTask, id: 2, plannedStart: '2026-05-06', plannedEnd: '2026-05-10', isBuffer: false }
    const tC: Task = { ...baseTask, id: 3, plannedStart: '2026-05-06', plannedEnd: '2026-05-25', isBuffer: false }
    const tD: Task = { ...baseTask, id: 4, plannedStart: '2026-05-26', plannedEnd: '2026-05-30', isBuffer: false }
    const deps: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 }, // B は A に依存
      { id: 2, taskId: 3, dependsOnTaskId: 1 }, // C は A に依存
      { id: 3, taskId: 4, dependsOnTaskId: 2 }, // D は B に依存
      { id: 4, taskId: 4, dependsOnTaskId: 3 }, // D は C にも依存
    ]
    const result = findCriticalPath({ tasks: [tA, tB, tC, tD], dependencies: deps })
    // D の先行として C(plannedEnd=05-25) が B(plannedEnd=05-10) より遅い → パスは A→C→D
    expect(result.criticalPath).toEqual([1, 3, 4])
    expect(result.terminalTaskId).toBe(4)
  })

  it('正常系: 3タスク直列でクリティカルパスを返す（要件 5.1, 5.2, 5.3）', () => {
    // T1 → T2 → T3 の直列依存
    const t1: Task = { ...baseTask, id: 1, plannedStart: '2026-05-01', plannedEnd: '2026-05-05', isBuffer: false }
    const t2: Task = { ...baseTask, id: 2, plannedStart: '2026-05-06', plannedEnd: '2026-05-12', isBuffer: false }
    const t3: Task = { ...baseTask, id: 3, plannedStart: '2026-05-13', plannedEnd: '2026-05-20', isBuffer: false }
    const deps: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 }, // T2 は T1 に依存
      { id: 2, taskId: 3, dependsOnTaskId: 2 }, // T3 は T2 に依存
    ]
    const result = findCriticalPath({ tasks: [t1, t2, t3], dependencies: deps })
    expect(result.criticalPath).toEqual([1, 2, 3])
    expect(result.terminalTaskId).toBe(3)
  })

  it('循環依存を検出して EVM_CIRCULAR_DEPENDENCY をスローする（要件 5.4, 7.4）', () => {
    // T1 → T2 → T1 の循環
    const t1: Task = { ...baseTask, id: 1, plannedStart: '2026-05-01', plannedEnd: '2026-05-05', isBuffer: false }
    const t2: Task = { ...baseTask, id: 2, plannedStart: '2026-05-06', plannedEnd: '2026-05-12', isBuffer: false }
    const deps: TaskDependency[] = [
      { id: 1, taskId: 2, dependsOnTaskId: 1 }, // T2 は T1 に依存
      { id: 2, taskId: 1, dependsOnTaskId: 2 }, // T1 は T2 に依存（循環）
    ]
    expect(() => findCriticalPath({ tasks: [t1, t2], dependencies: deps })).toThrow(AppError)
    expect(() => findCriticalPath({ tasks: [t1, t2], dependencies: deps })).toThrow(
      expect.objectContaining({ code: ErrorCode.EVM_CIRCULAR_DEPENDENCY }),
    )
  })

  it('終端タスク ID を terminalTaskId として返す（要件 5.2）', () => {
    // 独立した2タスク（依存なし）、plannedEnd が遅い方が終端
    const t1: Task = { ...baseTask, id: 1, plannedStart: '2026-05-01', plannedEnd: '2026-05-05', isBuffer: false }
    const t2: Task = { ...baseTask, id: 2, plannedStart: '2026-05-01', plannedEnd: '2026-05-20', isBuffer: false }
    const result = findCriticalPath({ tasks: [t1, t2], dependencies: [] })
    expect(result.terminalTaskId).toBe(2)
  })
})
