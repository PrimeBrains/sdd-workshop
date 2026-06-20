// (7) AC — actual cost, aggregated isomorphically up the tree (P3 MODEL:172).
//
//   AC(node) = node.ownCost + Σ AC(child)
//
// Domain-independent: includes in-progress (WIP) cost, and cancelled nodes'
// cost is retained (cost is a fact, A6 MODEL:44; not folded into EV, R-U10).
// Computed post-order with memoization.

import type { AcRow, NodeId, ProjectedState } from '../types.js';

export interface AcResult {
  total: number;
  byNode: AcRow[];
}

export function computeAc(state: ProjectedState): AcResult {
  const memo = new Map<NodeId, number>();

  const acOf = (id: NodeId): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const n = state.nodes.get(id);
    let sum = n === undefined ? 0 : n.ownCost;
    for (const child of state.childrenOf.get(id) ?? []) sum += acOf(child);
    memo.set(id, sum);
    return sum;
  };

  const byNode: AcRow[] = [];
  for (const id of state.nodes.keys()) byNode.push({ node: id, ac: acOf(id) });
  byNode.sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));

  // Project total = Σ ownCost over all nodes (== AC(root) for a single tree,
  // robust for a forest). Equivalent to summing roots' AC without double count.
  let total = 0;
  for (const n of state.nodes.values()) total += n.ownCost;

  return { total, byNode };
}
