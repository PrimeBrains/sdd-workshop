import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { Log } from '../test-utils.js';
import { computeEffectiveSet } from './effective-set.js';

describe('currently-effective set (R-S5 MODEL:292)', () => {
  it('excludes a superseded leaf', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'old' }, { node: 'new' }])
        .supersede('new', 'old')
        .all(),
    );
    const eff = computeEffectiveSet(state);
    expect(eff.superseded.has('old')).toBe(true);
    expect(eff.effectiveLeaves).toEqual(['new']);
  });

  it('restores the old node when the superseding node is cancelled (R-S5 rule)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'old' }, { node: 'new' }])
        .supersede('new', 'old')
        .life('new', 'cancelled') // superseding node cancelled → edge inert
        .all(),
    );
    const eff = computeEffectiveSet(state);
    expect(eff.superseded.has('old')).toBe(false);
    expect(eff.effectiveLeaves).toEqual(['old']); // 'new' cancelled → excluded
  });

  it('excludes cancelled nodes from the effective set (R-C2 MODEL:323)', () => {
    const state = fold(
      new Log().decompose('F', [{ node: 'a' }, { node: 'b' }]).life('a', 'cancelled').all(),
    );
    const eff = computeEffectiveSet(state);
    expect(eff.effectiveLeaves).toEqual(['b']);
  });
});
