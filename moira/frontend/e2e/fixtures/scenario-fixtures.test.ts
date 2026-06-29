// Fixture derive-golden — runs under VITEST (not Playwright), so it calls the REAL
// @backend derive() in-process via vite.config's resolver. This is the cheap
// "integration で先に潰す" gate: it proves each transcribed event log derives to the
// numbers its scenario unit states, BEFORE any browser spec asserts on them. A
// transcription error fails here instead of as a confusing DOM mismatch.
import { describe, it, expect } from 'vitest';
import { derive } from '../../src/moira/engine';
import { type MoiraFixture } from './types';
import {
  discovered,
  estimateProposed,
  estimateAgreed,
  reviewWorkDuring,
  reviewWorkAfter,
  requirementsBefore,
  requirementsDrafted,
  requirementsReturned,
  requirementsResubmitted1,
  requirementsReReturned,
  requirementsResubmitted2,
  requirementsAccepted,
  designCompleted,
  tasksCompleted,
  implEstimateAgreed,
  implCompleted,
} from './scenario-fixtures';

const run = (fx: MoiraFixture) => derive(fx.events, { asOf: fx.asOf, capacityOf: () => 1 });
const P = 6; // toBeCloseTo precision

describe('scenario fixtures derive to their unit Given/After numbers', () => {
  it('estimate-spec-proposed: P2 0%, EV% 0% (3 leaves, all proposed)', () => {
    const d = run(estimateProposed);
    expect(d.estimateCoverage).toBeCloseTo(0, P);
    expect(d.evPercent).toBeCloseTo(0, P);
    expect(d.evAbs).toBe(0);
  });

  it('estimate-spec-agreed After: P2 100% (3/3), EV% 0%', () => {
    const d = run(estimateAgreed);
    expect(d.estimateCoverage).toBeCloseTo(1, P);
    expect(d.evPercent).toBeCloseTo(0, P);
    expect(d.evAbs).toBe(0);
  });

  it('review-work-estimated During: P2 50% (3/6 — discovery signal)', () => {
    const d = run(reviewWorkDuring);
    expect(d.estimateCoverage).toBeCloseTo(0.5, P);
    expect(d.evPercent).toBeCloseTo(0, P);
  });

  it('review-work-estimated After: P2 100% (6/6)', () => {
    const d = run(reviewWorkAfter);
    expect(d.estimateCoverage).toBeCloseTo(1, P);
    expect(d.evPercent).toBeCloseTo(0, P);
  });

  it('requirements-spec-drafted Before/Given: EV% 0% (all agreed, none completed)', () => {
    const d = run(requirementsBefore);
    expect(d.evPercent).toBeCloseTo(0, P);
    expect(d.estimateCoverage).toBeCloseTo(1, P);
  });

  it('requirements-spec-drafted After: EV% 24% (3 / 12.5), EV_abs 3, P2 100%', () => {
    const d = run(requirementsDrafted);
    expect(d.evAbs).toBe(3);
    expect(d.evPercent).toBeCloseTo(0.24, P);
    expect(d.estimateCoverage).toBeCloseTo(1, P);
  });
});

