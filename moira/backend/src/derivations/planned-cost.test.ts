import { describe, expect, it } from 'vitest';
import { fold } from '../fold.js';
import { agent, human, Log } from '../test-utils.js';
import { computePlannedCost } from './planned-cost.js';

describe('planned-cost tree rollup (issue #34a)', () => {
  it('rolls budget up the tree: plannedCost(parent) = Σ plannedCost(child)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }, { node: 'b', estimate: 4 }])
        .agree('a', 3)
        .agree('b', 4)
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(total).toBe(7);
    const f = byNode.find((r) => r.node === 'F');
    expect(f?.plannedCost).toBe(7);
    expect(byNode.find((r) => r.node === 'a')?.plannedCost).toBe(3);
    expect(byNode.find((r) => r.node === 'b')?.plannedCost).toBe(4);
  });

  it('a proposed leaf (no frozenBudget yet) falls back to latestEstimate', () => {
    const state = fold(new Log().decompose('F', [{ node: 'a', estimate: 5 }]).all()); // never agreed
    const { total } = computePlannedCost(state);
    expect(total).toBe(5);
  });

  it('a leaf born without an estimate contributes 0', () => {
    const state = fold(new Log().decompose('F', [{ node: 'a' }]).all());
    const { total } = computePlannedCost(state);
    expect(total).toBe(0);
  });

  it('frozenBudget (once agreed) is immutable and wins over a later latestEstimate re-baseline (I4 lock)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 5 }])
        .agree('a', 5)
        .decompose('F', [{ node: 'a', estimate: 8 }], agent('ai'), 'scope grew')
        .all(),
    );
    const { total } = computePlannedCost(state);
    expect(total).toBe(5); // frozen at agreement, NOT the re-baselined latest estimate
  });

  it('excludes a cancelled leaf from the rollup (R-C2 MODEL:323) — unlike ac.ts, which retains cancelled cost as a sunk fact', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }, { node: 'b', estimate: 4 }])
        .agree('a', 3)
        .agree('b', 4)
        .life('b', 'cancelled', human('h1'))
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(total).toBe(3); // only 'a'
    expect(byNode.find((r) => r.node === 'b')?.plannedCost).toBe(0);
    expect(byNode.find((r) => r.node === 'F')?.plannedCost).toBe(3); // parent excludes the cancelled child too
  });

  it('excludes a superseded leaf (old node hidden by an active supersede edge, R-S5)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'old', estimate: 5 }])
        .agree('old', 5)
        .decompose('F', [{ node: 'new', estimate: 6 }], agent('ai'), 'redo')
        .agree('new', 6)
        .supersede('new', 'old')
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(byNode.find((r) => r.node === 'old')?.plannedCost).toBe(0);
    expect(total).toBe(6); // only 'new'
  });

  it('restores the old node into the rollup when the superseding node is itself cancelled (R-S5 inert-edge rule)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'old', estimate: 5 }])
        .agree('old', 5)
        .decompose('F', [{ node: 'new', estimate: 6 }], agent('ai'), 'redo')
        .agree('new', 6)
        .supersede('new', 'old')
        .life('new', 'cancelled', human('h1'))
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(byNode.find((r) => r.node === 'old')?.plannedCost).toBe(5); // supersede edge is inert
    expect(byNode.find((r) => r.node === 'new')?.plannedCost).toBe(0); // 'new' itself is cancelled
    expect(total).toBe(5);
  });

  it('when a proposed leaf is mixed into the effective set, the root total exceeds BAC (Σ frozenBudget over AGREED effective leaves only)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }, { node: 'b', estimate: 4 }])
        .agree('a', 3) // 'b' stays proposed — no frozenBudget
        .all(),
    );
    const { total } = computePlannedCost(state);
    const bac = 3; // Σ frozenBudget over agreed effective leaves
    expect(total).toBeGreaterThan(bac);
    expect(total).toBe(7); // 3 (agreed 'a') + 4 (proposed 'b' via latestEstimate fallback)
  });

  it('rolls an active leaf up through a cancelled INTERNAL node (F → cancelled A → active leaf x) — cancelled excludes only the node itself from the active basis, never its descendants, matching computeEffectiveSet (NOT the same as cancelling a leaf)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'A' }])
        .decompose('A', [{ node: 'x', estimate: 5 }])
        .agree('x', 5)
        .life('A', 'cancelled', human('h1'))
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(byNode.find((r) => r.node === 'x')?.plannedCost).toBe(5); // x itself: still effective
    expect(byNode.find((r) => r.node === 'A')?.plannedCost).toBe(5); // A: cancelled itself, but rolls up its still-effective child x
    expect(byNode.find((r) => r.node === 'F')?.plannedCost).toBe(5); // F: reaches x through cancelled A
    expect(total).toBe(5);
  });

  it('a cancelled LEAF nested under a cancelled internal node still contributes 0 — a cancelled node excludes only itself, so a cancelled descendant of a cancelled node is excluded on its OWN lifecycle, not by inheriting the ancestor exclusion twice', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'A' }])
        .decompose('A', [{ node: 'x', estimate: 5 }, { node: 'y', estimate: 2 }])
        .agree('x', 5)
        .agree('y', 2)
        .life('y', 'cancelled', human('h1'))
        .life('A', 'cancelled', human('h1'))
        .all(),
    );
    const { total, byNode } = computePlannedCost(state);
    expect(byNode.find((r) => r.node === 'y')?.plannedCost).toBe(0); // y: cancelled leaf, excluded
    expect(byNode.find((r) => r.node === 'x')?.plannedCost).toBe(5); // x: still effective
    expect(byNode.find((r) => r.node === 'A')?.plannedCost).toBe(5); // A: cancelled itself, rolls up only x (not y)
    expect(byNode.find((r) => r.node === 'F')?.plannedCost).toBe(5);
    expect(total).toBe(5);
  });

  // issue #37 §4.2#8: this is the concrete harm channel behind the frozenBudget-
  // clear-on-revert fix in fold.ts. computePlannedCost's leaf branch reads
  // `frozenBudget ?? latestEstimate` UNCONDITIONALLY (no estimateState guard,
  // unlike ev.ts/pv.ts/landing.ts) — so before the fix, a revert that left
  // frozenBudget=10 stale would make this return 10 forever, even after a
  // fresh re-decompose drafts a smaller/larger latestEstimate=5. Pinned here so
  // a future regression in fold's revert handling is caught at the consumer
  // that actually reads the stale value, not just at the fold level.
  it('an R-E3 revert then a fresh re-decompose reports the NEW draft estimate, not the stale frozen budget (issue #37 §4.2#8)', () => {
    const state = fold(
      new Log()
        .decompose('F', [{ node: 'a', estimate: 3 }]) // ts=1
        .agree('a', 10) // ts=2
        .raw({
          kind: 'transition', id: 't002b', ts: 2.5, actor: human('h1'), node: 'a',
          machine: 'estimate-agreement', to: 'proposed', reason: 're-estimate',
        })
        .decompose('F', [{ node: 'a', estimate: 5 }]) // ts=3
        .all(),
    );
    expect(state.nodes.get('a')?.estimateState).toBe('proposed');
    const { total } = computePlannedCost(state);
    expect(total).toBe(5); // NOT 10 — the stale frozenBudget must not shadow the fresh draft
  });

  it('sums per structural root, robust for a forest (mirrors ac.ts total)', () => {
    const state = fold(
      new Log()
        .decompose('R1', [{ node: 'a', estimate: 2 }])
        .agree('a', 2)
        .decompose('R2', [{ node: 'b', estimate: 3 }])
        .agree('b', 3)
        .all(),
    );
    const { total } = computePlannedCost(state);
    expect(total).toBe(5);
  });
});
