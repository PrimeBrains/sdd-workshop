// buildReport / formatReportText — the morning digest (issue #25). Events carry
// REAL epoch-ms timestamps (the seqStamper/Log ts=1,2,3… all land on 1970-01-01,
// useless for as-of prefix cuts), so each event is pinned to a UTC day — the
// same deviation landing.test.ts documents.

import { describe, expect, it } from 'vitest';
import type { Actor, Event, IsoDate } from 'moira-backend';
import { buildReport, formatReportText } from './report.js';

const h1: Actor = { kind: 'human', id: 'h1' };
const ai: Actor = { kind: 'agent', id: 'ai' };

function builder() {
  let seq = 0;
  const stamp = (iso: IsoDate): { id: string; ts: number } => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: Date.parse(`${iso}T12:00:00.000Z`) };
  };
  const events: Event[] = [];
  return {
    events,
    decompose(iso: IsoDate, parent: string, children: Array<{ node: string; estimate?: number }>) {
      events.push({ kind: 'decompose', ...stamp(iso), actor: ai, parent, reason: 'r', children });
    },
    agree(iso: IsoDate, node: string, frozenBudget: number) {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node,
        machine: 'estimate-agreement', to: 'agreed', frozenBudget,
      });
    },
    schedule(iso: IsoDate, node: string, frozenSlot: IsoDate) {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node,
        machine: 'lifecycle', to: 'ready', assignee: h1, frozenSlot,
      });
    },
    life(iso: IsoDate, node: string, to: 'implementing' | 'implemented' | 'accepted') {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node, machine: 'lifecycle', to,
      });
    },
    cost(iso: IsoDate, node: string, amount: number) {
      events.push({ kind: 'cost', ...stamp(iso), actor: h1, node, amount });
    },
  };
}

/**
 * A one-week mini project (all dates are July 2026 weekdays):
 *   07-01(Wed) root→{f1→a(2),b(3); f2→c(5)}, all agreed, a/b/c scheduled
 *   07-02(Thu) a implemented, cost(a)=2
 *   07-03(Fri) a accepted
 *   07-06(Mon) c implemented, cost(c)=4
 * asOf=07-06, prev=07-03 (the preceding business day).
 */
function weekLog(): Event[] {
  const b = builder();
  b.decompose('2026-07-01', 'root', [{ node: 'f1' }, { node: 'f2' }]);
  b.decompose('2026-07-01', 'f1', [
    { node: 'a', estimate: 2 },
    { node: 'b', estimate: 3 },
  ]);
  b.decompose('2026-07-01', 'f2', [{ node: 'c', estimate: 5 }]);
  b.agree('2026-07-01', 'a', 2);
  b.agree('2026-07-01', 'b', 3);
  b.agree('2026-07-01', 'c', 5);
  b.schedule('2026-07-01', 'a', '2026-07-02');
  b.schedule('2026-07-01', 'b', '2026-07-08');
  b.schedule('2026-07-01', 'c', '2026-07-06');
  b.life('2026-07-02', 'a', 'implemented');
  b.cost('2026-07-02', 'a', 2);
  b.life('2026-07-03', 'a', 'accepted');
  b.life('2026-07-06', 'c', 'implemented');
  b.cost('2026-07-06', 'c', 4);
  return b.events;
}

const OPTS = {
  asOf: '2026-07-06' as IsoDate,
  prev: '2026-07-03' as IsoDate,
  seriesDays: ['2026-07-02', '2026-07-03', '2026-07-06'] as IsoDate[],
  projectRoot: 'root',
  startDate: '2026-07-01' as IsoDate,
  dates: { deadline: '2026-07-10', targetDate: '2026-07-08' },
};

