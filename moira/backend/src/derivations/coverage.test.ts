import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { human, Log } from '../test-utils.js';
import {
  computeEstimateCoverage,
  computeExecutionCoverage,
  computeScheduleCoverage,
} from './coverage.js';
import { computeEffectiveSet } from './effective-set.js';

function cov(log: Log) {
  const state = fold(log.all());
  const eff = computeEffectiveSet(state);
  return {
    estimate: computeEstimateCoverage(state, eff),
    schedule: computeScheduleCoverage(state, eff),
    execution: computeExecutionCoverage(state, eff),
  };
}

describe('coverage (P2 MODEL:169 / R-S6 MODEL:295)', () => {
  it('returns 0 for an empty/unknown tree (honest gap, P0)', () => {
    expect(cov(new Log())).toEqual({ estimate: 0, schedule: 0, execution: 0 });
  });

  it('drops when an unestimated child is discovered (§2.3 MODEL:96)', () => {
    // Leaf-based (P2 v18): F + a (a agreed, the only effective leaf) → 1/1.
    // Discover unestimated leaf b → 1/2 (F is an internal rollup, excluded).
    const before = cov(new Log().decompose('F', [{ node: 'a', estimate: 3 }]).agree('a', 3));
    expect(before.estimate).toBeCloseTo(1, 10); // a agreed of effective leaves {a}

    const after = cov(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }])
        .agree('a', 3)
        .decompose('F', [{ node: 'b' }]), // discovered, unestimated
    );
    expect(after.estimate).toBeCloseTo(1 / 2, 10); // a agreed of leaves {a, b}
  });

  it('does not double-count superseded nodes (P2 MODEL:181)', () => {
    const c = cov(
      new Log()
        .decompose('F', [{ node: 'old', estimate: 2 }, { node: 'new', estimate: 2 }])
        .agree('old', 2)
        .agree('new', 2)
        .supersede('new', 'old'),
    );
    // leaf-based: effective leaves = {new} (old superseded, F internal); agreed = {new} → 1/1
    expect(c.estimate).toBeCloseTo(1, 10);
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

  it('measures execution coverage as implementing / agreed leaves (R-S8)', () => {
    const c = cov(
      new Log()
        .decompose('F', [
          { node: 'a', estimate: 1 },
          { node: 'b', estimate: 1 },
          { node: 'd', estimate: 1 },
        ])
        .agree('a', 1)
        .agree('b', 1)
        .agree('d', 1)
        .life('a', 'implementing')
        .life('b', 'implementing'),
      // 'd' agreed but still pending → not in execution numerator
    );
    expect(c.execution).toBeCloseTo(2 / 3, 10);
  });

  it('excludes unagreed implementing leaves (agreed-only, R-S8)', () => {
    const c = cov(
      new Log()
        .decompose('F', [
          { node: 'a', estimate: 1 },
          { node: 'b', estimate: 1 },
        ])
        .agree('a', 1)
        .life('a', 'implementing')
        .life('b', 'implementing'), // 'b' never agreed
    );
    // denominator = agreed leaves {a}; implementing-agreed {a} → 1.0
    // 'b' (unagreed implementing) is a visible gap in estimateCoverage, not here
    expect(c.execution).toBeCloseTo(1, 10);
    expect(c.estimate).toBeCloseTo(1 / 2, 10); // leaf-based: a agreed of leaves {a, b}
  });
});
