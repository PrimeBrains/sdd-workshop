// ============================================================================
// Minimal PBT pilot — the 5 already-agreed properties expected GREEN against the
// reference implementation. Oracles are transcribed from moira/PROPERTIES.md's
// "人間がレビューする一文" — NOT reverse-engineered from the derivation code
// (moira-verification.md: property author ≠ implementation author).
//
//   PR-EVPCT-RANGE  (R-U8·P1)   — EV% ∈ [0,1]; no agreed ⇒ 0
//   PR-CANCEL-EXCL  (R-C2)      — cancel never raises EV_abs; excluded from basis
//   PR-AC-ROLLUP    (P3)        — AC(node) = subtree Σ ownCost (bottom-up)
//   PM-ORDER-INV    (I3)        — physical reorder ⇒ identical derivation
//   PR-I1-ROLLUP    (I1)        — value rolls up from leaves; unestimated child
//                                  lowers coverage without breaking consistency
//
// The decisive RED property (PR-DONE-LOCK★) lives in done-lock.pbt.test.ts.
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeAc } from '../derivations/ac.js';
import { derive, type DeriveOptions } from '../derive.js';
import { fold } from '../fold.js';
import type { Event, NodeId } from '../types.js';
import {
  arbCapacityEntries,
  arbProjectSpec,
  buildCapacityLookup,
  compileLog,
  cornersOf,
  permute,
} from './arbitraries.js';

const RUNS = 500;
const OPTS: DeriveOptions = { asOf: '2026-06-30' };

// ---------------------------------------------------------------------------
// Self-coverage (到達 witness): the generator must actually reach every
// adversarial corner, else the "green" runs are vacuous (an untested invariant
// masquerading as a passing one).
// ---------------------------------------------------------------------------
describe('generator self-coverage (到達 witness)', () => {
  it('reaches every adversarial corner across a sample', () => {
    const specs = fc.sample(arbProjectSpec, { numRuns: 1000, seed: 42 });
    const agg = {
      unestimatedLeaf: false,
      completionWithoutAgreement: false,
      agentAgreeRejected: false,
      agreedThenReverted: false,
      supersede: false,
      cancelled: false,
    };
    for (const s of specs) {
      const c = cornersOf(s);
      for (const k of Object.keys(agg) as (keyof typeof agg)[]) agg[k] = agg[k] || c[k];
    }
    expect(agg).toEqual({
      unestimatedLeaf: true,
      completionWithoutAgreement: true,
      agentAgreeRejected: true,
      agreedThenReverted: true,
      supersede: true,
      cancelled: true,
    });
  });

  it('the R-U4 corner is actually exercised in the fold (agent agree rejected)', () => {
    // Witness that the corner is not just generated but reaches the SUT path.
    const log = compileLog({
      leaves: [{ estimate: 5, agree: 'agent', lifecycle: 'pending', cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false }],
    });
    const state = fold(log);
    expect(state.structuralErrors.some((e) => e.includes('R-U4'))).toBe(true);
    expect(state.nodes.get('L0')?.estimateState).toBe('proposed'); // rejected, not agreed
  });
});

