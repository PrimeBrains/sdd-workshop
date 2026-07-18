// Golden end-to-end test: the tiny-project fixture through derive(), asserting
// the entire DerivedState against hand-computed integers, plus the two S4
// pair-reads (validation-scenarios S4 line 31).

import { describe, expect, it } from 'vitest';
import { derive } from './derive.js';
import { TINY_AS_OF, tinyProjectEvents } from './fixtures/tiny-project.js';

describe('golden: tiny-project at asOf 2026-01-28', () => {
  const d = derive(tinyProjectEvents, { asOf: TINY_AS_OF });

  it('has no structural errors', () => {
    expect(d.structuralErrors).toEqual([]);
  });

  it('derives the EV pair (EV% ↔ estimate coverage)', () => {
    expect(d.evAbs).toBe(20);
    expect(d.cumulativeEvAbs).toBe(20);
    expect(d.evPercent).toBeCloseTo(20 / 26, 10); // ≈ 0.7692
    expect(d.estimateCoverage).toBeCloseTo(1, 10); // leaf-based (P2 v18): all 5 effective leaves agreed → 5/5

  });

  it('derives the schedule pair (SPI ↔ schedule coverage)', () => {
    expect(d.pv).toBe(20);
    expect(d.spi).toBeCloseTo(1.0, 10);
    expect(d.scheduleCoverage).toBeCloseTo(1.0, 10);
    expect(d.spiScheduleCoverage).toBe(d.scheduleCoverage);
  });

  it('derives AC and CPI', () => {
    expect(d.ac).toBe(25);
    expect(d.cpi).toBeCloseTo(20 / 25, 10); // 0.80
  });

  it('derives the effective leaf set', () => {
    expect(d.effectiveLeaves).toEqual(['design-F', 'impl-1', 'impl-2', 'req-F', 'tasks-F']);
  });

  it('derives the queues and unassigned backlog', () => {
    expect(d.humanReviewQueue).toEqual(['impl-1']);
    expect(d.agentWorkQueue).toEqual([]);
    expect(d.unassignedBacklog).toEqual([]);
  });

  it('derives the live forecast (distinct from frozen slots — PMB vs EAC, MODEL:203)', () => {
    // predictedStart (issue #34c): alice works req-F 01-05..08 then design-F
    // 01-09..14 back to back (no gap, no skip → predictedStart == dependency
    // start for both). bob's earliest-start for BOTH impl-1 and impl-2 is
    // 01-15 (the day after design-F's 01-14 completion, their only
    // predecessor) but the leveler processes impl-1 first (higher critical-
    // path rank: ceil(8) > ceil(6)) and fully consumes bob's 01-15..01-22
    // capacity; impl-2's greedy loop therefore SKIPS those 8 already-
    // saturated days and only starts consuming capacity on 01-23 — the
    // motivating skip case for predictedStart (dependency start 01-15 would
    // have been dishonest).
    expect(d.forecast).toEqual([
      {
        node: 'design-F',
        predictedCompletion: '2026-01-14',
        predictedStart: '2026-01-09',
        frozenSlot: '2026-01-13',
      },
      {
        node: 'impl-1',
        predictedCompletion: '2026-01-22',
        predictedStart: '2026-01-15',
        frozenSlot: '2026-01-27',
      },
      {
        node: 'impl-2',
        predictedCompletion: '2026-01-28',
        predictedStart: '2026-01-23',
        frozenSlot: '2026-01-31',
      },
      {
        node: 'req-F',
        predictedCompletion: '2026-01-08',
        predictedStart: '2026-01-05',
        frozenSlot: '2026-01-05',
      },
      {
        node: 'tasks-F',
        predictedCompletion: '2026-01-16',
        predictedStart: '2026-01-15',
        frozenSlot: '2026-01-15',
      },
    ]);
  });

  it('reports node states for every node', () => {
    const byNode = Object.fromEntries(d.nodeStates.map((r) => [r.node, r.lifecycle]));
    expect(byNode).toEqual({
      F: 'pending',
      'req-F': 'accepted',
      'design-F': 'accepted',
      'tasks-F': 'accepted',
      'impl-1': 'implemented',
      'impl-2': 'ready',
    });
  });
});
