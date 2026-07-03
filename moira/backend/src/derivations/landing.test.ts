// computeLandingCurve — exactness tests. Events are built with REAL epoch-ms
// timestamps (the Log test-util's ts=1,2,3… all land on 1970-01-01, useless for
// a calendar-time derivation), so each event is pinned to a UTC day explicitly.

import { describe, expect, it } from 'vitest';
import type { Actor, Event, IsoDate } from '../types.js';
import { computeLandingCurve, type LandingCurve } from './landing.js';

const h1: Actor = { kind: 'human', id: 'h1' };
const h2: Actor = { kind: 'human', id: 'h2' };
const ai: Actor = { kind: 'agent', id: 'ai' };

function builder() {
  let seq = 0;
  const stamp = (iso: IsoDate, time = '12:00:00.000'): { id: string; ts: number } => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: Date.parse(`${iso}T${time}Z`) };
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
    schedule(iso: IsoDate, node: string, assignee: Actor, frozenSlot: IsoDate) {
      events.push({
        kind: 'transition', ...stamp(iso), actor: assignee, node,
        machine: 'lifecycle', to: 'ready', assignee, frozenSlot,
      });
    },
    life(iso: IsoDate, node: string, to: 'implementing' | 'implemented' | 'accepted', time?: string) {
      events.push({
        kind: 'transition', ...(time === undefined ? stamp(iso) : stamp(iso, time)),
        actor: h1, node, machine: 'lifecycle', to,
      });
    },
  };
}

const point = (curve: LandingCurve, date: IsoDate) => {
  const p = curve.points.find((x) => x.date === date);
  expect(p, `point ${date} exists`).toBeDefined();
  return p!;
};

