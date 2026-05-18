/**
 * Task 9.1: formatters.ts 純関数群の Vitest 単体テスト（RED 段階）
 *
 * 単位契約と不変則（人日 = Man-Day をそのまま表示。スケール変換禁止）を
 * テストで固定し、過去に混入した `1_000_000` 割算系のスケールバグや
 * 符号 (`+` / `−` / `±`) 取り扱いミスを検出可能にする。
 *
 * Requirements: 20.4, 21.1, 21.2, 21.3, 21.4
 *
 * 注意: 本タスク (9.1) は意図的に RED 段階。現行 `formatters.ts` には
 * `fmtMD(n) = (n / 1_000_000).toFixed(1) + ' MD'` のスケールバグが残存しており、
 * `fmtMD(70) === '70.0 MD'` 系のアサートは故意に失敗させる。
 * GREEN 化は task 9.2 で `formatters.ts` 側を修正して達成する。
 */

import { describe, it, expect } from 'vitest'
import {
  fmtMD,
  fmtSignedMD,
  fmtDeltaIdx,
  fmtDeltaMD,
  spiTone,
  deltaTone,
} from './formatters'

describe('fmtMD（単位不変則: API 値の人日マグニチュードをそのまま 1 桁丸めで表示）', () => {
  it('fmtMD(0) === "0.0 MD"（ゼロ境界）', () => {
    expect(fmtMD(0)).toBe('0.0 MD')
  })

  it('fmtMD(70) === "70.0 MD"（人日値 70 をスケール変換せずそのまま表示）', () => {
    // 過去に `1_000_000` 割算が混入したリグレッションを直接検出する境界。
    expect(fmtMD(70)).toBe('70.0 MD')
  })

  it('fmtMD(0.05) === "0.1 MD"（1 桁四捨五入の境界）', () => {
    expect(fmtMD(0.05)).toBe('0.1 MD')
  })
})

describe('fmtSignedMD（符号付き MD 表示: +/−/± を前置）', () => {
  it('fmtSignedMD(+1.5) === "+1.5 MD"', () => {
    expect(fmtSignedMD(1.5)).toBe('+1.5 MD')
  })

  it('fmtSignedMD(-0.8) === "−0.8 MD"（U+2212 MINUS SIGN）', () => {
    expect(fmtSignedMD(-0.8)).toBe('−0.8 MD')
  })

  it('fmtSignedMD(0) === "±0.0 MD"（ゼロは ± プレフィックス）', () => {
    expect(fmtSignedMD(0)).toBe('±0.0 MD')
  })
})

describe('fmtDeltaIdx（指数差分: ▲/▼/± で表示）', () => {
  it('fmtDeltaIdx(+0.02) === "▲0.02"', () => {
    expect(fmtDeltaIdx(0.02)).toBe('▲0.02')
  })

  it('fmtDeltaIdx(-0.03) === "▼0.03"', () => {
    expect(fmtDeltaIdx(-0.03)).toBe('▼0.03')
  })

  it('fmtDeltaIdx(0) === "±0.00"', () => {
    expect(fmtDeltaIdx(0)).toBe('±0.00')
  })
})

describe('fmtDeltaMD（MD 差分: ▲/± で表示）', () => {
  it('fmtDeltaMD(+1.5) === "▲1.5 MD"', () => {
    expect(fmtDeltaMD(1.5)).toBe('▲1.5 MD')
  })

  it('fmtDeltaMD(0) === "±0.0 MD"', () => {
    expect(fmtDeltaMD(0)).toBe('±0.0 MD')
  })
})

describe('spiTone（SPI tone 境界）', () => {
  it('spiTone(null) === "na"', () => {
    expect(spiTone(null)).toBe('na')
  })

  it('spiTone(0.79) === "critical"（< 0.8）', () => {
    expect(spiTone(0.79)).toBe('critical')
  })

  it('spiTone(0.85) === "warning"（0.8 ≤ spi < 0.9）', () => {
    expect(spiTone(0.85)).toBe('warning')
  })

  it('spiTone(0.95) === "normal"（spi ≥ 0.9）', () => {
    expect(spiTone(0.95)).toBe('normal')
  })
})

describe('deltaTone（posGood = false での符号反転）', () => {
  it('正の delta を critical として扱う（posGood = false 時は増加が悪化）', () => {
    // posGood = false（例: AC のように増加が悪い指標）の場合、
    // 正の delta は「悪化」= critical になる。
    expect(deltaTone(1.5, false)).toBe('critical')
  })
})
