import { describe, expect, it } from 'vitest'
import { buildGanttMeta } from './evm-gantt.js'
import type { Project } from '../db/schema.js'

/**
 * buildGanttMeta の単体テスト（Requirements 8.1-8.6）。
 *
 * 仕様:
 * - totalDays = (endISO - startISO) + 1 （両端含む暦日数）
 * - baseDay = days(baseDate - startISO) （整数）
 *   - baseDate < startISO のとき 0 にクリップ
 *   - baseDate > endISO のとき totalDays - 1 にクリップ
 * - months: 範囲内の各月初の相対日数 `d` と日本語ラベル `l`（'5月' など）を時系列順に返す。
 *   startISO を含む月は必ず先頭に含める。
 */

const baseProject: Pick<Project, 'startDate' | 'endDate'> = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
}

describe('buildGanttMeta', () => {
  describe('totalDays（両端含む）', () => {
    it('同一月内の範囲で正しい暦日数を返す（5/1-5/31 → 31 日）', () => {
      const meta = buildGanttMeta({
        project: baseProject,
        baseDate: '2026-05-14',
      })

      expect(meta.startISO).toBe('2026-05-01')
      expect(meta.endISO).toBe('2026-05-31')
      expect(meta.totalDays).toBe(31)
    })

    it('単一日（startDate === endDate）で totalDays は 1', () => {
      const meta = buildGanttMeta({
        project: { startDate: '2026-05-15', endDate: '2026-05-15' },
        baseDate: '2026-05-15',
      })

      expect(meta.totalDays).toBe(1)
    })

    it('複数月にまたがる範囲で正しい暦日数を返す（4/15-6/14 → 61 日）', () => {
      const meta = buildGanttMeta({
        project: { startDate: '2026-04-15', endDate: '2026-06-14' },
        baseDate: '2026-05-14',
      })

      // 4/15-4/30 = 16 日, 5/1-5/31 = 31 日, 6/1-6/14 = 14 日 → 61 日
      expect(meta.totalDays).toBe(61)
    })
  })

  describe('baseDay（整数 + クリップ）', () => {
    it('範囲内 baseDate の相対日数を整数で返す（5/1 → 0, 5/14 → 13, 5/31 → 30）', () => {
      const m1 = buildGanttMeta({ project: baseProject, baseDate: '2026-05-01' })
      expect(m1.baseDay).toBe(0)

      const m2 = buildGanttMeta({ project: baseProject, baseDate: '2026-05-14' })
      expect(m2.baseDay).toBe(13)

      const m3 = buildGanttMeta({ project: baseProject, baseDate: '2026-05-31' })
      expect(m3.baseDay).toBe(30)
    })

    it('baseDate < startISO のとき 0 にクリップする', () => {
      const meta = buildGanttMeta({
        project: baseProject,
        baseDate: '2026-04-15',
      })

      expect(meta.baseDay).toBe(0)
    })

    it('baseDate > endISO のとき totalDays - 1 にクリップする', () => {
      const meta = buildGanttMeta({
        project: baseProject,
        baseDate: '2026-06-15',
      })

      expect(meta.baseDay).toBe(meta.totalDays - 1)
      expect(meta.baseDay).toBe(30)
    })
  })

  describe('months（各月初の相対日数と日本語ラベル）', () => {
    it('startISO を含む月を必ず先頭に含める', () => {
      const meta = buildGanttMeta({
        project: baseProject,
        baseDate: '2026-05-14',
      })

      expect(meta.months.length).toBeGreaterThanOrEqual(1)
      expect(meta.months[0]).toEqual({ d: 0, l: '5月' })
    })

    it('複数月にまたがる範囲で各月初を時系列順に返す（4/15-6/14）', () => {
      const meta = buildGanttMeta({
        project: { startDate: '2026-04-15', endDate: '2026-06-14' },
        baseDate: '2026-05-14',
      })

      // 4/15 が start なので 4 月は d=0
      // 5/1 は startISO から 16 日後
      // 6/1 は startISO から 47 日後（16 + 31）
      expect(meta.months).toEqual([
        { d: 0, l: '4月' },
        { d: 16, l: '5月' },
        { d: 47, l: '6月' },
      ])
    })

    it('startISO が月初の場合は d=0 ラベル該当月で 1 件として返す', () => {
      const meta = buildGanttMeta({
        project: { startDate: '2026-05-01', endDate: '2026-07-15' },
        baseDate: '2026-05-14',
      })

      // 5/1 → d=0, 6/1 → d=31, 7/1 → d=61
      expect(meta.months).toEqual([
        { d: 0, l: '5月' },
        { d: 31, l: '6月' },
        { d: 61, l: '7月' },
      ])
    })

    it('年をまたぐ範囲で各月初を正しく返す（2025-12-20 - 2026-02-10）', () => {
      const meta = buildGanttMeta({
        project: { startDate: '2025-12-20', endDate: '2026-02-10' },
        baseDate: '2026-01-15',
      })

      // 12/20 → d=0 (12月), 1/1 → 12 日後 (d=12), 2/1 → 12 + 31 = 43 日後
      expect(meta.months).toEqual([
        { d: 0, l: '12月' },
        { d: 12, l: '1月' },
        { d: 43, l: '2月' },
      ])
    })
  })
})
