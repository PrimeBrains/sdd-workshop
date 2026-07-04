// (11a) The live forecast schedule — P7/P8 greedy c-leveling (MODEL:183-191).
//
// Produces each schedulable sub-unit's predicted completion under the CURRENT
// latest estimate and CURRENT capacity c(i,d). This is the live forecast (EAC
// side), distinct from the frozen baseline slot (PMB side, read from the log)
// — the PMB-vs-EAC separation (MODEL:203). The baseline slot is NEVER recomputed
// here (resolves the P8 non-determinism concern, MODEL:190).
//
// Properties (all from the MODEL):
//   - c-leveled: each human's daily load ≤ c(i,d); c=0 days are skipped, so
//     calendar holes become schedule gaps (MODEL:184, MODEL:196).
//   - critical-path priority: ties broken by longest downstream path (P7 MODEL:184).
//   - heuristic / non-optimal: a feasible greedy fill, not an optimum (P8 MODEL:187).
//   - agents not leveled, but their lead time contributes to path length
//     regardless of successor kind — even a trailing agent with no successor
//     extends the derived completion; rate-limiting a human is the representative
//     case, not a precondition (R-T2 / P7).
//
// This is ONE legitimate concrete fill heuristic; the choice is implementation-
// dependent and disclosed, not removed (P8 MODEL:190).

import { addDays, maxDate } from './dates.js';
import type {
  CapacityLookup,
  IsoDate,
  NodeId,
  ProjectedState,
} from './types.js';
import type { EffectiveSet } from './derivations/effective-set.js';

export interface LevelResult {
  /** predicted completion per effective leaf; null if not schedulable. */
  predicted: Map<NodeId, IsoDate | null>;
}

const MAX_DAYS = 3650; // guard against an all-zero-capacity run
const EPSILON = 1e-9;

/**
 * Schedulable = effective leaves that are agreed, assigned, and estimated.
 * (Need an assignee to consume capacity and an estimate for a duration.)
 * Shared with derivations/critical-path.ts so the two never drift (issue #16).
 */
export function schedulableLeaves(state: ProjectedState, eff: EffectiveSet): NodeId[] {
  return eff.effectiveLeaves.filter((id) => {
    const n = state.nodes.get(id);
    return (
      n !== undefined &&
      n.assignee !== null &&
      n.estimateState === 'agreed' &&
      n.latestEstimate !== null
    );
  });
}

/**
 * Human nominal duration at full capacity = ceil(est / 1.0); agent lead
 * time = ceil(est) (P6/R-T2). Used for critical-path ranking only.
 * Shared with derivations/critical-path.ts (issue #16).
 */
export function nominalDurationDays(state: ProjectedState, id: NodeId): number {
  const n = state.nodes.get(id);
  const est = n?.latestEstimate ?? 0;
  return Math.max(1, Math.ceil(est));
}

export function level(
  state: ProjectedState,
  eff: EffectiveSet,
  capacityOf: CapacityLookup,
  startDate: IsoDate,
): LevelResult {
  const schedulable = schedulableLeaves(state, eff);
  const schedSet = new Set(schedulable);

  // Dependency edges among the schedulable set only (minimal slice: a
  // predecessor outside the set has no prediction to wait on).
  const edges = state.dependencyEdges.filter(
    (e) => schedSet.has(e.from) && schedSet.has(e.to),
  );

  const durationDays = (id: NodeId): number => nominalDurationDays(state, id);

  // Adjacency + in-degree over schedulable nodes.
  const succ = new Map<NodeId, NodeId[]>();
  const preds = new Map<NodeId, NodeId[]>();
  const indeg = new Map<NodeId, number>();
  for (const id of schedulable) {
    succ.set(id, []);
    preds.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    succ.get(e.from)?.push(e.to);
    preds.get(e.to)?.push(e.from);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }

  // Downstream critical-path length (longest path), memoized.
  const cpMemo = new Map<NodeId, number>();
  const cp = (id: NodeId): number => {
    const cached = cpMemo.get(id);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const s of succ.get(id) ?? []) best = Math.max(best, cp(s));
    const value = durationDays(id) + best;
    cpMemo.set(id, value);
    return value;
  };

  // Kahn topological order, picking the highest-CP ready node (tie: nodeId asc).
  const indegMut = new Map(indeg);
  const ready: NodeId[] = schedulable.filter((id) => (indegMut.get(id) ?? 0) === 0);
  const order: NodeId[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => cp(b) - cp(a) || (a < b ? -1 : a > b ? 1 : 0));
    const id = ready.shift();
    if (id === undefined) break;
    order.push(id);
    for (const s of succ.get(id) ?? []) {
      indegMut.set(s, (indegMut.get(s) ?? 0) - 1);
      if ((indegMut.get(s) ?? 0) === 0) ready.push(s);
    }
  }

  const predicted = new Map<NodeId, IsoDate | null>();
  // Per-human remaining capacity per date, consumed across all that human's tasks.
  const usedCapacity = new Map<string, number>();
  const capKey = (human: string, date: IsoDate): string => `${human}|${date}`;

  for (const id of order) {
    const n = state.nodes.get(id);
    if (n === undefined || n.assignee === null) {
      predicted.set(id, null);
      continue;
    }

    // Earliest start = max(predecessor predicted completion + 1 day, startDate).
    let start = startDate;
    for (const p of preds.get(id) ?? []) {
      const pc = predicted.get(p);
      if (pc) start = maxDate(start, addDays(pc, 1));
    }

    const est = n.latestEstimate ?? 0;

    if (n.assignee.kind === 'agent') {
      // Not leveled (R-U11): consume calendar days as lead time. This lead time
      // feeds successors' earliest-start AND the node's own predicted completion,
      // so it contributes to path length regardless of successor kind — a trailing
      // agent (no successor) still extends the derived completion (R-T2 / P7).
      const days = Math.max(1, Math.ceil(est));
      predicted.set(id, addDays(start, days - 1));
      continue;
    }

    // Human: greedy resource-leveled fill, capped at c(i,d) per day.
    const human = n.assignee.id;
    if (est <= EPSILON) {
      predicted.set(id, start);
      continue;
    }
    let remaining = est;
    let day = start;
    let completion: IsoDate | null = null;
    for (let guard = 0; guard < MAX_DAYS; guard += 1) {
      const cap = capacityOf(human, day);
      const key = capKey(human, day);
      const used = usedCapacity.get(key) ?? 0;
      const avail = cap - used;
      if (avail > EPSILON) {
        const take = Math.min(avail, remaining);
        usedCapacity.set(key, used + take);
        remaining -= take;
        if (remaining <= EPSILON) {
          completion = day;
          break;
        }
      }
      day = addDays(day, 1);
    }
    predicted.set(id, completion);
  }

  // Effective leaves that were not schedulable get a null forecast.
  for (const id of eff.effectiveLeaves) {
    if (!predicted.has(id)) predicted.set(id, null);
  }

  return { predicted };
}
