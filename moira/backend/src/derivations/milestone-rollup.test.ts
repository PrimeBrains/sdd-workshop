// computeMilestoneRollup (issue #35). A milestone is a name + node-id bundle
// only (no date/buffer input — MODEL §7#12). The forecast (predictedCompletion
// per leaf) is handed in directly as a fabricated ForecastRow[] rather than
// derived via a real leveler run: that keeps these tests independent of
// leveler.ts's own scheduling arithmetic (covered by leveler.test.ts) and lets
// us assert computeMilestoneRollup's OWN aggregation logic precisely.

import { describe, expect, it } from 'vitest';
import type { ForecastRow } from '../types.js';
import { human, Log } from '../test-utils.js';
import { computeMilestoneRollup, type MilestoneDefinition } from './milestone-rollup.js';

const h = human('h1');
const asOf = '2026-01-09';

/**
 * root → { f1 → a(est 2, slot 01-10), b(est 3, slot 01-12) ;
 *          f2 → c(est 5, slot 01-08) }
 * a is agreed+implemented (completed); b, c agreed but not completed.
 * A cost of 1 lands on 'a' so AC/CPI have a non-trivial denominator.
 */
function twoMilestoneLog(): Log {
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
    .schedule('a', h, '2026-01-10')
    .schedule('b', h, '2026-01-12')
    .schedule('c', h, '2026-01-08')
    .cost('a', 1)
    .life('a', 'implemented', h);
}

const fc = (rows: Array<[string, string | null]>): ForecastRow[] =>
  rows.map(([node, predictedCompletion]) => ({
    node,
    predictedCompletion,
    predictedStart: null,
    frozenSlot: null,
  }));

