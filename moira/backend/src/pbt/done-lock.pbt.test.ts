// ============================================================================
// PR-DONE-LOCK★ (I4·R-E3) — GREEN regression pin (D-1 done-lock, fixed 2026-07-02).
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
// History: this file was born as the decisive RED of the minimal pilot —
// `it.fails(...)` permanently recording that fold.ts reverted estimateState to
// 'proposed' with no completed-node guard, silently dropping the node from
// EV_abs. Per the ratified Decision D-1 (DECISIONS-CATALOG), enforcement
// ownership is the FOLD: a completed node's agreed→proposed reversion is now
// rejected (visible in structuralErrors; the event stays in the append-only
// log). The read-side alternative ("count completed nodes regardless") was the
// explicitly rejected option in D-1 — the fold guard is the ratified one.
// With the guard in place the property holds, so this is a normal `it()` again.
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { derive, type DeriveOptions } from '../derive.js';
import { fold } from '../fold.js';
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
  it('reverting a completed agreed node to proposed must NOT change EV_abs', () => {
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

  // Companion pinning HOW the lock is enforced (D-1: fold-owned rejection, not a
  // read-side special case): the revert is refused visibly, never silently.
  it('DOCUMENTS the enforcement: the revert is rejected, visible, and non-destructive', () => {
    const { before, after } = doneNodeThenRevert(8, 'implemented');
    expect(derive(before, OPTS).evAbs).toBe(8); // earned...

    const d = derive(after, OPTS);
    expect(d.evAbs).toBe(8); // ...and still earned after the rejected revert (I4).
    // The rejection is honest, not silent (§2.1): one structural error names it.
    expect(d.structuralErrors).toEqual([
      "I4/R-E3: re-estimation (agreed→proposed) on completed node 'A' — rejected (D-1 done-lock)",
    ]);
    // The node's estimate agreement is untouched — no completed+proposed state
    // exists, so R-U13 cannot mis-fire (R-E3).
    expect(fold(after).nodes.get('A')?.estimateState).toBe('agreed');
  });
});
