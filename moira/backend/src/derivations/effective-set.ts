// Currently-effective set (R-S5 MODEL:292, §2.7 MODEL:122-133).
//
// A node is *superseded* iff an ACTIVE supersede edge `new → node` exists whose
// `new` node is NOT cancelled. If the superseding (new) node is cancelled, the
// edge is inert and the old node re-enters the effective set (R-S5 derivation
// rule, MODEL:292). Cancelled nodes are excluded from the active basis (R-C2
// MODEL:323).
//
// This is load-bearing for the "current progress" pair-read (EV% read with
// coverage), so it is ENFORCED in the minimal slice — not deferred.

import type { NodeId, ProjectedState } from '../types.js';

export interface EffectiveSet {
  /** Old nodes hidden by an active supersede edge. */
  superseded: Set<NodeId>;
  /** Known, currently-effective nodes (not superseded, not cancelled). */
  effectiveNodes: Set<NodeId>;
  /** Effective leaves (no effective children) — the EVM sub-units (§3 MODEL:197). */
  effectiveLeaves: NodeId[];
}

export function computeEffectiveSet(state: ProjectedState): EffectiveSet {
  const superseded = new Set<NodeId>();
  for (const edge of state.supersedeEdges) {
    const newNode = state.nodes.get(edge.from); // source = NEW node (R-D7 MODEL:349)
    const newCancelled = newNode?.lifecycle === 'cancelled';
    if (!newCancelled) superseded.add(edge.to); // old node is superseded
  }

  const effectiveNodes = new Set<NodeId>();
  for (const [id, node] of state.nodes) {
    if (superseded.has(id)) continue;
    if (node.lifecycle === 'cancelled') continue; // R-C2
    effectiveNodes.add(id);
  }

  // A node is an effective leaf if it has no effective children. A node whose
  // children are all superseded/cancelled becomes effectively a leaf.
  const isEffectiveLeaf = (id: NodeId): boolean => {
    const kids = state.childrenOf.get(id) ?? [];
    return kids.every((k) => !effectiveNodes.has(k));
  };

  const effectiveLeaves = [...effectiveNodes].filter(isEffectiveLeaf).sort();
  return { superseded, effectiveNodes, effectiveLeaves };
}
