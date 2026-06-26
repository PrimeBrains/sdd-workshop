// ============================================================================
// PR-DONE-LOCK★ (I4·R-E3) — THE DECISIVE RED of the minimal pilot.
//
// Oracle (moira/PROPERTIES.md, transcribed verbatim from the plain sentence):
//   「いったん完了して出来高が確定した作業の出来高(EV_abs)は、後から何をしても
//     額自体は減らない…見積のやり直しで出来高や率が動くのは、まだ完了していない
//     作業だけ」
//
// i.e. once a node is agreed AND completed, its EV_abs contribution is frozen
// (I4). Re-estimating it (agreed→proposed) must NOT change EV_abs — re-estimation
// only moves still-incomplete work (R-E3 incomplete-only).
//
// This oracle is written from the property sentence, NOT from the code. The
// reference implementation is EXPECTED TO FAIL it:
//   - fold.ts reverts estimateState to 'proposed' with NO completed-node guard
//     (fold.ts: "Re-estimation returns to proposed", §139-141).
//   - computeEvAbs gates on estimateState === 'agreed' (ev.ts §23), so the
//     completed node silently drops out of EV_abs after the revert.
// frozenBudget IS preserved, but the agreed-gate kills the contribution.
//
// This is the harness demonstrating its worth: a divergence the prose gates
// (moira-model-update / doc-refine) missed, caught mechanically. The FIX is a
// separate enforce-ownership Decision (moira-verification.md 動機節) and is NOT
// part of this log-only pilot — we observe the red, we do not patch the SUT.
//
// CI handling: encoded as `it.fails(...)` so the suite stays green while
// PERMANENTLY recording the known violation. If the implementation is later
// fixed (EV_abs reads frozenBudget for completed nodes regardless of a later
// re-proposal), this test will start PASSING and `it.fails` will flip the file
// RED — a tripwire telling us to promote PR-DONE-LOCK to a normal `it()`.
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { derive, type DeriveOptions } from '../derive.js';
import { agent, human } from '../test-utils.js';
import type { Event } from '../types.js';

const OPTS: DeriveOptions = { asOf: '2026-06-30' };

/** A targeted log: one node, agreed + completed, then estimate reverted to proposed. */
function doneNodeThenRevert(estimate: number, completedTo: 'implemented' | 'accepted'): {
  before: Event[];
  after: Event[];
} {
  const before: Event[] = [
    { kind: 'decompose', id: 'e1', ts: 1, actor: agent('ai'), parent: 'F', reason: 'init', children: [{ node: 'A', estimate }] },
    { kind: 'transition', id: 'e2', ts: 2, actor: human('h1'), node: 'A', machine: 'estimate-agreement', to: 'agreed', frozenBudget: estimate },
    { kind: 'transition', id: 'e3', ts: 3, actor: human('h1'), node: 'A', machine: 'lifecycle', to: completedTo },
  ];
  // The I4-violating move: re-estimate a COMPLETED node back to proposed.
  const revert: Event = {
    kind: 'transition', id: 'e4', ts: 4, actor: human('h1'), node: 'A', machine: 'estimate-agreement', to: 'proposed', reason: 're-estimate',
  };
  return { before, after: [...before, revert] };
}

describe('PR-DONE-LOCK★ (I4·R-E3): completed EV_abs is frozen against re-estimation', () => {
  // EXPECTED RED against the current reference implementation (see header).
  it.fails('reverting a completed agreed node to proposed must NOT change EV_abs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom<'implemented' | 'accepted'>('implemented', 'accepted'),
        (estimate, completedTo) => {
          const { before, after } = doneNodeThenRevert(estimate, completedTo);

          const evBefore = derive(before, OPTS).evAbs;
          const evAfter = derive(after, OPTS).evAbs;

          // Non-vacuity: the node really did earn value before the revert.
          expect(evBefore).toBe(estimate);
          // Oracle (PR-DONE-LOCK): completed EV_abs額 is invariant under re-estimation.
          expect(evAfter).toBe(evBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Companion documenting the ACTUAL current behavior (so the red is legible and
  // pinned): the completed node silently drops out of EV_abs after the revert.
  it('DOCUMENTS current behavior: revert silently drops the completed EV_abs to 0', () => {
    const { before, after } = doneNodeThenRevert(8, 'implemented');
    expect(derive(before, OPTS).evAbs).toBe(8); // earned
    expect(derive(after, OPTS).evAbs).toBe(0); // ...then silently lost — the gap
  });
});
