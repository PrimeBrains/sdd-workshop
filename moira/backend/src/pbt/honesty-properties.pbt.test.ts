// ============================================================================
// Honesty properties — the flow-specific invariants the backbone
// (flows/new-feature-happy-path.md §6) carries, generalized from its concrete arc
// to ALL well-formed logs. Oracles are transcribed from the flow's §6 EARS and the
// MODEL principles they cite — NOT reverse-engineered from the derivation code.
//
//   PR-APPROVAL-NEUTRAL  (§6: 承認では動かさない / R-U8·P1) — implemented→accepted
//                         adds no EV_abs (approval is not earned value).
//   PR-RETURN-REVERTS    (§6: 差し戻しは出来高を失わせる / P5)  — a completed agreed
//                         leaf sent back to implementing loses exactly its EV_abs.
//   PR-EV-NONMONOTONIC   (§6: 達成率は非単調に低下しうる / P5c, DN-MONOTONIC) —
//                         agreeing new scope (denominator↑) with EV_abs fixed never
//                         RAISES EV%.
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { derive, type DeriveOptions } from '../derive.js';
import type { Event, LifecycleState } from '../types.js';
import { arbProjectSpec, compileLog, type ProjectSpec } from './arbitraries.js';

const RUNS = 500;
const OPTS: DeriveOptions = { asOf: '2026-06-30' };
const COMPLETED: ReadonlySet<LifecycleState> = new Set(['implemented', 'accepted']);

// ---------------------------------------------------------------------------
// PR-APPROVAL-NEUTRAL — 承認（implemented→accepted）は出来高 EV_abs を増やさない。
// Appending an `accepted` transition for every `implemented` leaf must leave EV_abs
// exactly unchanged (both states are "completed"; approval is a quality gate, not
// earned value).
// ---------------------------------------------------------------------------
describe('PR-APPROVAL-NEUTRAL (§6·R-U8): approval adds no EV', () => {
  it('implemented→accepted leaves EV_abs unchanged', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        const base = compileLog(spec);
        const before = derive(base, OPTS).evAbs;

        const approvals: Event[] = [];
        let ts = base.length;
        spec.leaves.forEach((leaf, i) => {
          if (leaf.lifecycle === 'implemented') {
            ts += 1;
            approvals.push({
              kind: 'transition',
              id: `accept-${i}`,
              ts,
              actor: { kind: 'human', id: 'h1' },
              node: `L${i}`,
              machine: 'lifecycle',
              to: 'accepted',
            });
          }
        });
        const after = derive([...base, ...approvals], OPTS).evAbs;
        expect(after).toBe(before);
      }),
      { numRuns: RUNS },
    );
  });

  it('witness: an agreed+implemented leaf is counted, and approval does not change it', () => {
    const leaf = { estimate: 4, agree: 'human' as const, lifecycle: 'implemented' as const, cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false };
    const base = compileLog({ leaves: [leaf] });
    expect(derive(base, OPTS).evAbs).toBe(4); // counted while implemented
    const accepted: Event = { kind: 'transition', id: 'a', ts: base.length + 1, actor: { kind: 'human', id: 'h1' }, node: 'L0', machine: 'lifecycle', to: 'accepted' };
    expect(derive([...base, accepted], OPTS).evAbs).toBe(4); // unchanged on approval
  });
});

