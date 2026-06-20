// (1) Node states — a plain projection of the lifecycle + estimate machines.

import type { NodeStateRow, ProjectedState } from '../types.js';

export function computeNodeStates(state: ProjectedState): NodeStateRow[] {
  const rows: NodeStateRow[] = [];
  for (const [id, n] of state.nodes) {
    rows.push({ node: id, lifecycle: n.lifecycle, estimate: n.estimateState });
  }
  rows.sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));
  return rows;
}
