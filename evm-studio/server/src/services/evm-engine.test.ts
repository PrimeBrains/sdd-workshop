import { describe, expect, it } from 'vitest'
import { countWorkingDays, calculateTaskPv } from './evm-engine.js'
import type { Holiday, Task } from '../db/schema.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

// ─── countWorkingDays ────────────────────────────────────────────────────────

describe('countWorkingDays', () => {
  it.todo('祝日なし: 月〜金の5日間で5を返す')
  it.todo('祝日あり: 祝日を除外した稼働日数を返す')
  it.todo('土日を除外する')
  it.todo('開始日 = 終了日の場合に1または0を返す')

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

describe('calculateProjectPv', () => {
  it.todo('is_buffer=true タスクを PV 累積から除外する')
  it.todo('複数タスクの PV を合計する')
})

// ─── calculateTaskEv / calculateProjectEv / calculateProjectAc ──────────────

describe('calculateTaskEv', () => {
  it.todo('progress_pct=0 → 0 を返す')
  it.todo('progress_pct=100 → estimate_days を返す')
  it.todo('is_buffer=true タスクは EV 累積から除外する')
})

describe('calculateProjectEv', () => {
  it.todo('is_buffer=true タスクを除外して EV を合計する')
})

describe('calculateProjectAc', () => {
  it.todo('全タスクの AC を合計する')
  it.todo('is_buffer=true タスクを AC 累積から除外する')
})

// ─── calculateEvmMetrics (SPI/CPI/EAC/VAC/ETC/TCPI) ────────────────────────

describe('calculateEvmMetrics', () => {
  describe('SPI', () => {
    it.todo('PV=0 → null を返す')
    it.todo('正常値計算の精度を検証する')
  })

  describe('CPI', () => {
    it.todo('AC=0 → null を返す')
    it.todo('正常値計算の精度を検証する')
  })

  describe('EAC', () => {
    it.todo('通常値計算を検証する')
    it.todo('CPI=null のとき null を返す')
  })

  describe('VAC', () => {
    it.todo('通常値計算を検証する')
    it.todo('EAC=null のとき null を返す')
  })

  describe('ETC', () => {
    it.todo('通常値計算を検証する')
    it.todo('CPI=null のとき null を返す')
  })

  describe('TCPI', () => {
    it.todo('通常値計算を検証する')
    it.todo('BAC-AC=0 → null を返す')
  })
})

// ─── evaluateAlertLevel ─────────────────────────────────────────────────────

describe('evaluateAlertLevel', () => {
  it.todo('SPI < 0.8 → CRITICAL_DELAY を返す')
  it.todo('delayDays > 5 → CRITICAL_DELAY を返す')
  it.todo('0.8 <= SPI < 0.9 → WARNING_DELAY を返す')
  it.todo('SPI >= 0.9 → NORMAL を返す')
  it.todo('planned_end 超過・未完了 → OVERDUE を返す')
  it.todo('SPI=null → NA を返す')
})

// ─── calculateFeverChart ─────────────────────────────────────────────────────

describe('calculateFeverChart', () => {
  it.todo('GREEN ゾーン判定を検証する')
  it.todo('YELLOW ゾーン判定を検証する')
  it.todo('RED ゾーン判定を検証する')
  it.todo('バッファ消費率を正確に計算する')
  it.todo('クリティカルチェーン完了率を正確に計算する')
})

// ─── findCriticalPath (critical-path.ts) ────────────────────────────────────

describe('findCriticalPath', () => {
  it.todo('正常系: 3タスク直列でクリティカルパスを返す')
  it.todo('is_buffer=true タスクをパス探索から除外する')
  it.todo('循環依存を検出して EVM_CIRCULAR_DEPENDENCY をスローする')
  it.todo('終端タスク ID を返す')
})