describe('computeMilestoneRollup', () => {
  it('computes subset EVM (evAbs/evPercent/pv/ac/bac/spi/cpi) per milestone, never leaking outside its bundle', () => {
    const events = twoMilestoneLog().all();
    const milestones: MilestoneDefinition[] = [
      { name: 'M1', nodes: ['f1'] },
      { name: 'M2', nodes: ['f2'] },
    ];
    const forecast = fc([
      ['a', '2026-01-06'],
      ['b', '2026-01-07'],
      ['c', '2026-01-09'],
    ]);
    const rows = computeMilestoneRollup(events, milestones, forecast, { asOf });

    const m1 = rows.find((r) => r.milestone === 'M1')!;
    expect(m1.leafCount).toBe(2); // a, b — c must NOT leak in (束外ノードの非混入)
    expect(m1.evAbs).toBe(2); // only 'a' completed, frozenBudget=2
    expect(m1.evPercent).toBeCloseTo(2 / 5); // (a+b agreed latest estimate)
    expect(m1.pv).toBe(0); // both slots (01-10, 01-12) are AFTER asOf (01-09)
    expect(m1.ac).toBe(1); // f1's byNode AC = a.ownCost(1) + b.ownCost(0)
    expect(m1.bac).toBe(5); // a(2)+b(3), agreed regardless of completion
    expect(m1.spi).toBeNull(); // pv=0
    expect(m1.cpi).toBe(2); // evAbs(2)/ac(1)
    expect(m1.plannedEnd).toBe('2026-01-12'); // max(a slot, b slot)
    expect(m1.forecastEnd).toBe('2026-01-07'); // max(a pred, b pred)
    expect(m1.bottleneckLeaf).toBe('b');

    const m2 = rows.find((r) => r.milestone === 'M2')!;
    expect(m2.leafCount).toBe(1); // c only — a/b must NOT leak in
    expect(m2.evAbs).toBe(0); // c not completed
    expect(m2.evPercent).toBe(0);
    expect(m2.pv).toBe(5); // c's slot (01-08) is on/before asOf (01-09), agreed
    expect(m2.ac).toBe(0);
    expect(m2.bac).toBe(5);
    expect(m2.cpi).toBeNull(); // ac=0
    expect(m2.plannedEnd).toBe('2026-01-08');
    expect(m2.forecastEnd).toBe('2026-01-09');
    expect(m2.bottleneckLeaf).toBe('c');
  });

  it('rows are sorted by milestone name; a milestone spanning both features unions their leaves', () => {
    const events = twoMilestoneLog().all();
    const milestones: MilestoneDefinition[] = [
      { name: 'zeta', nodes: ['f2'] },
      { name: 'alpha', nodes: ['f1', 'f2'] },
    ];
    const forecast = fc([
      ['a', '2026-01-06'],
      ['b', '2026-01-07'],
      ['c', '2026-01-09'],
    ]);
    const rows = computeMilestoneRollup(events, milestones, forecast, { asOf });
    expect(rows.map((r) => r.milestone)).toEqual(['alpha', 'zeta']); // sorted
    const alpha = rows[0]!;
    expect(alpha.leafCount).toBe(3);
    expect(alpha.evAbs).toBe(2);
    expect(alpha.bac).toBe(10);
    expect(alpha.forecastEnd).toBe('2026-01-09');
    expect(alpha.bottleneckLeaf).toBe('c');
  });

  it('an anchor id shadowed by an ancestor in the SAME milestone is dropped (no AC double-count)', () => {
    const events = twoMilestoneLog().all();
    const withDup = computeMilestoneRollup(
      events,
      [{ name: 'M', nodes: ['f1', 'a'] }], // 'a' is a child of 'f1' — redundant anchor
      fc([['a', '2026-01-06'], ['b', '2026-01-07']]),
      { asOf },
    )[0]!;
    const bare = computeMilestoneRollup(
      events,
      [{ name: 'M', nodes: ['f1'] }],
      fc([['a', '2026-01-06'], ['b', '2026-01-07']]),
      { asOf },
    )[0]!;
    expect(withDup.ac).toBe(bare.ac);
    expect(withDup.leafCount).toBe(bare.leafCount);
    expect(withDup.evAbs).toBe(bare.evAbs);
  });

  it('an empty-nodes milestone ("解散") is an honest all-zero/null row, never an error', () => {
    const events = twoMilestoneLog().all();
    const row = computeMilestoneRollup(events, [{ name: 'gone', nodes: [] }], [], { asOf })[0]!;
    expect(row).toEqual({
      milestone: 'gone',
      evAbs: 0,
      evPercent: 0,
      pv: 0,
      ac: 0,
      bac: 0,
      spi: null,
      cpi: null,
      leafCount: 0,
      plannedEnd: null,
      forecastEnd: null,
      bottleneckLeaf: null,
      bottleneckOnCriticalPath: false,
    });
  });

  it('an unknown node id is silently ignored (no crash, no phantom leaves)', () => {
    const events = twoMilestoneLog().all();
    const row = computeMilestoneRollup(
      events,
      [{ name: 'M', nodes: ['does-not-exist'] }],
      [],
      { asOf },
    )[0]!;
    expect(row.leafCount).toBe(0);
    expect(row.evAbs).toBe(0);
  });

  it('identifies the pacing leaf and flags whether it sits on the dependency critical path', () => {
    const events = new Log()
      .decompose('root', [{ node: 'f1' }])
      .decompose('f1', [
        { node: 'a', estimate: 2 },
        { node: 'b', estimate: 3 },
        { node: 'c', estimate: 1 }, // unrelated to the a→b chain
      ])
      .agree('a', 2)
      .agree('b', 3)
      .agree('c', 1)
      .dep('a', 'b') // a precedes b — critical path is [a, b] (cp: a=5, b=3)
      .schedule('a', h, '2026-01-05')
      .schedule('b', h, '2026-01-06')
      .schedule('c', h, '2026-01-07')
      .all();

    // Case 1: the milestone's latest predictedCompletion belongs to 'b' — ON the critical path.
    const onPath = computeMilestoneRollup(
      events,
      [{ name: 'M', nodes: ['f1'] }],
      fc([
        ['a', '2026-01-10'],
        ['b', '2026-01-15'],
        ['c', '2026-01-12'],
      ]),
      { asOf: '2026-01-01' },
    )[0]!;
    expect(onPath.bottleneckLeaf).toBe('b');
    expect(onPath.bottleneckOnCriticalPath).toBe(true);

    // Case 2: the milestone's latest predictedCompletion belongs to 'c' — a leaf
    // OUTSIDE the a→b dependency chain, so it is NOT on the critical path even
    // though it paces this milestone's forecast end.
    const offPath = computeMilestoneRollup(
      events,
      [{ name: 'M', nodes: ['f1'] }],
      fc([
        ['a', '2026-01-10'],
        ['b', '2026-01-15'],
        ['c', '2026-01-20'],
      ]),
      { asOf: '2026-01-01' },
    )[0]!;
    expect(offPath.bottleneckLeaf).toBe('c');
    expect(offPath.bottleneckOnCriticalPath).toBe(false);
  });

  it('excludes COMPLETED leaves from forecastEnd/bottleneck — a phantom leveler prediction on finished work must not pace the milestone (landing.ts-isomorphic)', () => {
    const events = twoMilestoneLog().all(); // 'a' is agreed+implemented (completed); 'b' is not
    const forecast = fc([
      ['a', '2026-01-30'], // completed leaf, but the leveler STILL assigned it a date
      ['b', '2026-01-07'],
    ]);
    const row = computeMilestoneRollup(events, [{ name: 'M1', nodes: ['f1'] }], forecast, {
      asOf,
    })[0]!;
    // If 'a' were allowed to compete, forecastEnd would be 2026-01-30 / bottleneck 'a'.
    expect(row.forecastEnd).toBe('2026-01-07');
    expect(row.bottleneckLeaf).toBe('b');
  });

  it('when EVERY leaf in the slice is completed, forecastEnd/bottleneck are null (nothing incomplete to pace it)', () => {
    const events = new Log()
      .decompose('root', [{ node: 'f1' }])
      .decompose('f1', [{ node: 'a', estimate: 2 }])
      .agree('a', 2)
      .life('a', 'implemented', h)
      .life('a', 'accepted', h)
      .all();
    const row = computeMilestoneRollup(
      events,
      [{ name: 'M1', nodes: ['f1'] }],
      fc([['a', '2026-01-30']]), // phantom — must be ignored entirely
      { asOf },
    )[0]!;
    expect(row.forecastEnd).toBeNull();
    expect(row.bottleneckLeaf).toBeNull();
    expect(row.evAbs).toBe(2); // EV itself is unaffected by the forecast exclusion
  });

  it('empty log with no milestones → empty rows (honest zero)', () => {
    expect(computeMilestoneRollup([], [], [], { asOf })).toEqual([]);
  });
});
