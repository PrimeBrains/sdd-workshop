// (14) Feature rollup — per-feature EV attribution over the tree (value) axis
// (TE03 「木(価値)」: completed sub-units' I4-locked frozen budgets roll up to
// the root-child feature; issue #25 morning digest).
//
// Same INDEPENDENT-derivation discipline as landing.ts / critical-path.ts:
// deliberately NOT part of DerivedState — the golden arcs (backbone.golden)
// stay byte-identical; consumers call computeFeatureRollup separately.
//
// EV semantics are NOT duplicated here: each group of effective leaves is
// handed to the exact computeEvAbs / computeEvPercent the engine uses (they
// read only eff.effectiveLeaves), so a feature row is literally "the engine's
// EV over this feature's slice". Value stays attributed to the TREE, never to
// actors (TE03/A4 — no per-developer EV scoreboard).

import { sortEvents } from '../event-store.js';
import { fold } from '../fold.js';
import type { Event, NodeId, ProjectedState } from '../types.js';
import { computeEffectiveSet } from './effective-set.js';
import { computeEvAbs, computeEvPercent } from './ev.js';

const COMPLETED = new Set(['implemented', 'accepted']); // §2.5 — mirrors ev.ts

export interface FeatureRollupRow {
  /** Root-direct effective node (a root-direct effective leaf is its own feature). */
  feature: NodeId;
  /** Engine EV over this feature's effective-leaf slice (R-U8 agreed-completed). */
  evAbs: number;
  /** Engine EV% over the same slice (denominator = agreed latest estimates). */
  evPercent: number;
  /** Σ agreed effective leaves' latest estimate — the slice's EV% denominator. */
  budget: number;
  /** Effective leaves under this feature (R-S5). */
  leafCount: number;
  /** Effective leaves in {implemented, accepted}. */
  completedLeafCount: number;
}

/**
 * Attribute each effective leaf to its root-direct ancestor and compute the
 * engine's EV over each group. Raw-events signature (critical-path.ts style)
 * because the barrel does not expose fold internals. Rows sorted by feature id
 * for determinism. An orphan leaf (parent chain never reaches `root`) becomes
 * its own single-leaf feature — a visible gap, never silently dropped.
 */
export function computeFeatureRollup(events: readonly Event[], root: NodeId): FeatureRollupRow[] {
  const state = fold(sortEvents(events)); // (ts,id) total order — I3; input never mutated
  const eff = computeEffectiveSet(state);

  const groups = new Map<NodeId, NodeId[]>();
  for (const leaf of eff.effectiveLeaves) {
    if (leaf === root) continue; // a bare root carries no feature rows
    const feature = rootChildAncestor(state, leaf, root) ?? leaf;
    const g = groups.get(feature) ?? [];
    g.push(leaf);
    groups.set(feature, g);
  }

  const rows: FeatureRollupRow[] = [];
  for (const feature of [...groups.keys()].sort()) {
    const leaves = groups.get(feature)!;
    const slice = { ...eff, effectiveLeaves: leaves };
    const evAbs = computeEvAbs(state, slice);
    const evPercent = computeEvPercent(state, slice, evAbs);
    let budget = 0;
    let completedLeafCount = 0;
    for (const id of leaves) {
      const n = state.nodes.get(id);
      if (n === undefined) continue;
      if (n.estimateState === 'agreed' && n.latestEstimate !== null) budget += n.latestEstimate;
      if (COMPLETED.has(n.lifecycle)) completedLeafCount += 1;
    }
    rows.push({ feature, evAbs, evPercent, budget, leafCount: leaves.length, completedLeafCount });
  }
  return rows;
}

/** Walk parent pointers up from `leaf`; return the ancestor whose parent is `root`. */
function rootChildAncestor(state: ProjectedState, leaf: NodeId, root: NodeId): NodeId | null {
  let cur: NodeId = leaf;
  const seen = new Set<NodeId>(); // safety bound, same as fold's cycle walk
  while (!seen.has(cur)) {
    seen.add(cur);
    const parent = state.nodes.get(cur)?.parent ?? null;
    if (parent === root) return cur;
    if (parent === null) return null; // orphan chain — never reached root
    cur = parent;
  }
  return null;
}
