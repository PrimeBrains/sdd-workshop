import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { Log } from '../test-utils.js';
import { computeEffectiveSet } from './effective-set.js';
import { computeCumulativeEvAbs, computeEvAbs, computeEvPercent } from './ev.js';

function run(log: Log) {
  const state = fold(log.all());
  const eff = computeEffectiveSet(state);
  const evAbs = computeEvAbs(state, eff);
  return { state, eff, evAbs, evPercent: computeEvPercent(state, eff, evAbs) };
}

describe('EV_abs / EV% (R-U8 MODEL:235)', () => {
  it('counts only agreed AND completed sub-units', () => {
    const { evAbs } = run(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 8 }, { node: 'b', estimate: 5 }])
        .agree('a', 8)
        .life('a', 'implemented') // agreed + completed → counts
        .life('b', 'implemented'), // completed but UNAGREED → excluded (R-U13 exclusion)
    );
    expect(evAbs).toBe(8); // only 'a'
  });

  it('keeps EV% in [0,1] and divides by zero safely', () => {
    const empty = run(new Log().decompose('F', [{ node: 'a' }]));
    expect(empty.evPercent).toBe(0); // no agreed estimates → denom 0

    const partial = run(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 4 }, { node: 'b', estimate: 6 }])
        .agree('a', 4)
        .agree('b', 6)
        .life('a', 'accepted'),
    );
    expect(partial.evAbs).toBe(4);
    expect(partial.evPercent).toBeCloseTo(4 / 10, 10);
    expect(partial.evPercent).toBeLessThanOrEqual(1);
  });

  it('separates cumulative earned (incl. superseded) from current EV_abs (R-S5 MODEL:128)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'old', estimate: 5 }, { node: 'new', estimate: 5 }])
        .agree('old', 5)
        .agree('new', 5)
        .life('old', 'accepted')
        .life('new', 'accepted')
        .supersede('new', 'old') // new → old
        .all(),
    );
    const eff = computeEffectiveSet(state);
    const evAbs = computeEvAbs(state, eff); // only 'new' is effective
    const cumulative = computeCumulativeEvAbs(state); // both count
    expect(evAbs).toBe(5);
    expect(cumulative).toBe(10);
    expect(eff.effectiveLeaves).toEqual(['new']);
  });
});
