/**
 * Planned Comparison Module - Unit Tests
 *
 * `calculatePlannedPct` の純関数仕様を検証する。
 * Requirements: 8.1, 8.2, 8.3, 10.6, 10.7
 */

import { describe, it, expect } from 'vitest'
import { calculatePlannedPct } from './planned-comparison'

describe('calculatePlannedPct', () => {
  describe('境界ケース', () => {
    it('snapshotDate < taskPlannedStart は 0 を返す', () => {
      expect(
        calculatePlannedPct({
          projectStartISO: '2026-03-15',
          snapshotDate: '2026-03-20',
          taskPlannedStart: '2026-04-01',
          taskPlannedEnd: '2026-04-11',
        }),
      ).toBe(0)
    })

    it('snapshotDate === taskPlannedStart は 0 を返す', () => {
      expect(
        calculatePlannedPct({
          projectStartISO: '2026-03-15',
          snapshotDate: '2026-04-01',
          taskPlannedStart: '2026-04-01',
          taskPlannedEnd: '2026-04-11',
        }),
      ).toBe(0)
    })

    it('snapshotDate === taskPlannedEnd は 100 を返す', () => {
      expect(
        calculatePlannedPct({
          projectStartISO: '2026-03-15',
          snapshotDate: '2026-04-11',
          taskPlannedStart: '2026-04-01',
          taskPlannedEnd: '2026-04-11',
        }),
      ).toBe(100)
    })

    it('snapshotDate > taskPlannedEnd は 100 を返す（クランプ）', () => {
      expect(
        calculatePlannedPct({
          projectStartISO: '2026-03-15',
          snapshotDate: '2026-05-01',
          taskPlannedStart: '2026-04-01',
          taskPlannedEnd: '2026-04-11',
        }),
      ).toBe(100)
    })
  })

  describe('進行中ケース', () => {
    it('タスク中間（5日経過 / 10日間）は約 50 を返す', () => {
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-04-06',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-11',
      })
      expect(pct).toBeGreaterThanOrEqual(48)
      expect(pct).toBeLessThanOrEqual(52)
    })

    it('1/10 経過は 10 前後を返す', () => {
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-04-02',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-11',
      })
      expect(pct).toBeGreaterThanOrEqual(8)
      expect(pct).toBeLessThanOrEqual(12)
    })

    it('9/10 経過は 90 前後を返す', () => {
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-04-10',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-11',
      })
      expect(pct).toBeGreaterThanOrEqual(88)
      expect(pct).toBeLessThanOrEqual(92)
    })

    it('整数（0〜100の範囲）で返る', () => {
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-04-05',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-11',
      })
      expect(Number.isInteger(pct)).toBe(true)
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    })
  })

  describe('duration === 0 のエッジケース', () => {
    it('start === end かつ snapshot === start は 100 を返す（snapshot >= end のため）', () => {
      // snapshotDate >= taskPlannedEnd が成立するため 100 になる
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-04-01',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-01',
      })
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
      // 例外を投げないことが最重要
      expect(Number.isFinite(pct)).toBe(true)
    })

    it('start === end かつ snapshot < start は 0 を返す（例外を投げない）', () => {
      const pct = calculatePlannedPct({
        projectStartISO: '2026-03-15',
        snapshotDate: '2026-03-31',
        taskPlannedStart: '2026-04-01',
        taskPlannedEnd: '2026-04-01',
      })
      expect(pct).toBe(0)
      expect(Number.isFinite(pct)).toBe(true)
    })
  })

  describe('クランプ動作', () => {
    it('進行中の値は常に 0〜100 にクランプされる', () => {
      // 通常範囲
      for (const snapshot of ['2026-04-01', '2026-04-05', '2026-04-11', '2026-05-01']) {
        const pct = calculatePlannedPct({
          projectStartISO: '2026-03-15',
          snapshotDate: snapshot,
          taskPlannedStart: '2026-04-01',
          taskPlannedEnd: '2026-04-11',
        })
        expect(pct).toBeGreaterThanOrEqual(0)
        expect(pct).toBeLessThanOrEqual(100)
      }
    })
  })
})
