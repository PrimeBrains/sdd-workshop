// (15) Milestone rollup — per-milestone EVM + landing read over an arbitrary
// NAMED BUNDLE of node ids (issue #35). A milestone is DELIBERATELY minimal:
// a name + a set of constituent node ids. It carries NO due date and NO buffer
// of its own — MODEL §7#12 explicitly deferred that (a canon amendment would be
// required to add one), so this file must never grow a date/buffer INPUT field.
// The milestone's "planned end" / "forecast end" below are DERIVED reads, never
// stored inputs.
//
// Same INDEPENDENT-derivation discipline as feature-rollup.ts / landing.ts /
// critical-path.ts: deliberately NOT part of DerivedState and NOT wired into
// derive.ts — the golden arcs (backbone.golden) stay byte-identical; consumers
// (moira/cli's `moira report`) call computeMilestoneRollup separately.
//
// Attribution generalizes feature-rollup's rootChildAncestor: instead of a
// single fixed anchor (the root's direct children), a milestone supplies a SET
// of anchor node ids, and every effective leaf whose ancestor chain (leaf
// itself included) hits ANY id in that set is attributed to the milestone —
// i.e. "every effective leaf under any of these subtrees". Anchor ids that are
// themselves a descendant of another anchor id IN THE SAME MILESTONE are
// dropped first (computeTopLevelIds) so AC — which is read directly off
// ac.ts's already-recursive byNode total per anchor id — is never double
// counted. The same milestone's leaf/EV/PV/BAC slice is computed by handing
// the attributed effective-leaf list to the EXACT engine formulas
// (computeEvAbs/computeEvPercent/computePv), exactly like feature-rollup.ts —
// EV semantics are never re-implemented here.
//
// A node MAY appear in more than one milestone (e.g. a shared foundational
// leaf feeding two deliverables). This is a READ-ONLY view over the tree, not
// an accounting ledger: the engine's own EV_abs is computed once, over the
// effective set, in derive()/ev.ts — nothing here double-books it. Rows here
// may sum to MORE than the project total when milestones overlap, and that is
// by design (R-U8/R-S5 stay owned by the engine; this is just a lens).
//
// The "planned end" (baseline) and "forecast end" (live) dates are DERIVED
// reads, not milestone inputs:
//   plannedEnd  = max frozenSlot over the milestone's effective leaves (the
//                 PMB read, pv.ts-isomorphic — MODEL §3②).
//   forecastEnd = max predictedCompletion over the milestone's INCOMPLETE
//                 effective leaves (landing.ts-isomorphic exclusion: the
//                 leveler still assigns a "prediction" to an already-completed
//                 leaf — schedulableLeaves ignores lifecycle — so including it
//                 would let a phantom re-schedule of finished work dishonestly
//                 push a milestone's forecast end out), taken from the
//                 CALLER-SUPPLIED forecast rows (the SAME single leveler run
//                 derive() already performed for the whole project — see
//                 forecast.ts / leveler.ts). This function deliberately does
//                 NOT call level() again: re-leveling a subset would silently
//                 ignore resource contention with work OUTSIDE the milestone
//                 and produce an over-optimistic, unfaithful partial schedule.
//                 Pass `derive(...).forecast`.
// bottleneckLeaf is the leaf whose predictedCompletion equals forecastEnd —
// the pacing item — with a flag for whether it sits on the project's single
// deterministic critical-path chain (computeCriticalPath).

import { sortEvents } from '../event-store.js';
import { fold } from '../fold.js';
import type { Event, ForecastRow, IsoDate, NodeId, ProjectedState } from '../types.js';
import { computeAc } from './ac.js';
import { computeCriticalPath } from './critical-path.js';
import { computeEffectiveSet } from './effective-set.js';
import { computeEvAbs, computeEvPercent } from './ev.js';
import { computeCpi, computeSpi } from './indices.js';
import { computePv } from './pv.js';

const COMPLETED = new Set(['implemented', 'accepted']); // §2.5 — mirrors ev.ts / feature-rollup.ts

/** A milestone is a name + a set of constituent node ids. No date, no buffer. */
export interface MilestoneDefinition {
  name: string;
  nodes: readonly NodeId[];
}

export interface MilestoneRollupOptions {
  /** Reporting "now" — drives PV(t), the same seam as derive()'s asOf. Required. */
  asOf: IsoDate;
}

export interface MilestoneRollupRow {
  milestone: string;
  /** Engine EV over this milestone's attributed leaf slice (R-U8 agreed-completed). */
  evAbs: number;
  /** Engine EV% over the same slice. */
  evPercent: number;
  /** PV(asOf) over the same slice (pv.ts, unchanged formula). */
  pv: number;
  /** AC over the milestone's top-level anchor ids, summed from ac.ts's byNode (never re-derived). */
  ac: number;
  /** Σ agreed effective leaves' frozenBudget in the slice — the BAC (landing.ts-isomorphic). */
  bac: number;
  /** SPI = EV_abs / PV over the slice (null when PV = 0). */
  spi: number | null;
  /** CPI = EV_abs / AC over the slice (null when AC = 0). */
  cpi: number | null;
  /** Effective leaves attributed to this milestone (R-S5). */
  leafCount: number;
  /** Baseline: max frozenSlot over the slice's leaves. null when none scheduled. */
  plannedEnd: IsoDate | null;
  /** Live forecast: max predictedCompletion over the slice's INCOMPLETE leaves
   *  (completed leaves' leveler predictions are phantoms — excluded, landing.ts-
   *  isomorphic), from the caller's forecast rows (one project-wide leveler run —
   *  never re-leveled here). null when nothing incomplete remains. */
  forecastEnd: IsoDate | null;
  /** The INCOMPLETE leaf whose predictedCompletion == forecastEnd (the pacing leaf). null iff forecastEnd is null. */
  bottleneckLeaf: NodeId | null;
  /** Whether bottleneckLeaf sits on computeCriticalPath(events)'s single deterministic chain. */
  bottleneckOnCriticalPath: boolean;
}

