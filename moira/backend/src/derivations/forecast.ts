// (11b) Live forecast rows + (11c) unassigned backlog.
//
// Each effective leaf gets a forecast row carrying BOTH the live predicted
// completion (from the leveler) and the frozen baseline slot — so a consumer
// can read R-S7 slot-staleness divergence (warning deferred, data surfaced;
// MODEL:298). The unassigned backlog is the P0 visible gap: agreed work with no
// assignee (MODEL:104, MODEL:160).

import type { ForecastRow, NodeId, ProjectedState } from '../types.js';
import type { EffectiveSet } from './effective-set.js';
import type { LevelResult } from '../leveler.js';

export function computeForecast(
  state: ProjectedState,
  eff: EffectiveSet,
  level: LevelResult,
): ForecastRow[] {
  const rows: ForecastRow[] = [];
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    rows.push({
      node: id,
      predictedCompletion: level.predicted.get(id) ?? null,
      predictedStart: level.predictedStart.get(id) ?? null,
      frozenSlot: n.frozenSlot,
    });
  }
  rows.sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));
  return rows;
}

export function computeUnassignedBacklog(
  state: ProjectedState,
  eff: EffectiveSet,
): NodeId[] {
  const out: NodeId[] = [];
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n !== undefined && n.estimateState === 'agreed' && n.assignee === null) {
      out.push(id);
    }
  }
  return out.sort();
}
