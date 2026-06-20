import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { human, Log } from '../test-utils.js';
import { computeEstimateCoverage, computeScheduleCoverage } from './coverage.js';
import { computeEffectiveSet } from './effective-set.js';

function cov(log: Log) {
  const state = fold(log.all());
  const eff = computeEffectiveSet(state);
  return {
    estimate: computeEstimateCoverage(state, eff),
    schedule: computeScheduleCoverage(state, eff),
  };
}

describe('coverage (P2 MODEL:169 / R-S6 MODEL:295)', () => {
  it('returns 0 for an empty/unknown tree (honest gap, P0)', () => {
    expect(cov(new Log())).toEqual({ estimate: 0, schedule: 0 });
  });

  it('drops when an unestimated child is discovered (§2.3 MODEL:96)', () => {
    // F + a (agreed) → coverage 1/2. Discover unestimated b → 1/3.
    const before = cov(new Log().decompose('F', [{ node: 'a', estimate: 3 }]).agree('a', 3));
    expect(before.estimate).toBeCloseTo(1 / 2, 10); // a agreed of {F, a}

    const after = cov(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }])
        .agree('a', 3)
        .decompose('F', [{ node: 'b' }]), // discovered, unestimated
    );
    expect(after.estimate).toBeCloseTo(1 / 3, 10); // a agreed of {F, a, b}
  });

  it('does not double-count superseded nodes (P2 MODEL:169)', () => {
    const c = cov(
      new Log()
        .decompose('F', [{ node: 'old', estimate: 2 }, { node: 'new', estimate: 2 }])
        .agree('old', 2)
        .agree('new', 2)
        .supersede('new', 'old'),
    );
    // effective nodes = {F, new}; agreed = {new} → 1/2
    expect(c.estimate).toBeCloseTo(1 / 2, 10);
  });

  it('measures schedule coverage as scheduled / agreed leaves', () => {
    const c = cov(
      new Log()
        .decompose('F', [
          { node: 'a', estimate: 1 },
          { node: 'b', estimate: 1 },
          { node: 'd', estimate: 1 },
          { node: 'e', estimate: 1 },
          { node: 'g', estimate: 1 },
        ])
        .agree('a', 1)
        .agree('b', 1)
        .agree('d', 1)
        .agree('e', 1)
        .agree('g', 1)
        .schedule('a', human('h'), '2026-01-05')
        .schedule('b', human('h'), '2026-01-06')
        .schedule('d', human('h'), '2026-01-07')
        .schedule('e', human('h'), '2026-01-08'),
      // 'g' agreed but unscheduled
    );
    expect(c.schedule).toBeCloseTo(4 / 5, 10);
  });
});