/**
 * Compute the per-milestone EVM + landing rollup. `forecast` MUST come from a
 * single derive() call over the SAME events (or an equivalent one-shot
 * computeForecast/level result) — see the file-header rationale for why this
 * function never calls level() itself. Rows are sorted by milestone name for
 * determinism. A milestone whose `nodes` resolves to zero effective leaves
 * (unknown ids, an empty bundle / "解散", or a fully superseded/cancelled
 * subtree) is an honest all-zero/null row, never a thrown error.
 */
export function computeMilestoneRollup(
  events: readonly Event[],
  milestones: readonly MilestoneDefinition[],
  forecast: readonly ForecastRow[],
  opts: MilestoneRollupOptions,
): MilestoneRollupRow[] {
  const state = fold(sortEvents(events)); // (ts,id) total order — I3; input never mutated
  const eff = computeEffectiveSet(state);
  const { byNode: acByNode } = computeAc(state);
  const acOf = new Map(acByNode.map((r) => [r.node, r.ac]));
  const predictedOf = new Map(forecast.map((r) => [r.node, r.predictedCompletion]));
  const criticalPath = new Set(computeCriticalPath(events).path);

  const rows: MilestoneRollupRow[] = [];
  for (const m of [...milestones].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const topLevel = computeTopLevelIds(state, m.nodes);
    const topLevelSet = new Set(topLevel);
    const leaves = eff.effectiveLeaves.filter((leaf) => attributedTo(state, leaf, topLevelSet));

    const slice = { ...eff, effectiveLeaves: leaves };
    const evAbs = computeEvAbs(state, slice);
    const evPercent = computeEvPercent(state, slice, evAbs);
    const pv = computePv(state, slice, opts.asOf);

    let ac = 0;
    for (const id of topLevel) ac += acOf.get(id) ?? 0;

    let bac = 0;
    let plannedEnd: IsoDate | null = null;
    let forecastEnd: IsoDate | null = null;
    let bottleneckLeaf: NodeId | null = null;
    for (const id of leaves) {
      const n = state.nodes.get(id);
      if (n === undefined) continue;
      if (n.estimateState === 'agreed' && n.frozenBudget !== null) bac += n.frozenBudget;
      if (n.frozenSlot !== null && (plannedEnd === null || n.frozenSlot > plannedEnd)) {
        plannedEnd = n.frozenSlot;
      }
      // Forecast end / bottleneck: INCOMPLETE leaves only (landing.ts-isomorphic
      // — R-S5). A completed leaf's leveler prediction is a PHANTOM: the
      // leveler still schedules it (schedulableLeaves doesn't look at
      // lifecycle), so letting it into this max would dishonestly report a
      // milestone as still pacing on work that already shipped.
      if (COMPLETED.has(n.lifecycle)) continue;
      // leaves is ascending-sorted (effective-set.ts sorts effectiveLeaves), so a
      // STRICT '>' here means the first leaf to reach a given max wins ties —
      // the smallest nodeId — without any extra tie-break logic.
      const predicted = predictedOf.get(id) ?? null;
      if (predicted !== null && (forecastEnd === null || predicted > forecastEnd)) {
        forecastEnd = predicted;
        bottleneckLeaf = id;
      }
    }

    const spi = computeSpi(evAbs, pv);
    const cpi = computeCpi(evAbs, ac);

    rows.push({
      milestone: m.name,
      evAbs,
      evPercent,
      pv,
      ac,
      bac,
      spi,
      cpi,
      leafCount: leaves.length,
      plannedEnd,
      forecastEnd,
      bottleneckLeaf,
      bottleneckOnCriticalPath: bottleneckLeaf !== null && criticalPath.has(bottleneckLeaf),
    });
  }
  return rows;
}

/**
 * Drop any id that is a (transitive) descendant of another id in the SAME
 * `nodes` set — a redundant anchor whose subtree the ancestor already covers.
 * Prevents double-counting AC (each surviving id's byNode total is disjoint
 * from every other surviving id's). Unknown ids (not in state.nodes) are
 * dropped silently — the CLI layer is responsible for warning about them.
 */
function computeTopLevelIds(state: ProjectedState, nodes: readonly NodeId[]): NodeId[] {
  const set = new Set(nodes.filter((id) => state.nodes.has(id)));
  const top: NodeId[] = [];
  for (const id of set) {
    let cur = state.nodes.get(id)?.parent ?? null;
    const seen = new Set<NodeId>(); // safety bound, same cycle guard as feature-rollup's walk
    let shadowed = false;
    while (cur !== null && !seen.has(cur)) {
      if (set.has(cur)) {
        shadowed = true;
        break;
      }
      seen.add(cur);
      cur = state.nodes.get(cur)?.parent ?? null;
    }
    if (!shadowed) top.push(id);
  }
  return top.sort();
}

/** Does `leaf`'s ancestor chain (itself included) hit any id in `anchors`? */
function attributedTo(state: ProjectedState, leaf: NodeId, anchors: Set<NodeId>): boolean {
  let cur: NodeId | null = leaf;
  const seen = new Set<NodeId>();
  while (cur !== null && !seen.has(cur)) {
    if (anchors.has(cur)) return true;
    seen.add(cur);
    cur = state.nodes.get(cur)?.parent ?? null;
  }
  return false;
}