// ---------------------------------------------------------------------------
// PR-RETURN-REVERTS — 差し戻し（completed→implementing の後退）は、その成果物の
// 出来高をちょうど失わせる。EV_abs はその葉の凍結予算ぶん減る（P5・無償でない）。
// ---------------------------------------------------------------------------
describe('PR-RETURN-REVERTS (§6·P5): a return strips that node’s EV', () => {
  const eligible = (spec: ProjectSpec) =>
    spec.leaves
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.agree === 'human' && l.estimate !== undefined && COMPLETED.has(l.lifecycle) && !l.supersededByNew);

  it('reverting a completed agreed leaf to implementing drops EV_abs by its frozen budget', () => {
    fc.assert(
      fc.property(arbProjectSpec, fc.nat(), (spec, pick) => {
        const cands = eligible(spec);
        if (cands.length === 0) return; // vacuous for this spec — covered by witness below
        const { l, i } = cands[pick % cands.length]!;
        const base = compileLog(spec);
        const before = derive(base, OPTS).evAbs;
        const revert: Event = { kind: 'transition', id: `revert-${i}`, ts: base.length + 1, actor: { kind: 'human', id: 'h1' }, node: `L${i}`, machine: 'lifecycle', to: 'implementing' };
        const after = derive([...base, revert], OPTS).evAbs;
        expect(after).toBeCloseTo(before - (l.estimate as number), 10);
        expect(after).toBeLessThan(before); // strictly less (estimate ≥ 1)
      }),
      { numRuns: RUNS },
    );
  });

  it('witness: req(3) completed→implementing drops EV_abs 3→0', () => {
    const base = compileLog({ leaves: [{ estimate: 3, agree: 'human', lifecycle: 'implemented', cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false }] });
    expect(derive(base, OPTS).evAbs).toBe(3);
    const revert: Event = { kind: 'transition', id: 'r', ts: base.length + 1, actor: { kind: 'human', id: 'h1' }, node: 'L0', machine: 'lifecycle', to: 'implementing' };
    expect(derive([...base, revert], OPTS).evAbs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PR-EV-NONMONOTONIC — 新規スコープの見積合意で分母が増えると、出来高が同じでも
// 達成率 EV% は上がらない（むしろ下がりうる）。P5c の非単調性を肯定する（DN-MONOTONIC）。
// ---------------------------------------------------------------------------
describe('PR-EV-NONMONOTONIC (§6·P5c): newly-agreed scope never raises EV%', () => {
  it('adding an agreed (uncompleted) leaf keeps EV_abs but does not increase EV%', () => {
    fc.assert(
      fc.property(arbProjectSpec, fc.integer({ min: 1, max: 30 }), (spec, k) => {
        const base = compileLog(spec);
        const before = derive(base, OPTS);
        const add: Event[] = [
          { kind: 'decompose', id: 'newscope', ts: base.length + 1, actor: { kind: 'agent', id: 'ai' }, parent: 'F', reason: 'new agreed scope', children: [{ node: 'N', estimate: k }] },
          { kind: 'transition', id: 'newscope-agree', ts: base.length + 2, actor: { kind: 'human', id: 'h1' }, node: 'N', machine: 'estimate-agreement', to: 'agreed', frozenBudget: k },
        ];
        const after = derive([...base, ...add], OPTS);
        expect(after.evAbs).toBe(before.evAbs); // new scope is not completed → no EV gained
        expect(after.evPercent).toBeLessThanOrEqual(before.evPercent + 1e-12); // never rises
      }),
      { numRuns: RUNS },
    );
  });

  it('witness: 12.5/12.5 (100%) drops toward 12.5/28.5 (44%) as impl scope is agreed', () => {
    // Two completed agreed leaves summing 12.5, then agree 16 more of new scope.
    const base = compileLog({
      leaves: [
        { estimate: 12, agree: 'human', lifecycle: 'accepted', cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false },
        { estimate: 0.5, agree: 'human', lifecycle: 'accepted', cost: 0, scheduled: false, revertAfterAgree: false, supersededByNew: false },
      ],
    });
    expect(derive(base, OPTS).evPercent).toBeCloseTo(1, 10); // apparent 100%
    const add: Event[] = [
      { kind: 'decompose', id: 'impl', ts: base.length + 1, actor: { kind: 'agent', id: 'ai' }, parent: 'F', reason: 'impl scope', children: [{ node: 'I', estimate: 16 }] },
      { kind: 'transition', id: 'impl-agree', ts: base.length + 2, actor: { kind: 'human', id: 'h1' }, node: 'I', machine: 'estimate-agreement', to: 'agreed', frozenBudget: 16 },
    ];
    expect(derive([...base, ...add], OPTS).evPercent).toBeCloseTo(12.5 / 28.5, 10); // honest drop
  });
});
