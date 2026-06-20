// R-S2 (MODEL:283): appending an event re-derives the state. Demonstrates the
// "event → derivation" backbone — the numbers move when the log grows.

import { describe, expect, it } from 'vitest';
import { derive } from './derive.js';
import { human, Log } from './test-utils.js';
import type { CapacityLookup } from './types.js';

describe('re-derivation on append (R-S2)', () => {
  it('EV_abs rises when a completion event is appended', () => {
    const base = new Log()
      .decompose('F', [{ node: 'a', estimate: 5 }])
      .agree('a', 5)
      .schedule('a', human('alice'), '2026-01-05');

    const before = derive(base.all(), { asOf: '2026-01-31' });
    expect(before.evAbs).toBe(0); // not completed yet

    base.life('a', 'accepted'); // append one event
    const after = derive(base.all(), { asOf: '2026-01-31' });
    expect(after.evAbs).toBe(5); // re-derived
    expect(after.evPercent).toBeCloseTo(1.0, 10);
  });

  it('a c(i,d) change re-derives the live forecast (MODEL:284)', () => {
    const events = new Log()
      .decompose('F', [{ node: 'a', estimate: 4 }])
      .agree('a', 4)
      .schedule('a', human('alice'), '2026-01-05')
      .all();

    const full = derive(events, { asOf: '2026-12-31', startDate: '2026-01-05' });
    const halved: CapacityLookup = () => 0.5;
    const reduced = derive(events, {
      asOf: '2026-12-31',
      startDate: '2026-01-05',
      capacityOf: halved,
    });

    const fa = full.forecast.find((r) => r.node === 'a')?.predictedCompletion;
    const ra = reduced.forecast.find((r) => r.node === 'a')?.predictedCompletion;
    expect(fa).toBe('2026-01-08'); // 4 MD at c=1.0
    expect(ra).toBe('2026-01-12'); // 4 MD at c=0.5 → 8 days
  });
});
