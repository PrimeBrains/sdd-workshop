import { describe, expect, it } from 'vitest'
import { countWorkingDays } from './evm-engine.js'
import type { Holiday } from '../db/schema.js'

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

describe('calculateTaskPv', () => {
  it.todo('基準日 < 開始日 → 0 を返す')
  it.todo('基準日 >= 終了日 → estimate_days を返す')
  it.todo('基準日 = 開始日 → 0 または 1日分を返す')
  it.todo('祝日ありvs祝日なしで差異を確認する')
  it.todo('availability_rate=0.6 でキャップ動作を検証する')
  it.todo('is_buffer=true タスクは 0 を返す')
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
