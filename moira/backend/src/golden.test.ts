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
    expect(d.estimateCoverage).toBeCloseTo(5 / 6, 10); // ≈ 0.8333
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
    expect(d.forecast).toEqual([
      { node: 'design-F', predictedCompletion: '2026-01-14', frozenSlot: '2026-01-13' },
      { node: 'impl-1', predictedCompletion: '2026-01-22', frozenSlot: '2026-01-27' },
      { node: 'impl-2', predictedCompletion: '2026-01-28', frozenSlot: '2026-01-31' },
      { node: 'req-F', predictedCompletion: '2026-01-08', frozenSlot: '2026-01-05' },
      { node: 'tasks-F', predictedCompletion: '2026-01-16', frozenSlot: '2026-01-15' },
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