// ---------------------------------------------------------------------------
// PR-EVPCT-RANGE — 達成率 EV% は常に 0〜100% に収まる（合意済みゼロなら 0）。
// ---------------------------------------------------------------------------
describe('PR-EVPCT-RANGE (R-U8·P1): EV% ∈ [0,1]', () => {
  it('evPercent is always a finite ratio in [0,1]', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        const d = derive(compileLog(spec), OPTS);
        expect(Number.isFinite(d.evPercent)).toBe(true);
        expect(d.evPercent).toBeGreaterThanOrEqual(0);
        expect(d.evPercent).toBeLessThanOrEqual(1);
      }),
      { numRuns: RUNS },
    );
  });

  it('no agreed effective work ⇒ EV%=0 (denominator-zero branch)', () => {
    // One unestimated, unagreed leaf: nothing agreed ⇒ denom 0 ⇒ 0 by definition.
    const d = derive(
      compileLog({ leaves: [{ estimate: undefined, agree: 'none', lifecycle: 'implemented', cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false }] }),
      OPTS,
    );
    expect(d.evPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PR-CANCEL-EXCL — タスクをキャンセルしても有効分 EV_abs は増えない；キャンセルは
// 稼働対象から外れる（effective set から除外）。
// ---------------------------------------------------------------------------
describe('PR-CANCEL-EXCL (R-C2): cancel never raises EV_abs, leaves the active basis', () => {
  it('cancelling any leaf does not increase EV_abs and removes it from effective leaves', () => {
    fc.assert(
      fc.property(arbProjectSpec, fc.nat(), (spec, idxRaw) => {
        const base = compileLog(spec);
        const before = derive(base, OPTS).evAbs;

        const i = idxRaw % spec.leaves.length;
        const cancelled: Event = {
          kind: 'transition',
          id: `cancel-${i}`,
          ts: base.length + 1, // strictly after every base event
          actor: { kind: 'human', id: 'h1' },
          node: `L${i}`,
          machine: 'lifecycle',
          to: 'cancelled',
        };
        const after = derive([...base, cancelled], OPTS);

        expect(after.evAbs).toBeLessThanOrEqual(before); // non-increase
        expect(after.effectiveLeaves).not.toContain(`L${i}`); // excluded from basis
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// PR-AC-ROLLUP — 実コスト AC はツリーを下から積み上げた合計。各ノードの AC は
// 「そのノードに直接付いたコスト＋子の AC の合計」。
// Independent oracle: AC(node) must equal the Σ ownCost over node's whole subtree.
// ---------------------------------------------------------------------------
describe('PR-AC-ROLLUP (P3): AC(node) = subtree Σ ownCost', () => {
  it('every node AC equals the independent subtree cost sum', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        const state = fold(compileLog(spec));
        const { byNode, total } = computeAc(state);

        // Independent oracle, computed straight from the fold's tree + ownCost.
        const subtreeSum = (id: NodeId): number => {
          const n = state.nodes.get(id);
          let sum = n === undefined ? 0 : n.ownCost;
          for (const kid of state.childrenOf.get(id) ?? []) sum += subtreeSum(kid);
          return sum;
        };

        for (const row of byNode) {
          expect(row.ac).toBe(subtreeSum(row.node)); // bottom-up rollup at every node
        }
        // Total = Σ ownCost over all nodes (documented project total).
        let allOwn = 0;
        for (const n of state.nodes.values()) allOwn += n.ownCost;
        expect(total).toBe(allOwn);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// PM-ORDER-INV — イベントの記録順を入れ替えても（同じ時刻・同じ id の並びを保つ
// 限り）導出結果は完全に同じになる。
// ---------------------------------------------------------------------------
describe('PM-ORDER-INV (I3): physical reorder ⇒ identical derivation', () => {
  it('derive() is invariant under physical permutation of the event array', () => {
    fc.assert(
      fc.property(arbProjectSpec, arbCapacityEntries, fc.integer(), (spec, caps, seed) => {
        const base = compileLog(spec);
        const opts: DeriveOptions = { asOf: '2026-06-30', capacityOf: buildCapacityLookup(caps) };
        const a = derive(base, opts);
        const b = derive(permute(base, seed), opts);
        expect(b).toEqual(a);
      }),
      { numRuns: RUNS },
    );
  });

  it('invariance still holds when ts collide and id is the sole tie-breaker', () => {
    fc.assert(
      fc.property(arbProjectSpec, fc.integer(), (spec, seed) => {
        // Collapse all ts to a single value: ordering must fall back to id (I3).
        const collapsed: Event[] = compileLog(spec).map((e) => ({ ...e, ts: 1 }));
        const a = derive(collapsed, OPTS);
        const b = derive(permute(collapsed, seed), OPTS);
        expect(b).toEqual(a);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// PR-I1-ROLLUP — 親の見積は合意済みの子の見積の合計に一致する；まだ見積もって
// いない子は『カバレッジ低下』として現れ、整合の破れにはしない。
//
// The reference fold does not expose a parent-estimate rollup value (§7#17 in
// coverage.ts), so I1's value-rollup is verified through its two observable
// consequences on the leaf basis:
//  (1a) inserting an intermediate grouping node leaves all totals unchanged —
//       intermediate nodes don't independently count; value rolls up from leaves.
//  (1b) an unestimated child lowers estimate coverage but raises NO structural
//       error and does not touch settled EV_abs.
// ---------------------------------------------------------------------------
describe('PR-I1-ROLLUP (I1): leaf-basis value rollup', () => {
  it('(1a) regrouping leaves under an intermediate node preserves EV_abs / EV% / coverage', () => {
    // Scope: no supersede / cancel — those make an all-non-effective-children
    // group node collapse into an effective leaf (a documented effective-set
    // rule, effective-set.ts), which legitimately moves leaf-count coverage and
    // is NOT an I1 violation. That collapse is covered by PR-CANCEL-EXCL /
    // MC-SUP-CANCEL. Here we isolate the pure "intermediate node is value-
    // transparent" claim, so G always stays a genuine internal node.
    const arbNoCollapse = arbProjectSpec.map((spec) => ({
      leaves: spec.leaves.map((l) => ({
        ...l,
        supersededByNew: false,
        lifecycle: l.lifecycle === 'cancelled' ? ('pending' as const) : l.lifecycle,
      })),
    }));
    fc.assert(
      fc.property(arbNoCollapse, fc.nat(), (spec, gRaw) => {
        const flat = derive(compileLog(spec), OPTS);
        const groupFirst = spec.leaves.length >= 2 ? 2 + (gRaw % (spec.leaves.length - 1)) : 0;
        const grouped = derive(compileLog(spec, { groupFirst }), OPTS);

        expect(grouped.evAbs).toBe(flat.evAbs);
        expect(grouped.evPercent).toBeCloseTo(flat.evPercent, 10);
        expect(grouped.estimateCoverage).toBeCloseTo(flat.estimateCoverage, 10);
      }),
      { numRuns: RUNS },
    );
  });

  it('(1b) an unestimated child lowers coverage, breaks no consistency, leaves EV_abs', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        const base = compileLog(spec);
        const before = derive(base, OPTS);

        const extra: Event = {
          kind: 'decompose',
          id: `disc-extra`,
          ts: base.length + 1,
          actor: { kind: 'agent', id: 'ai' },
          parent: 'F',
          reason: 'discovery',
          children: [{ node: 'extra-unestimated' }], // no estimate ⇒ §2.3 discovery
        };
        const after = derive([...base, extra], OPTS);

        expect(after.estimateCoverage).toBeLessThanOrEqual(before.estimateCoverage); // drop
        expect(after.structuralErrors.length).toBe(before.structuralErrors.length); // no break
        expect(after.evAbs).toBe(before.evAbs); // settled EV unmoved
      }),
      { numRuns: RUNS },
    );
  });
});