// ── The through-line: the whole backbone arc, snapshot by snapshot. This is the
// EBT proof that the engine REALIZES flows/new-feature-happy-path.md — the EV%
// arc 0→24→8→32→80→100(apparent)→44→100(real) and the P2 100→75→100 honesty
// correction, each as the AFTER state of one composed unit.
describe('backbone through-line (new-feature-happy-path)', () => {
  // expected = { evAbs, evPercent, estimateCoverage (P2), executionCoverage (R-S8) }
  const cases: Array<{ name: string; fx: MoiraFixture; ev: number; pct: number; p2: number; exec: number }> = [
    { name: '#1 discovery: born unestimated', fx: discovered, ev: 0, pct: 0, p2: 0, exec: 0 },
    { name: '#2 estimate proposed', fx: estimateProposed, ev: 0, pct: 0, p2: 0, exec: 0 },
    { name: '#3 estimate agreed: P2 100%', fx: estimateAgreed, ev: 0, pct: 0, p2: 1, exec: 0 },
    { name: '#4 req drafted: EV% 24%', fx: requirementsDrafted, ev: 3, pct: 0.24, p2: 1, exec: 0 },
    { name: '#5 req returned: EV% 8% (revert)', fx: requirementsReturned, ev: 1, pct: 0.08, p2: 1, exec: 1 / 6 },
    { name: 'seam#3 resubmit: EV% 32%', fx: requirementsResubmitted1, ev: 4, pct: 0.32, p2: 1, exec: 0 },
    { name: '#6 req re-returned: EV% 8%', fx: requirementsReReturned, ev: 1, pct: 0.08, p2: 1, exec: 1 / 6 },
    { name: 'seam#4 resubmit: EV% 32%', fx: requirementsResubmitted2, ev: 4, pct: 0.32, p2: 1, exec: 0 },
    { name: '#7 req accepted: EV% 32% (approval adds no EV)', fx: requirementsAccepted, ev: 4, pct: 0.32, p2: 1, exec: 1 / 6 },
    { name: '#8 design completed: EV% 80%', fx: designCompleted, ev: 10, pct: 0.8, p2: 1, exec: 1 / 6 },
    { name: '#9 tasks completed: EV% 100% apparent, P2 75%', fx: tasksCompleted, ev: 12.5, pct: 1, p2: 0.75, exec: 0 },
    { name: '#10 estimate-impl agreed: EV% 43.9% (honest, 12.5/28.5)', fx: implEstimateAgreed, ev: 12.5, pct: 12.5 / 28.5, p2: 1, exec: 0 },
    { name: '#11 impl completed: EV% 100% real, F accepted', fx: implCompleted, ev: 28.5, pct: 1, p2: 1, exec: 0 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const d = run(c.fx);
      expect(d.evAbs).toBeCloseTo(c.ev, P);
      expect(d.evPercent).toBeCloseTo(c.pct, P);
      expect(d.estimateCoverage).toBeCloseTo(c.p2, P);
      expect(d.executionCoverage).toBeCloseTo(c.exec, P);
      expect(d.structuralErrors).toEqual([]);
    });
  }

  // The honesty signal the flow names: a return reverts EV, and the SECOND return
  // costs the project more (AC) for the SAME zero EV gain — "差し戻しは無償でない".
  it('return reverts EV; the folded re-review adds AC for equal EV (CPI worsens)', () => {
    const r1 = run(requirementsReturned); // first return: EV_abs 1, no folded cost yet
    const r2 = run(requirementsReReturned); // second return: EV_abs 1, folded review cost added
    expect(r2.evAbs).toBe(r1.evAbs); // same earned value (1) — the rework re-lost it
    expect(r2.ac).toBeGreaterThan(r1.ac); // but AC grew (folded re-review cost) → CPI worsens
    // NB: only the §5-pinned fold costs are transcribed; the bulk labour AC is
    // implementation-delegated ("件数は実装が決める"), so the absolute CPI is not
    // pinned — the honest signal is AC↑ at equal EV.
  });

  // F is the spine's ONLY feature reaching accepted (terminal); the final 100% is
  // real (P2 also 100%), not the apparent 100% of #9.
  it('#11 is the real 100%: F accepted and P2 100% (vs #9 apparent 100% at P2 75%)', () => {
    const apparent = run(tasksCompleted);
    const real = run(implCompleted);
    expect(apparent.evPercent).toBeCloseTo(1, P);
    expect(apparent.estimateCoverage).toBeCloseTo(0.75, P); // apparent: coverage < 100%
    expect(real.evPercent).toBeCloseTo(1, P);
    expect(real.estimateCoverage).toBeCloseTo(1, P); // real: coverage 100%
    const fNode = real.nodeStates.find((n) => n.node === 'F');
    expect(fNode?.lifecycle).toBe('accepted');
  });
});
