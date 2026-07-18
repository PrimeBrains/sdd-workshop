// Planned cost — the tree rollup of BUDGET (not actual cost), for schedule-time
// (issue #34a): "what do we currently plan to spend on this subtree?"
//
//   plannedCost(leaf)   = leaf.frozenBudget ?? leaf.latestEstimate ?? 0
//   plannedCost(parent) = Σ plannedCost(child)   (children of the SAME node here
//                          means: no double count — a parent never adds an own
//                          value on top of its children's rollup, because budget
//                          is only ever meaningful at leaf granularity; contrast
//                          ac.ts's ownCost, which a parent CAN carry directly).
//
// Modeled on ac.ts's post-order + memo shape (same traversal discipline), but
// deliberately NOT the same cancelled-node rule: ac.ts retains a cancelled
// node's cost because cost is a sunk FACT (A6 MODEL:44). Planned cost is
// forward-looking budget, so a cancelled (or superseded) node's OWN
// contribution is 0 instead — mirroring the effective-set discipline
// (R-C2 MODEL:323 — cancelled excluded from the active basis; the same rule
// landing.ts's BAC uses via computeEffectiveSet/effectiveLeaves).
//
// Cancelled/superseded exclusion is scoped to the node ITSELF, exactly like
// computeEffectiveSet: cancelling (or superseding) a node removes only that
// node from the active basis, never its descendants (effective-set.ts has no
// cascading rule, and neither does this derivation). So `F → cancelled A →
// active leaf x` rolls x up into F and total: A's OWN contribution is 0, but
// recursion through A continues so x (still effective) is reached and
// counted.
//
// The leaf/internal branch below is gated on STRUCTURE (does this node have
// children in the tree?), NOT on computeEffectiveSet's effectiveLeaves. Those
// differ: effectiveLeaves is a SHALLOW (one-level) notion — a node counts as
// an effective leaf whenever none of its DIRECT children are effective, even
// if a non-effective child (like cancelled A above) has an effective
// descendant further down (x). landing.ts's BAC gets away with that
// shallowness because it does a FLAT Σ over eff.effectiveLeaves (F and x can
// both independently appear in that list — no double counting, since it's
// not a tree walk). This derivation instead does a per-node TREE ROLLUP, so
// gating "use own value vs. recurse" on effectiveLeaves would let F's
// (shallow) leaf status short-circuit the walk right before it reaches x —
// exactly the bug this fix removes. Gating on tree structure instead means
// an internal node ALWAYS recurses into its children, cancelled or not,
// which is what actually reaches x. A byNode row is 0 iff: it's a leaf that
// is itself cancelled/superseded (R-C2 MODEL:323), or it's an internal node
// whose whole subtree nets to 0.
//
// This is an INDEPENDENT derivation, deliberately NOT wired into DerivedState /
// derive.ts — same discipline as landing.ts / feature-rollup.ts: the golden
// arcs (backbone.golden) stay byte-identical; consumers call
// computePlannedCost separately.
//
// NOTE on proposed leaves: unlike BAC (Σ frozenBudget over AGREED effective
// leaves only), a PROPOSED leaf here still contributes via the `?? latestEstimate`
// fallback. So when proposed leaves are mixed into the effective set, the root
// total returned here is LARGER than BAC — that gap is exactly the proposed
// (not-yet-agreed) draft budget, a visible "the plan grew" signal, not a bug.

import type { NodeId, ProjectedState } from '../types.js';
import { computeEffectiveSet } from './effective-set.js';

export interface PlannedCostRow {
  node: NodeId;
  plannedCost: number;
}

export interface PlannedCostResult {
  /** Σ plannedCost over root nodes (== root's rollup for a single tree, robust for a forest). */
  total: number;
  byNode: PlannedCostRow[];
}

export function computePlannedCost(state: ProjectedState): PlannedCostResult {
  const eff = computeEffectiveSet(state);
  const memo = new Map<NodeId, number>();

  const costOf = (id: NodeId): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const kids = state.childrenOf.get(id) ?? [];
    let value: number;
    if (kids.length === 0) {
      // Structural leaf: own contribution counts iff THIS node is effective
      // (R-C2 MODEL:323 — cancelled/superseded excluded, mirroring
      // effective-set — NOT ac.ts's cost-is-a-fact retention, see file
      // header). A cancelled/superseded leaf contributes 0.
      const n = state.nodes.get(id);
      value = eff.effectiveNodes.has(id) ? (n?.frozenBudget ?? n?.latestEstimate ?? 0) : 0;
    } else {
      // Structural internal node: own contribution is always 0 (budget only
      // lives at leaf granularity, see file header) and recursion into
      // children is UNCONDITIONAL — even when this node itself is
      // cancelled/superseded. Cancelling a node excludes only that node from
      // the active basis, never its descendants, so an effective descendant
      // reached only through a cancelled ancestor still rolls up here.
      value = 0;
      for (const child of kids) value += costOf(child);
    }
    memo.set(id, value);
    return value;
  };

  const byNode: PlannedCostRow[] = [];
  for (const id of state.nodes.keys()) byNode.push({ node: id, plannedCost: costOf(id) });
  byNode.sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));

  // Project total = Σ over root nodes (parent === null), same "robust for a
  // forest" shape as ac.ts's total (there computed as a flat ownCost sum
  // instead, because AC has no leaf/parent distinction to exploit).
  let total = 0;
  for (const [id, n] of state.nodes) {
    if (n.parent === null) total += costOf(id);
  }

  return { total, byNode };
}
