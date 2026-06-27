// Proves the frontend's imported derive() IS the backend's — same numbers as
// backend/src/golden.test.ts, reached through the Vite backend resolver. Single
// source of truth, verified (UI-DESIGN-BRIEF §8 "三画面が同一 derive 出力").

import { describe, expect, it } from 'vitest';
import { derive, tinyProjectEvents, TINY_AS_OF } from './engine';

describe('frontend single-source pipeline (golden parity)', () => {
  const d = derive(tinyProjectEvents, { asOf: TINY_AS_OF });

  it('reproduces the hand-computed golden values', () => {
    expect(d.evAbs).toBe(20);
    expect(d.evPercent).toBeCloseTo(0.7692, 3);
    // P2 v18 leaf-based coverage: all 5 effective leaves agreed → 5/5 = 1. Mirrors
    // backend/src/golden.test.ts (this test re-exports the SAME derive + fixture).
    // (Was a stale pre-v18 node-based constant 0.8333.)
    expect(d.estimateCoverage).toBeCloseTo(1, 10);
    expect(d.scheduleCoverage).toBe(1);
    expect(d.pv).toBe(20);
    expect(d.ac).toBe(25);
    expect(d.spi).toBe(1);
    expect(d.cpi).toBe(0.8);
  });

  it('exposes the honest gaps the UI must surface', () => {
    // impl-2 stays `ready` (not completed) and is the unagreed/known-gap node.
    expect(d.nodeStates).toHaveLength(6); // F + 5 children
    expect(d.structuralErrors).toEqual([]);
    // forecast (live EAC) differs from frozen slots — the PMB-vs-EAC separation.
    expect(d.forecast.length).toBeGreaterThan(0);
  });
});
