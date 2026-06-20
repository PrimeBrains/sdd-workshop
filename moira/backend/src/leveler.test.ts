import { describe, expect, it } from 'vitest';
import { defaultCapacityLookup } from './capacity-store.js';
import { computeEffectiveSet } from './derivations/effective-set.js';
import { fold } from './fold.js';
import { level } from './leveler.js';
import { agent, human, Log } from './test-utils.js';
import type { CapacityLookup } from './types.js';

function predict(log: Log, capacityOf: CapacityLookup, startDate: string) {
  const state = fold(log.all());
  const eff = computeEffectiveSet(state);
  return level(state, eff, capacityOf, startDate).predicted;
}

const alice = human('alice');

describe('P7 greedy c-leveling (MODEL:183-191)', () => {
  it('places a 3 MD task over 3 days at c=1.0', () => {
    const p = predict(
      new Log().decompose('F', [{ node: 'a', estimate: 3 }]).agree('a', 3).assign('a', alice),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(p.get('a')).toBe('2026-01-07'); // 05, 06, 07
  });

  it('stretches a 3 MD task over 6 days at c=0.5 (total unchanged, MODEL:33)', () => {
    const p = predict(
      new Log().decompose('F', [{ node: 'a', estimate: 3 }]).agree('a', 3).assign('a', alice),
      () => 0.5,
      '2026-01-05',
    );
    expect(p.get('a')).toBe('2026-01-10'); // 05..10
  });

  it('skips a c=0 day (calendar hole → schedule gap, MODEL:196)', () => {
    const capacityOf: CapacityLookup = (_h, d) => (d === '2026-01-06' ? 0 : 1.0);
    const p = predict(
      new Log().decompose('F', [{ node: 'a', estimate: 2 }]).agree('a', 2).assign('a', alice),
      capacityOf,
      '2026-01-05',
    );
    expect(p.get('a')).toBe('2026-01-07'); // 05 work, 06 skipped, 07 work
  });

  it('orders a dependent task after its predecessor', () => {
    const p = predict(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 2 }, { node: 'b', estimate: 2 }])
        .agree('a', 2)
        .agree('b', 2)
        .assign('a', alice)
        .assign('b', alice)
        .dep('a', 'b'),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(p.get('a')).toBe('2026-01-06');
    expect(p.get('b')).toBe('2026-01-08'); // starts the day after 'a' finishes
  });

  it('lets an agent lead time rate-limit a human successor (R-T2 MODEL:306)', () => {
    const p = predict(
      new Log()
        .decompose('F', [{ node: 'ag', estimate: 3 }, { node: 'h', estimate: 2 }])
        .agree('ag', 3)
        .agree('h', 2)
        .assign('ag', agent('bot'))
        .assign('h', alice)
        .dep('ag', 'h'),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(p.get('ag')).toBe('2026-01-07'); // agent not leveled, 3 calendar days
    expect(p.get('h')).toBe('2026-01-09'); // waits for the agent
  });

  it('serializes two tasks for the same human (resource leveling, MODEL:184)', () => {
    const p = predict(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 2 }, { node: 'b', estimate: 2 }])
        .agree('a', 2)
        .agree('b', 2)
        .assign('a', alice)
        .assign('b', alice),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(p.get('a')).toBe('2026-01-06');
    expect(p.get('b')).toBe('2026-01-08'); // cannot overlap 'a' on alice's days
  });
});
