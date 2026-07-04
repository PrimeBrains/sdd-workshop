// computeCriticalPath — the dependency longest chain (P7 MODEL:207, issue #16).
// Scope, durations, and tie-breaks mirror the leveler (schedulableLeaves /
// nominalDurationDays / ready-queue sort); supersede edges never connect a path
// and superseded nodes leave the basis (R-S5).

import { describe, expect, it } from 'vitest';
import { defaultCapacityLookup } from '../capacity-store.js';
import { fold } from '../fold.js';
import { level } from '../leveler.js';
import { agent, human, Log } from '../test-utils.js';
import { computeCriticalPath } from './critical-path.js';
import { computeEffectiveSet } from './effective-set.js';

const alice = human('alice');

/** decompose + agree + assign in one stroke (all leaves schedulable). */
function chainLog(nodes: Array<{ id: string; est: number; actor?: ReturnType<typeof human> }>): Log {
  const log = new Log().decompose(
    'F',
    nodes.map((n) => ({ node: n.id, estimate: n.est })),
  );
  for (const n of nodes) log.agree(n.id, n.est).assign(n.id, n.actor ?? alice);
  return log;
}

describe('computeCriticalPath (P7 dependency longest chain)', () => {
  it('follows a simple chain and sums nominal days', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 3 },
      { id: 'c', est: 1 },
    ])
      .dep('a', 'b')
      .dep('b', 'c');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a', 'b', 'c'], lengthDays: 6 });
  });

  it('picks the longer branch', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 2 },
      { id: 'c', est: 5 },
    ])
      .dep('a', 'b')
      .dep('a', 'c');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a', 'c'], lengthDays: 7 });
  });

  it('breaks branch ties deterministically by nodeId asc (the leveler rule)', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 3 },
      { id: 'c', est: 3 },
    ])
      .dep('a', 'b')
      .dep('a', 'c');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a', 'b'], lengthDays: 5 });
  });

  it('breaks head ties (two equal chains) by nodeId asc', () => {
    const log = chainLog([
      { id: 'x', est: 3 },
      { id: 'y', est: 3 },
    ]);
    expect(computeCriticalPath(log.all())).toEqual({ path: ['x'], lengthDays: 3 });
  });

  it('includes a trailing agent lead time unconditionally (PR-CRITPATH-AGENT)', () => {
    const log = chainLog([
      { id: 'h', est: 2 },
      { id: 'z', est: 3, actor: agent('bot') },
    ]).dep('h', 'z');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['h', 'z'], lengthDays: 5 });
  });

  it('ceils fractional estimates (nominal duration = max(1, ceil(est)))', () => {
    const log = chainLog([{ id: 'a', est: 2.5 }]);
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a'], lengthDays: 3 });
  });

  it('with no dependency edges, the longest single node is the chain', () => {
    const log = chainLog([
      { id: 'a', est: 1 },
      { id: 'b', est: 4 },
      { id: 'c', est: 2 },
    ]);
    expect(computeCriticalPath(log.all())).toEqual({ path: ['b'], lengthDays: 4 });
  });

  it('returns the empty path when nothing is schedulable', () => {
    const log = new Log().decompose('F', [{ node: 'a', estimate: 3 }]); // unagreed, unassigned
    expect(computeCriticalPath(log.all())).toEqual({ path: [], lengthDays: 0 });
  });

  it('excludes unagreed / unassigned leaves (leveler scope)', () => {
    const log = new Log()
      .decompose('F', [
        { node: 'a', estimate: 2 },
        { node: 'b', estimate: 9 },
      ])
      .agree('a', 2)
      .assign('a', alice)
      // b: estimated but never agreed/assigned → not schedulable
      .dep('a', 'b');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a'], lengthDays: 2 });
  });

  it('excludes cancelled leaves (R-C2 active basis)', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 9 },
    ])
      .dep('a', 'b')
      .life('b', 'cancelled');
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a'], lengthDays: 2 });
  });

  it('supersede removes the old node from the chain and never connects a path (R-S5)', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 5 },
      { id: 's', est: 1 },
    ])
      .dep('a', 'b')
      .supersede('s', 'b');
    // b superseded → leaves the basis; the supersede edge s→b adds no chain.
    expect(computeCriticalPath(log.all())).toEqual({ path: ['a'], lengthDays: 2 });
  });

  it('is deterministic and never mutates its input', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 3 },
    ]).dep('a', 'b');
    const events = log.all();
    const snapshot = JSON.stringify(events);
    const first = computeCriticalPath(events);
    const second = computeCriticalPath(events);
    expect(second).toEqual(first);
    expect(JSON.stringify(events)).toBe(snapshot);
  });

  it('lower-bounds the leveler: the chain tail completes no earlier than start + lengthDays - 1', () => {
    const log = chainLog([
      { id: 'a', est: 2 },
      { id: 'b', est: 3, actor: agent('bot') },
      { id: 'c', est: 1 },
    ])
      .dep('a', 'b')
      .dep('b', 'c');
    const cpResult = computeCriticalPath(log.all());
    const state = fold(log.all());
    const eff = computeEffectiveSet(state);
    const predicted = level(state, eff, defaultCapacityLookup, '2026-01-05').predicted;
    const tail = cpResult.path[cpResult.path.length - 1]!;
    // 2026-01-05 + (6 - 1) days = 2026-01-10
    expect(cpResult.lengthDays).toBe(6);
    expect(predicted.get(tail)! >= '2026-01-10').toBe(true);
  });
});
