import { describe, expect, it } from 'vitest';
import { isBusinessDay, lastNBusinessDays, previousBusinessDay } from './business-days.js';

// Real committed data: 2026-07-06 is a Monday; 2026-05-04/05/06 are the Golden
// Week holidays; 2026-09-21/22/23 is the silver-week holiday run.

describe('isBusinessDay', () => {
  it('weekday → true, weekend → false', () => {
    expect(isBusinessDay('2026-07-06')).toBe(true); // Mon
    expect(isBusinessDay('2026-07-04')).toBe(false); // Sat
    expect(isBusinessDay('2026-07-05')).toBe(false); // Sun
  });

  it('a Japanese holiday on a weekday → false', () => {
    expect(isBusinessDay('2026-05-04')).toBe(false); // みどりの日 (Mon)
  });

  it('outside coverage: warns once and degrades to weekend-only', () => {
    const warnings: string[] = [];
    const opts = { warn: (m: string) => warnings.push(m) };
    expect(isBusinessDay('2030-01-01', opts)).toBe(true); // Tue, holiday unknown
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2030-01-01');
  });
});

describe('previousBusinessDay', () => {
  it('Tuesday → Monday (no skip)', () => {
    expect(previousBusinessDay('2026-07-07')).toBe('2026-07-06');
  });

  it('Monday → previous Friday (weekend skipped)', () => {
    expect(previousBusinessDay('2026-07-06')).toBe('2026-07-03');
  });

  it('skips a holiday run: 2026-05-07(Thu) → 2026-05-01(Fri)', () => {
    // 05-02 Sat, 05-03 Sun(憲法記念日), 05-04..06 holidays → back to Fri 05-01
    expect(previousBusinessDay('2026-05-07')).toBe('2026-05-01');
  });

  it('skips the silver-week run: 2026-09-24(Thu) → 2026-09-18(Fri)', () => {
    // 09-21 敬老の日, 09-22 国民の休日, 09-23 秋分の日, 09-19/20 weekend
    expect(previousBusinessDay('2026-09-24')).toBe('2026-09-18');
  });

  it('out of coverage: weekend-only skip with a single warning', () => {
    const warnings: string[] = [];
    const opts = { warn: (m: string) => warnings.push(m) };
    expect(previousBusinessDay('2030-01-07', opts)).toBe('2030-01-04'); // Mon → Fri
    expect(warnings).toHaveLength(1);
  });
});

describe('lastNBusinessDays', () => {
  it('returns n ascending business days ending at asOf when asOf is one', () => {
    expect(lastNBusinessDays('2026-07-06', 5)).toEqual([
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-06',
    ]);
  });

  it('excludes a non-business asOf itself', () => {
    expect(lastNBusinessDays('2026-07-05', 2)).toEqual(['2026-07-02', '2026-07-03']);
  });

  it('walks across a holiday run', () => {
    expect(lastNBusinessDays('2026-05-07', 3)).toEqual(['2026-04-30', '2026-05-01', '2026-05-07']);
  });
});
