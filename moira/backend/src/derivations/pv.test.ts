import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { human, Log } from '../test-utils.js';
import { computeEffectiveSet } from './effective-set.js';
import { computePv } from './pv.js';

function pv(log: Log, asOf: string) {
  const state = fold(log.all());
  return computePv(state, computeEffectiveSet(state), asOf);
}

describe('PV(t) (§3 MODEL:197)', () => {
  it('excludes agreed-but-unscheduled work (no slot)', () => {
    // agreed, but never scheduled → not in PV.
    expect(pv(new Log().decompose('F', [{ node: 'a', estimate: 5 }]).agree('a', 5), '2026-12-31')).toBe(0);
  });

  it('excludes scheduled-but-unagreed work (no budget)', () => {
    // scheduled, but never agreed → no budget addend.
    expect(
      pv(
        new Log().decompose('F', [{ node: 'a', estimate: 5 }]).schedule('a', human('h'), '2026-01-05'),
        '2026-12-31',
      ),
    ).toBe(0);
  });

  it('includes completed-but-never-scheduled in EV_abs but NOT in PV', () => {
    // agreed + completed, but no frozenSlot ever → excluded from PV (MODEL:197).
    expect(
      pv(
        new Log().decompose('F', [{ node: 'a', estimate: 5 }]).agree('a', 5).life('a', 'accepted'),
        '2026-12-31',
      ),
    ).toBe(0);
  });

  it('counts agreed+scheduled budget up to asOf (date cutoff)', () => {
    const log = new Log()
      .decompose('F', [{ node: 'a', estimate: 4 }, { node: 'b', estimate: 6 }])
      .agree('a', 4)
      .agree('b', 6)
      .schedule('a', human('h'), '2026-01-10')
      .schedule('b', human('h'), '2026-02-10');
    expect(pv(log, '2026-01-31')).toBe(4); // only 'a' (slot ≤ asOf)
    expect(pv(log, '2026-02-28')).toBe(10); // both
  });
});
