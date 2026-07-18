import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPACITY } from './capacity-store.js';
import { isBusinessDay, isWeekend, orgCalendarFallback } from './org-calendar.js';

// Real committed data: 2026-07-06 is a Monday; 2026-05-04/05/06 are the Golden
// Week holidays; 2026-09-21/22/23 is the silver-week holiday run. Mirrors
// moira/cli/src/business-days.test.ts (same ported behavior, issue #32).

describe('isWeekend', () => {
  it('Saturday/Sunday → true, weekday → false', () => {
    expect(isWeekend('2026-07-04')).toBe(true); // Sat
    expect(isWeekend('2026-07-05')).toBe(true); // Sun
    expect(isWeekend('2026-07-06')).toBe(false); // Mon
  });
});

describe('isBusinessDay', () => {
  it('weekday → true, weekend → false', () => {
    expect(isBusinessDay('2026-07-06')).toBe(true); // Mon
    expect(isBusinessDay('2026-07-04')).toBe(false); // Sat
    expect(isBusinessDay('2026-07-05')).toBe(false); // Sun
  });

  it('a Japanese holiday on a weekday → false', () => {
    expect(isBusinessDay('2026-05-04')).toBe(false); // みどりの日 (Mon)
  });

  it('a plain weekday outside any holiday cluster → true', () => {
    expect(isBusinessDay('2026-09-24')).toBe(true); // Thu, after silver week
  });

  it('outside coverage: warns once and degrades to weekend-only', () => {
    const warnings: string[] = [];
    const opts = { warn: (m: string) => warnings.push(m) };
    expect(isBusinessDay('2030-01-01', opts)).toBe(true); // Tue, holiday unknown
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2030-01-01');
  });

  it('accepts an injected holiday set + coverage (tests do not depend on the committed data)', () => {
    const opts = {
      holidays: new Set(['2026-03-02']),
      coverage: { from: '2026-03-01', to: '2026-03-31' },
    };
    expect(isBusinessDay('2026-03-02', opts)).toBe(false); // injected holiday, Mon
    expect(isBusinessDay('2026-03-03', opts)).toBe(true); // Tue, not a holiday
  });
});

describe('orgCalendarFallback (CapacityLookup — issue #32)', () => {
  it('returns DEFAULT_CAPACITY on a business day', () => {
    const fb = orgCalendarFallback();
    expect(fb('alice', '2026-07-06')).toBe(DEFAULT_CAPACITY); // Mon
  });

  it('returns 0 on a weekend', () => {
    const fb = orgCalendarFallback();
    expect(fb('alice', '2026-07-04')).toBe(0); // Sat
  });

  it('returns 0 on a Japanese holiday', () => {
    const fb = orgCalendarFallback();
    expect(fb('alice', '2026-05-04')).toBe(0); // みどりの日 (Mon)
  });

  it('ignores the humanId argument (same calendar for every human)', () => {
    const fb = orgCalendarFallback();
    expect(fb('alice', '2026-07-04')).toBe(fb('bob', '2026-07-04'));
  });

  it('passes options (e.g. an injected holiday set) through to isBusinessDay', () => {
    const fb = orgCalendarFallback({
      holidays: new Set(['2026-03-02']),
      coverage: { from: '2026-03-01', to: '2026-03-31' },
    });
    expect(fb('alice', '2026-03-02')).toBe(0); // injected holiday, Mon
    expect(fb('alice', '2026-03-03')).toBe(DEFAULT_CAPACITY); // Tue
  });

  it('degrades to weekend-only outside coverage, warning exactly once across multiple lookups (one Calendar per fallback lifetime, not per lookup)', () => {
    const warnings: string[] = [];
    const fb = orgCalendarFallback({ warn: (m) => warnings.push(m) });
    // Two DIFFERENT out-of-coverage WEEKDAYS: both must reach the coverage
    // check (unlike a weekend day, which returns before it). This is what
    // distinguishes "one Calendar for the fallback's whole life" (warns once)
    // from "a fresh Calendar per lookup" (would warn again on the 2nd date).
    expect(fb('alice', '2030-01-01')).toBe(DEFAULT_CAPACITY); // Tue, holiday unknown → treated as business day
    expect(fb('alice', '2030-01-02')).toBe(DEFAULT_CAPACITY); // Wed, still out of coverage — must NOT re-warn
    expect(fb('alice', '2030-01-05')).toBe(0); // Sat — weekend detection still works out of coverage
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2030-01-01'); // warned on the FIRST out-of-coverage date only
  });
});
