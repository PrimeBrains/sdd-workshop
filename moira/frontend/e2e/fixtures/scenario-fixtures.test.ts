// Fixture derive-golden — runs under VITEST (not Playwright), so it calls the REAL
// @backend derive() in-process via vite.config's resolver. This is the cheap
// "integration で先に潰す" gate: it proves each transcribed event log derives to the
// numbers its scenario unit states, BEFORE any browser spec asserts on them. A
// transcription error fails here instead of as a confusing DOM mismatch.
import { describe, it, expect } from 'vitest';
import { derive } from '../../src/moira/engine';
import { type MoiraFixture } from './types';
import {
  estimateProposed,
  estimateAgreed,
  reviewWorkDuring,
  reviewWorkAfter,
  requirementsBefore,
  requirementsDrafted,
} from './scenario-fixtures';

const run = (fx: MoiraFixture) => derive(fx.events, { asOf: fx.asOf, capacityOf: () => 1 });

describe('scenario fixtures derive to their unit Given/After numbers', () => {
  it('estimate-spec-proposed: P2 0%, EV% 0% (3 leaves, all proposed)', () => {
    const d = run(estimateProposed);
    expect(d.estimateCoverage).toBeCloseTo(0, 6);
    expect(d.evPercent).toBeCloseTo(0, 6);
    expect(d.evAbs).toBe(0);
  });

  it('estimate-spec-agreed After: P2 100% (3/3), EV% 0%', () => {
    const d = run(estimateAgreed);
    expect(d.estimateCoverage).toBeCloseTo(1, 6);
    expect(d.evPercent).toBeCloseTo(0, 6);
    expect(d.evAbs).toBe(0);
  });

  it('review-work-estimated During: P2 50% (3/6 — discovery signal)', () => {
    const d = run(reviewWorkDuring);
    expect(d.estimateCoverage).toBeCloseTo(0.5, 6);
    expect(d.evPercent).toBeCloseTo(0, 6);
  });

  it('review-work-estimated After: P2 100% (6/6)', () => {
    const d = run(reviewWorkAfter);
    expect(d.estimateCoverage).toBeCloseTo(1, 6);
    expect(d.evPercent).toBeCloseTo(0, 6);
  });

  it('requirements-spec-drafted Before/Given: EV% 0% (all agreed, none completed)', () => {
    const d = run(requirementsBefore);
    expect(d.evPercent).toBeCloseTo(0, 6);
    expect(d.estimateCoverage).toBeCloseTo(1, 6);
  });

  it('requirements-spec-drafted After: EV% 24% (3 / 12.5), EV_abs 3, P2 100%', () => {
    const d = run(requirementsDrafted);
    expect(d.evAbs).toBe(3);
    expect(d.evPercent).toBeCloseTo(0.24, 6);
    expect(d.estimateCoverage).toBeCloseTo(1, 6);
  });
});
