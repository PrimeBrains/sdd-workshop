// ============================================================================
// Containment latest-wins properties (§2.8 v20 — issue #5 resolution).
//
// Oracle sentences (plain-language, to be mirrored in moira/PROPERTIES.md):
//   PM-TREE-INV   「所属は木である——どのノードも有効親は高々1つで、childrenOf は
//                   親ポインタの正確な逆像である。誤った親付けを重ねても、二重所属
//                   状態は表現されない」(A3・§2.8 所属の latest-wins)
//   PR-REPARENT-HEAL 「間違った親に付けてしまった子は、正しい親の下へもう一度
//                   decompose するだけで元に戻る。戻したあとの導出は、間違いが
//                   一度も無かったログの導出と一致する(履歴を除く)」(§2.8・A2)
//
// These pin the v20 clarification that a re-decompose REPLACES the effective
// parent (never adds a coexisting edge) — the resolution the adversarial gate
// chose over the rejected `op=detach` compensating event.
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { derive, type DeriveOptions } from '../derive.js';
import { fold } from '../fold.js';
import { human } from '../test-utils.js';
import type { DerivedState, Event, NodeId } from '../types.js';
import { arbProjectSpec, compileLog } from './arbitraries.js';

const OPTS: DeriveOptions = { asOf: '2026-06-30' };

/** Deep-compare two DerivedStates ignoring the history projection (activityLog). */
function expectSameDerivation(a: DerivedState, b: DerivedState): void {
  const { activityLog: _a, ...restA } = a;
  const { activityLog: _b, ...restB } = b;
  expect(restA).toEqual(restB);
}

/** All parents listing `node` in childrenOf — must be ≤1 under the tree invariant. */
function parentsListing(state: ReturnType<typeof fold>, node: NodeId): NodeId[] {
  return [...state.childrenOf.entries()].filter(([, kids]) => kids.includes(node)).map(([p]) => p);
}

describe('PM-TREE-INV (A3·§2.8): childrenOf is the exact inverse of the parent pointers', () => {
  it('holds for arbitrary logs, including after arbitrary mis-parenting appends', () => {
    fc.assert(
      fc.property(
        arbProjectSpec,
        // A sequence of extra "mis-parenting" decomposes: (which leaf, which parent).
        fc.array(
          fc.record({
            leaf: fc.nat({ max: 4 }),
            toRoot: fc.boolean(), // re-parent to root F, or to another leaf's id
            other: fc.nat({ max: 4 }),
          }),
          { maxLength: 4 },
        ),
        (spec, moves) => {
          const log: Event[] = compileLog(spec);
          let ts = 10_000;
          for (const m of moves) {
            const leaf = `L${m.leaf % spec.leaves.length}`;
            const parent = m.toRoot ? 'F' : `L${m.other % spec.leaves.length}`;
            // self- and cycle-creating moves stay IN the generated log — the
            // fold's tree-ness guard (A3/§2.8) must reject them, and the
            // invariants below must still hold on the surviving tree.
            ts += 1;
            log.push({
              kind: 'decompose', id: `mv${ts}`, ts, actor: human('h1'),
              parent, reason: 're-parent', children: [{ node: leaf }],
            });
          }
          const state = fold(log);
          // (1) every node's childrenOf membership matches its parent pointer…
          for (const [id, node] of state.nodes) {
            const listed = parentsListing(state, id);
            if (node.parent === null) {
              expect(listed, `orphan/root '${id}' must be listed nowhere`).toEqual([]);
            } else {
              expect(listed, `'${id}' must be listed exactly under its parent`).toEqual([node.parent]);
            }
          }
          // (2) …so multi-parent (the issue-#5 corruption) is unrepresentable.
          for (const [id] of state.nodes) {
            expect(parentsListing(state, id).length).toBeLessThanOrEqual(1);
          }
          // (3) tree-ness: every parent chain terminates (no containment cycle
          // survives the A3/§2.8 guard — single-parent alone would not give this).
          for (const [id] of state.nodes) {
            const seen = new Set<NodeId>();
            let cur: NodeId | null = id;
            while (cur !== null) {
              expect(seen.has(cur), `containment cycle through '${cur}'`).toBe(false);
              seen.add(cur);
              cur = state.nodes.get(cur)?.parent ?? null;
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('PR-REPARENT-HEAL (§2.8·A2): a corrective re-decompose restores the clean derivation', () => {
  it('mistake + compensation ≡ never-mistaken (all derivations except the history)', () => {
    fc.assert(
      fc.property(
        arbProjectSpec,
        fc.nat({ max: 4 }),
        (spec, leafPick) => {
          // Group the first two leaves under the intermediate node G so the
          // mis-parenting to F is a REAL move (the issue-#5 shape), not a no-op.
          fc.pre(spec.leaves.length >= 2);
          const clean: Event[] = compileLog(spec, { groupFirst: 2 });
          const leaf = `L${leafPick % 2}`; // a grouped leaf — its true parent is G
          const trueParent = fold(clean).nodes.get(leaf)?.parent;
          expect(trueParent).toBe('G'); // non-vacuity of the setup itself

          // The issue-#5 shape: a --parent-less add re-rooted the node…
          const mistake: Event = {
            kind: 'decompose', id: 'z-mistake', ts: 20_001, actor: human('h1'),
            parent: 'F', reason: 'oops --parent omitted', children: [{ node: leaf }],
          };
          // …and the compensation is ONE appended re-decompose under the true parent.
          const compensation: Event = {
            kind: 'decompose', id: 'z-repair', ts: 20_002, actor: human('h1'),
            parent: 'G', reason: 'repair: re-parent back', children: [{ node: leaf }],
          };
          const repaired = [...clean, mistake, compensation];
          expectSameDerivation(derive(repaired, OPTS), derive(clean, OPTS));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('witness (non-vacuity): the mistake alone DOES corrupt the derivation it heals', () => {
    // Grouped shape so the leaf's true parent is the intermediate node G, not F.
    const spec = { leaves: [
      { estimate: 3, agree: 'human', lifecycle: 'implemented', cost: 2, scheduled: true, revertAfterAgree: false, supersededByNew: false },
      { estimate: 2, agree: 'human', lifecycle: 'ready', cost: 0, scheduled: true, revertAfterAgree: false, supersededByNew: false },
    ] } as Parameters<typeof compileLog>[0];
    const clean = compileLog(spec, { groupFirst: 2 });
    const mistake: Event = {
      kind: 'decompose', id: 'z-mistake', ts: 20_001, actor: human('h1'),
      parent: 'F', reason: 'oops', children: [{ node: 'L0' }],
    };
    // The mistake moves L0 out of G — the tree (and per-node AC rollup basis) changes…
    const corrupted = fold([...clean, mistake]);
    expect(corrupted.nodes.get('L0')?.parent).toBe('F');
    expect(corrupted.childrenOf.get('G') ?? []).not.toContain('L0');
    // …and one corrective re-decompose restores the clean derivation.
    const compensation: Event = {
      kind: 'decompose', id: 'z-repair', ts: 20_002, actor: human('h1'),
      parent: 'G', reason: 'repair', children: [{ node: 'L0' }],
    };
    expectSameDerivation(derive([...clean, mistake, compensation], OPTS), derive(clean, OPTS));
  });
});