describe('computeLandingCurve', () => {
  it('(a) empty log → zero curve, landed, single asOf point', () => {
    const curve = computeLandingCurve([], { asOf: '2026-07-03' });
    expect(curve.bac).toBe(0);
    expect(curve.landed).toBe(true);
    expect(curve.landingDate).toBeNull(); // no incomplete region → no D_pred
    expect(curve.unforecastedLeaves).toEqual([]);
    expect(curve.forecastCoverage).toBe(1);
    expect(curve.points).toEqual([{ date: '2026-07-03', pv: 0, ev: 0, forecast: 0 }]);
  });

  it('(b) all complete → ev steps on transition days, pv on slots, forecast flat at bac', () => {
    const b = builder();
    b.decompose('2026-07-01', 'p', [{ node: 'a', estimate: 1 }, { node: 'b', estimate: 2 }]);
    b.agree('2026-07-01', 'a', 1);
    b.agree('2026-07-01', 'b', 2);
    b.schedule('2026-07-01', 'a', h1, '2026-07-02');
    b.schedule('2026-07-01', 'b', h2, '2026-07-04');
    b.life('2026-07-02', 'a', 'implemented');
    b.life('2026-07-03', 'b', 'implemented');
    const curve = computeLandingCurve(b.events, { asOf: '2026-07-04', from: '2026-07-01' });

    expect(curve.bac).toBe(3);
    expect(curve.landed).toBe(true);
    // ev: 0 on 07-01, +1 on 07-02 (a done), +2 on 07-03 (b done)
    expect(point(curve, '2026-07-01').ev).toBe(0);
    expect(point(curve, '2026-07-02').ev).toBe(1);
    expect(point(curve, '2026-07-03').ev).toBe(3);
    // pv: slots at 07-02 (1) and 07-04 (2)
    expect(point(curve, '2026-07-01').pv).toBe(0);
    expect(point(curve, '2026-07-02').pv).toBe(1);
    expect(point(curve, '2026-07-03').pv).toBe(1);
    expect(point(curve, '2026-07-04').pv).toBe(3);
    // forecast: flat at bac from asOf (nothing incomplete accrues)
    expect(point(curve, '2026-07-04').forecast).toBe(3);
    // seam: ev and forecast both present at asOf
    expect(point(curve, '2026-07-04').ev).toBe(3);
  });

  it('(c) mid-flight → forecast accrues at predicted completion; landingDate = D_pred', () => {
    const b = builder();
    b.decompose('2026-07-01', 'p', [{ node: 'a', estimate: 1 }, { node: 'b', estimate: 3 }]);
    b.agree('2026-07-01', 'a', 1);
    b.agree('2026-07-01', 'b', 3);
    b.schedule('2026-07-01', 'a', h1, '2026-07-02');
    b.schedule('2026-07-01', 'b', h2, '2026-07-05');
    b.life('2026-07-02', 'a', 'implemented');
    const curve = computeLandingCurve(b.events, { asOf: '2026-07-03' });

    expect(curve.bac).toBe(4);
    expect(curve.landed).toBe(false);
    // leveler: startDate = earliest slot 07-02; b (h2, est 3) fills 07-02..07-04.
    expect(curve.landingDate).toBe('2026-07-04');
    expect(curve.unforecastedLeaves).toEqual([]);
    expect(curve.forecastCoverage).toBe(1);
    // window: from = min(earliest slot, asOf) = 07-02; to = max(asOf, latest slot 07-05, landing) = 07-05.
    expect(curve.points[0]!.date).toBe('2026-07-02');
    expect(curve.points[curve.points.length - 1]!.date).toBe('2026-07-05');
    // ev past: 1 from 07-02 (a done); no ev after asOf.
    expect(point(curve, '2026-07-02').ev).toBe(1);
    expect(point(curve, '2026-07-03').ev).toBe(1);
    expect(point(curve, '2026-07-04').ev).toBeNull();
    // forecast: at asOf = ev(asOf) = 1; jumps to 4 on 07-04 (b predicted); none before asOf.
    expect(point(curve, '2026-07-02').forecast).toBeNull();
    expect(point(curve, '2026-07-03').forecast).toBe(1);
    expect(point(curve, '2026-07-04').forecast).toBe(4);
    expect(point(curve, '2026-07-05').forecast).toBe(4);
  });

  it('(d) unforecastable leaves are excluded, surfaced, and de-rate coverage — never potted', () => {
    const b = builder();
    b.decompose('2026-07-01', 'p', [
      { node: 'a', estimate: 1 },
      { node: 'b', estimate: 2 },
      { node: 'c', estimate: 5 },
    ]);
    b.agree('2026-07-01', 'a', 1);
    b.agree('2026-07-01', 'b', 2);
    b.agree('2026-07-01', 'c', 5);
    b.schedule('2026-07-01', 'a', h1, '2026-07-02');
    b.schedule('2026-07-01', 'b', h2, '2026-07-04');
    // c: agreed but never assigned → leveler predicts null → unforecastable
    b.life('2026-07-02', 'a', 'implemented');
    const curve = computeLandingCurve(b.events, { asOf: '2026-07-03' });

    expect(curve.bac).toBe(8);
    expect(curve.landed).toBe(false);
    expect(curve.unforecastedLeaves).toEqual(['c']);
    expect(curve.forecastCoverage).toBe(0.5); // b forecastable, c not
    // landingDate still exists (D_pred over the forecastable region) — read de-rated.
    expect(curve.landingDate).not.toBeNull();
    // forecast honestly tops out at ev + b's budget (3), below bac (8).
    const last = curve.points[curve.points.length - 1]!;
    expect(last.forecast).toBe(3);
    expect(last.forecast!).toBeLessThan(curve.bac);
  });

  it('(e) deterministic: same input twice → deep-equal result', () => {
    const b = builder();
    b.decompose('2026-07-01', 'p', [{ node: 'a', estimate: 2 }]);
    b.agree('2026-07-01', 'a', 2);
    b.schedule('2026-07-01', 'a', h1, '2026-07-03');
    b.life('2026-07-02', 'a', 'implementing');
    const one = computeLandingCurve(b.events, { asOf: '2026-07-02' });
    const two = computeLandingCurve(b.events, { asOf: '2026-07-02' });
    expect(two).toEqual(one);
  });

  it('(f) day boundary: an event at 23:59:59.999Z lands on that day; 00:00:00.000Z on the next', () => {
    const b = builder();
    b.decompose('2026-07-01', 'p', [{ node: 'a', estimate: 1 }, { node: 'b', estimate: 1 }]);
    b.agree('2026-07-01', 'a', 1);
    b.agree('2026-07-01', 'b', 1);
    b.life('2026-07-02', 'a', 'implemented', '23:59:59.999');
    b.life('2026-07-03', 'b', 'implemented', '00:00:00.000');
    const curve = computeLandingCurve(b.events, { asOf: '2026-07-04', from: '2026-07-01' });

    expect(point(curve, '2026-07-02').ev).toBe(1); // a included on 07-02…
    expect(point(curve, '2026-07-01').ev).toBe(0); // …not earlier
    expect(point(curve, '2026-07-03').ev).toBe(2); // b lands on 07-03, not 07-02
  });

  it('does not mutate the input event array', () => {
    const b = builder();
    b.decompose('2026-07-02', 'p', [{ node: 'a', estimate: 1 }]);
    b.decompose('2026-07-01', 'q', [{ node: 'z', estimate: 1 }]); // out of order on purpose
    const snapshot = JSON.parse(JSON.stringify(b.events)) as Event[];
    computeLandingCurve(b.events, { asOf: '2026-07-03' });
    expect(b.events).toEqual(snapshot);
  });
});
