// computeFeatureRollup — per-feature EV attribution (TE03 tree/value axis,
// issue #25). The rows must be the ENGINE's EV over each root-child slice:
// R-U8 (agreed-only), R-S5 (effective set), R-C2 (cancelled excluded) all
// inherited from computeEvAbs/computeEvPercent, never re-implemented.

import { describe, expect, it } from 'vitest';
import { derive } from '../derive.js';
import { human, Log } from '../test-utils.js';
import { computeFeatureRollup } from './feature-rollup.js';

const h = human('h1');

/** root → { f1 → a(2),b(3) ; f2 → c(5) }, all agreed; a implemented, c accepted. */
function twoFeatureLog(): Log {
  return new Log()
    .decompose('root', [{ node: 'f1' }, { node: 'f2' }])
    .decompose('f1', [
      { node: 'a', estimate: 2 },
      { node: 'b', estimate: 3 },
    ])
    .decompose('f2', [{ node: 'c', estimate: 5 }])
    .agree('a', 2)
    .agree('b', 3)
    .agree('c', 5)
    .life('a', 'implemented', h)
    .life('c', 'implemented', h)
    .life('c', 'accepted', h);
}

describe('computeFeatureRollup', () => {
  it('attributes engine EV to root-direct features and sums to the global EV_abs', () => {
    const events = twoFeatureLog().all();
    const rows = computeFeatureRollup(events, 'root');
    expect(rows).toEqual([
      { feature: 'f1', evAbs: 2, evPercent: 2 / 5, budget: 5, leafCount: 2, completedLeafCount: 1 },
      { feature: 'f2', evAbs: 5, evPercent: 1, budget: 5, leafCount: 1, completedLeafCount: 1 },
    ]);
    const d = derive(events, { asOf: '2026-01-01' });
    expect(rows.reduce((s, r) => s + r.evAbs, 0)).toBe(d.evAbs);
  });

  it('a root-direct effective leaf is its own feature', () => {
    const events = new Log()
      .decompose('root', [{ node: 'x', estimate: 1 }])
      .agree('x', 1)
      .life('x', 'implemented', h)
      .all();
    expect(computeFeatureRollup(events, 'root')).toEqual([
      { feature: 'x', evAbs: 1, evPercent: 1, budget: 1, leafCount: 1, completedLeafCount: 1 },
    ]);
  });

  it('a superseded feature leaves the rollup; the new one carries the EV (R-S5)', () => {
    const events = new Log()
      .decompose('root', [
        { node: 'f-old', estimate: 3 },
        { node: 'f-new', estimate: 4 },
      ])
      .agree('f-old', 3)
      .life('f-old', 'accepted', h)
      .agree('f-new', 4)
      .life('f-new', 'implemented', h)
      .supersede('f-new', 'f-old')
      .all();
    expect(computeFeatureRollup(events, 'root')).toEqual([
      { feature: 'f-new', evAbs: 4, evPercent: 1, budget: 4, leafCount: 1, completedLeafCount: 1 },
    ]);
  });

  it('cancelled leaves drop out of the slice entirely (R-C2)', () => {
    const events = twoFeatureLog().life('b', 'cancelled', h).all();
    const rows = computeFeatureRollup(events, 'root');
    const f1 = rows.find((r) => r.feature === 'f1');
    expect(f1).toEqual({
      feature: 'f1',
      evAbs: 2,
      evPercent: 1, // denominator shrank to a's estimate — b is out of the basis
      budget: 2,
      leafCount: 1,
      completedLeafCount: 1,
    });
  });

  it('unagreed-completed work earns nothing but stays visible as a leaf (R-U8)', () => {
    const events = new Log()
      .decompose('root', [{ node: 'f1' }])
      .decompose('f1', [{ node: 'a', estimate: 2 }])
      .life('a', 'implemented', h) // completed but never agreed
      .all();
    expect(computeFeatureRollup(events, 'root')).toEqual([
      { feature: 'f1', evAbs: 0, evPercent: 0, budget: 0, leafCount: 1, completedLeafCount: 1 },
    ]);
  });

  it('an orphan leaf (chain never reaches root) becomes its own visible feature', () => {
    const events = new Log()
      .decompose('orph', [{ node: 'x', estimate: 1 }]) // 'orph' is never attached to root
      .agree('x', 1)
      .life('x', 'implemented', h)
      .all();
    expect(computeFeatureRollup(events, 'root')).toEqual([
      { feature: 'x', evAbs: 1, evPercent: 1, budget: 1, leafCount: 1, completedLeafCount: 1 },
    ]);
  });

  it('empty log → no rows (honest zero, never fabricated)', () => {
    expect(computeFeatureRollup([], 'root')).toEqual([]);
  });
});
