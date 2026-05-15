/**
 * Unit Conversion Module (Actual Cost) - Unit Tests
 *
 * `mdToHours` / `hoursToMd` の純関数仕様を検証する。
 * 1 人日 (MD) = 8 時間 (h) の前提と、往復変換の整合性を確認する。
 *
 * Requirements: 8.4, 8.5, 10.6, 10.7
 */

import { describe, it, expect } from 'vitest'
import { mdToHours, hoursToMd } from './ac-unit'

describe('mdToHours', () => {
  it('1 MD === 8 h', () => {
    expect(mdToHours(1)).toBe(8)
  })

  it('2.5 MD === 20 h', () => {
    expect(mdToHours(2.5)).toBe(20)
  })

  it('0 MD === 0 h', () => {
    expect(mdToHours(0)).toBe(0)
  })

  it('負数も線形に変換できる', () => {
    expect(mdToHours(-1)).toBe(-8)
  })
})

describe('hoursToMd', () => {
  it('8 h === 1 MD', () => {
    expect(hoursToMd(8)).toBe(1)
  })

  it('20 h === 2.5 MD', () => {
    expect(hoursToMd(20)).toBe(2.5)
  })

  it('0 h === 0 MD', () => {
    expect(hoursToMd(0)).toBe(0)
  })

  it('負数も線形に変換できる', () => {
    expect(hoursToMd(-8)).toBe(-1)
  })
})

describe('往復変換 (roundtrip)', () => {
  it('hoursToMd(mdToHours(2.5)) === 2.5', () => {
    expect(hoursToMd(mdToHours(2.5))).toBeCloseTo(2.5)
  })

  it('mdToHours(hoursToMd(20)) === 20', () => {
    expect(mdToHours(hoursToMd(20))).toBeCloseTo(20)
  })

  it('複数の MD 値で往復変換が一致する', () => {
    for (const md of [0, 0.5, 1, 1.5, 2, 3.25, 5, 10, 100]) {
      expect(hoursToMd(mdToHours(md))).toBeCloseTo(md)
    }
  })

  it('複数の h 値で往復変換が一致する', () => {
    for (const h of [0, 4, 8, 12, 24, 40, 80, 200]) {
      expect(mdToHours(hoursToMd(h))).toBeCloseTo(h)
    }
  })
})
