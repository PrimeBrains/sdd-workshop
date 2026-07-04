// (13) Critical path — per-node observability of the dependency longest chain
// (issue #16). P7 (MODEL:207) defines the critical path as the longest chain of
// dependency edges (supersede edges excluded); the leveler already ranks by the
// same downstream length (leveler.ts cp()) but keeps it internal. This derivation
// exposes ONE deterministic maximal chain so the presentation can highlight it.
//
// Same INDEPENDENT-derivation discipline as landing.ts: deliberately NOT part of
// DerivedState — the golden arcs (backbone.golden) stay byte-identical; consumers
// call computeCriticalPath separately (the frontend store memoizes it next to
// derive()).
//
// Honesty note (what this is NOT): the path is the DEPENDENCY-longest chain over
// nominal durations (max(1, ceil(latestEstimate)) — agent lead time included
// unconditionally, PR-CRITPATH-AGENT), i.e. exactly the quantity the leveler
// prioritizes by. It is NOT the resource-gated chain that may actually bound the
// landing date (same-person serialization is c-leveling, not a dependency edge;
// per-node predicted starts are not exposed). MODEL:207 / D-42 keep "critical
// path" dependency-based; presentation must label it accordingly.
//
// Determinism: PR-CRITPATH-AGENT leaves "which path is longest" FREE; ties are
// broken by the leveler's own ready-queue rule (longer downstream first, then
// nodeId asc) so the surfaced chain matches what the leveler prefers to start.

import { sortEvents } from '../event-store.js';
import { fold } from '../fold.js';
import { nominalDurationDays, schedulableLeaves } from '../leveler.js';
import type { Event, NodeId } from '../types.js';
import { computeEffectiveSet } from './effective-set.js';

export interface CriticalPath {
  /** One deterministic maximal dependency chain, upstream → downstream. */
  path: NodeId[];
  /** Σ nominal duration days along the chain (0 when nothing is schedulable). */
  lengthDays: number;
}

export function computeCriticalPath(events: readonly Event[]): CriticalPath {
  const state = fold(sortEvents(events)); // (ts,id) total order — I3; input never mutated
  const eff = computeEffectiveSet(state);
  const schedulable = schedulableLeaves(state, eff);
  if (schedulable.length === 0) return { path: [], lengthDays: 0 };
  const schedSet = new Set(schedulable);

  // Dependency edges among the schedulable set only — the same slice the
  // leveler ranks over. Supersede edges are excluded by construction:
  // state.dependencyEdges holds edgeKind='dependency' only, and superseded
  // nodes have already left the effective set (R-S5).
  const succ = new Map<NodeId, NodeId[]>();
  for (const id of schedulable) succ.set(id, []);
  for (const e of state.dependencyEdges) {
    if (schedSet.has(e.from) && schedSet.has(e.to)) succ.get(e.from)?.push(e.to);
  }

  // Downstream longest-path length, memoized — mirrors leveler cp(). Acyclic by
  // I2 (fold rejects dependency cycles), so the recursion terminates.
  const cpMemo = new Map<NodeId, number>();
  const cp = (id: NodeId): number => {
    const cached = cpMemo.get(id);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const s of succ.get(id) ?? []) best = Math.max(best, cp(s));
    const value = nominalDurationDays(state, id) + best;
    cpMemo.set(id, value);
    return value;
  };

  // Deterministic pick: max cp, tie → nodeId asc (the leveler's sort rule).
  const best = (ids: readonly NodeId[]): NodeId =>
    ids.reduce((a, b) => (cp(b) - cp(a) > 0 || (cp(b) === cp(a) && b < a) ? b : a));

  const head = best(schedulable);
  const path: NodeId[] = [];
  let cur: NodeId = head;
  for (;;) {
    path.push(cur);
    const nexts = succ.get(cur) ?? [];
    if (nexts.length === 0) break;
    cur = best(nexts);
  }
  return { path, lengthDays: cp(head) };
}
