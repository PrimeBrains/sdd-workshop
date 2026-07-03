import { describe, expect, it } from 'vitest';
import { verdictOf } from './landing-verdict';

const L = (landingDate: string | null, landed = false, forecastCoverage = 1) => ({
  landed,
  landingDate,
  forecastCoverage,
});

describe('verdictOf (MODEL:238 boundary cases + R-T4 overrun)', () => {
  it('landed → 完了', () => {
    expect(verdictOf(L(null, true), '2026-09-30', null)).toEqual({
      label: '完了（残作業なし）',
      tone: 'ok',
      deRated: false,
    });
  });

  it('no D_pred → 算出不能 (visible gap, never a guess)', () => {
    const v = verdictOf(L(null, false, 0), '2026-09-30', null);
    expect(v.tone).toBe('na');
    expect(v.label).toContain('算出不能');
  });

  it('no deadline → 期限未設定 (neutral; R-T4 silent)', () => {
    const v = verdictOf(L('2026-08-01'), null, null);
    expect(v.tone).toBe('neutral');
    expect(v.label).toContain('期限未設定');
  });

  it('target > deadline → 構成エラー (warn-not-reject boundary)', () => {
    const v = verdictOf(L('2026-08-01'), '2026-09-30', '2026-10-15');
    expect(v.tone).toBe('na');
    expect(v.label).toContain('構成エラー');
  });

  it('past deadline → 間に合わない with the R-T4 overrun magnitude', () => {
    const v = verdictOf(L('2026-10-05'), '2026-09-30', '2026-09-15');
    expect(v.tone).toBe('crit');
    expect(v.label).toBe('間に合わない（5日超過）');
  });

  it('≤ target → 余裕 / between target and deadline → ギリギリ', () => {
    expect(verdictOf(L('2026-09-10'), '2026-09-30', '2026-09-15').tone).toBe('ok');
    expect(verdictOf(L('2026-09-10'), '2026-09-30', '2026-09-15').label).toContain('余裕');
    const giri = verdictOf(L('2026-09-20'), '2026-09-30', '2026-09-15');
    expect(giri.tone).toBe('warn');
    expect(giri.label).toBe('ギリギリ（期限まで10日）');
  });

  it('no target → 期限内 with slack only (余裕/ギリギリ split is impossible)', () => {
    const v = verdictOf(L('2026-09-20'), '2026-09-30', null);
    expect(v.tone).toBe('ok');
    expect(v.label).toBe('期限内（期限まで10日）');
  });

  it('forecastCoverage < 1 → deRated (R-S6-isomorphic pairing)', () => {
    expect(verdictOf(L('2026-09-20', false, 0.5), '2026-09-30', null).deRated).toBe(true);
    expect(verdictOf(L('2026-09-20'), '2026-09-30', null).deRated).toBe(false);
  });
});