describe('buildReport', () => {
  const r = buildReport(weekLog(), OPTS);

  it('now/prev are as-of prefix derivations of the SAME log (TE03, no snapshot)', () => {
    // now: a(2) accepted + c(5) implemented = 7; prev cut (≤07-03): only a = 2
    expect(r.now.evAbs).toBe(7);
    expect(r.prevMetrics.evAbs).toBe(2);
    expect(r.delta.evAbs).toBe(5);
    expect(r.now.ac).toBe(6);
    expect(r.prevMetrics.ac).toBe(2);
    expect(r.delta.ac).toBe(4);
    expect(r.now.evPercent).toBeCloseTo(7 / 10, 6);
    expect(r.prevMetrics.evPercent).toBeCloseTo(2 / 10, 6);
  });

  it('activity window is (prev, asOf] — exactly the Monday events', () => {
    expect(r.activity).toHaveLength(2); // c implemented + cost(c)
    expect(r.activity.map((a) => a.node)).toEqual(['c', 'c']);
    expect(r.activity[0]!.label).toBe('作成完了（レビュー待ち）');
  });

  it('features carry the engine EV per root-child slice with deltas', () => {
    expect(r.features).toEqual([
      {
        feature: 'f1', evAbs: 2, prevEvAbs: 2, deltaEvAbs: 0,
        evPercent: 2 / 5, budget: 5, leafCount: 2, completedLeafCount: 1,
      },
      {
        feature: 'f2', evAbs: 5, prevEvAbs: 0, deltaEvAbs: 5,
        evPercent: 1, budget: 5, leafCount: 1, completedLeafCount: 1,
      },
    ]);
  });

  it('queues read the asOf state (c waits for human review, b for work)', () => {
    expect(r.queues.humanReview).toEqual(['c']);
  });

  it('landing is the canonical D_pred (computeLandingCurve) vs the reference dates', () => {
    // b (3 MD) is the only incomplete leaf; the leveler fills h1 with c(07-01..05)
    // first, then b lands 07-06..08 → D_pred 2026-07-08.
    expect(r.landing.landed).toBe(false);
    expect(r.landing.landingDate).toBe('2026-07-08');
    expect(r.landing.forecastCoverage).toBe(1);
    expect(r.landing.unforecastedCount).toBe(0);
    expect(r.landing.deadline).toBe('2026-07-10');
    expect(r.landing.daysLate).toBe(-2); // two days of slack — observation, not judgement
  });

  it('series walks the as-of points in ascending order', () => {
    expect(r.series.map((m) => m.date)).toEqual(['2026-07-02', '2026-07-03', '2026-07-06']);
    expect(r.series.map((m) => m.evAbs)).toEqual([2, 2, 7]);
  });

  it('empty log → honest zeros, never fabricated', () => {
    const empty = buildReport([], { ...OPTS, dates: {} });
    expect(empty.now.evAbs).toBe(0);
    expect(empty.features).toEqual([]);
    expect(empty.activity).toEqual([]);
    expect(empty.landing.landed).toBe(true);
    expect(empty.landing.landingDate).toBeNull();
    expect(empty.landing.deadline).toBeNull();
    expect(empty.landing.daysLate).toBeNull();
    expect(empty.structuralErrors).toEqual([]);
  });
});

describe('formatReportText', () => {
  const r = buildReport(weekLog(), OPTS);
  const text = formatReportText(r, (id) => id, 'demo');

  it('keeps SPI/EV% welded to their coverage on the same line (R-S4/R-S6)', () => {
    const evLine = text.split('\n').find((l) => l.includes('EV% '));
    expect(evLine).toContain('estimate coverage');
    const spiLine = text.split('\n').find((l) => l.includes('SPI '));
    expect(spiLine).toContain('schedule coverage');
  });

  it('renders the delta, queue, feature table and trend table sections', () => {
    expect(text).toContain('## 前回比 Δ（2026-07-03 → 2026-07-06）');
    expect(text).toContain('ΔEV_abs +5');
    expect(text).toContain('レビュー待ち（人間ゲート）: [c]');
    expect(text).toContain('| feature | ΔEV_abs | EV_abs | EV% | 完了葉/葉 |');
    expect(text).toContain('| 日付 | EV_abs | EV% | 見積cov | SPI | sched cov | CPI |');
    expect(text).toContain('着地予測（P7 生きた予測・D_pred）: 2026-07-08 | forecast coverage 100%');
    expect(text).toContain('期日まで余裕: 2 日');
  });
});
