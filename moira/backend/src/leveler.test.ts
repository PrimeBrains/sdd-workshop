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

function levelResult(log: Log, capacityOf: CapacityLookup, startDate: string) {
  const state = fold(log.all());
  const eff = computeEffectiveSet(state);
  return level(state, eff, capacityOf, startDate);
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

describe('predictedStart (issue #34c — first-worked-day, not the raw dependency start)', () => {
  it('skips a c=0 day AT the dependency-derived start: predictedStart is the first day capacity was actually consumed', () => {
    // start (dependency-derived) == 2026-01-05, but that day is a calendar hole
    // (c=0). Publishing `start` as-is would be dishonest (MODEL:196 — a
    // calendar hole is a schedule GAP, work does not begin there).
    const capacityOf: CapacityLookup = (_h, d) => (d === '2026-01-05' ? 0 : 1.0);
    const r = levelResult(
      new Log().decompose('F', [{ node: 'a', estimate: 2 }]).agree('a', 2).assign('a', alice),
      capacityOf,
      '2026-01-05',
    );
    expect(r.predicted.get('a')).toBe('2026-01-07'); // 05 skipped (hole), 06+07 worked
    expect(r.predictedStart.get('a')).toBe('2026-01-06'); // NOT 2026-01-05
  });

  it('skips days another task already saturated (same mechanism, no calendar hole needed)', () => {
    // Two tasks on the same human with the same dependency-derived start: the
    // greedy fill processes 'a' first (consumes 01-05..01-06 fully), so 'b's
    // loop must skip those two already-used days before it can start.
    const r = levelResult(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 2 }, { node: 'b', estimate: 2 }])
        .agree('a', 2)
        .agree('b', 2)
        .assign('a', alice)
        .assign('b', alice),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(r.predicted.get('a')).toBe('2026-01-06');
    expect(r.predictedStart.get('a')).toBe('2026-01-05'); // 'a' runs immediately, no skip
    expect(r.predicted.get('b')).toBe('2026-01-08');
    expect(r.predictedStart.get('b')).toBe('2026-01-07'); // NOT 2026-01-05 (already used by 'a')
  });

  it('agent tasks are not leveled: predictedStart equals the dependency-derived start', () => {
    const r = levelResult(
      new Log().decompose('F', [{ node: 'ag', estimate: 3 }]).agree('ag', 3).assign('ag', agent('bot')),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(r.predicted.get('ag')).toBe('2026-01-07');
    expect(r.predictedStart.get('ag')).toBe('2026-01-05');
  });

  it('a zero-estimate human task never consumes capacity — predictedStart equals start (documented spec: no first-worked-day exists)', () => {
    const r = levelResult(
      new Log().decompose('F', [{ node: 'a', estimate: 0 }]).agree('a', 0).assign('a', alice),
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(r.predicted.get('a')).toBe('2026-01-05');
    expect(r.predictedStart.get('a')).toBe('2026-01-05');
  });

  it('unscheduled (no assignee): predictedStart is null, symmetric with predicted', () => {
    const r = levelResult(
      new Log().decompose('F', [{ node: 'a', estimate: 2 }]).agree('a', 2), // never assigned
      defaultCapacityLookup,
      '2026-01-05',
    );
    expect(r.predicted.get('a')).toBeNull();
    expect(r.predictedStart.get('a')).toBeNull();
  });
});
