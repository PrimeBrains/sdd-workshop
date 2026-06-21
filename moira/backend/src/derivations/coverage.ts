// (4) Estimate coverage (P2 MODEL:169) and (5) schedule coverage (R-S6 MODEL:295).
//
// These are the companion data for the two S4 pair-reads (validation-scenarios
// S4 line 31): EV% ↔ estimate coverage, SPI ↔ schedule coverage. The engine
// returns the raw ratios; the presenter de-rates (R-S4/R-S6) — that is the
// presentation responsibility deferred in the minimal slice, but the DATA is
// always provided.

import type { ProjectedState } from '../types.js';
import type { EffectiveSet } from './effective-set.js';

/**
 * coverage = |independently-agreed effective nodes| / |known effective nodes|
 *            (P2 MODEL:169 — measured in node count, over the effective set so
 *            superseded nodes are not double-counted).
 *
 * "Independently agreed" = the node carries its own agreement transition. Parent
 * nodes whose estimate is an I1 rollup are NOT agreed independently (they never
 * receive an estimate-agreement transition), so they correctly lower coverage
 * until decomposed work is itself agreed.
 */
export function computeEstimateCoverage(
  state: ProjectedState,
  eff: EffectiveSet,
): number {
  const known = eff.effectiveNodes.size;
  if (known === 0) return 0; // honest empty (P0)
  let agreed = 0;
  for (const id of eff.effectiveNodes) {
    const n = state.nodes.get(id);
    if (n !== undefined && n.estimateState === 'agreed') agreed += 1;
  }
  return agreed / known;
}

/**
 * scheduleCoverage = |agreed effective leaves with a frozen slot| /
 *                    |agreed effective leaves|
 *                    (R-S6 MODEL:295 — share of agreed work that is scheduled).
 * "Scheduled" = has a frozen baseline slot (first scheduling, §3② MODEL:194).
 */
export function computeScheduleCoverage(
  state: ProjectedState,
  eff: EffectiveSet,
): number {
  let agreed = 0;
  let scheduled = 0;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined || n.estimateState !== 'agreed') continue;
    agreed += 1;
    if (n.frozenSlot !== null) scheduled += 1;
  }
  return agreed > 0 ? scheduled / agreed : 0;
}

/**
 * executionCoverage = |agreed effective leaves in `implementing`| /
 *                     |agreed effective leaves|
 *                     (R-S8 MODEL:R-S8 — share of agreed work currently in
 *                     execution). Structurally isomorphic to scheduleCoverage,
 *                     with the predicate swapped (scheduled → implementing).
 *
 * It is a COUNT ratio over a state predicate — NOT a state-weight table folded
 * into EV (R-U8 governs the EV% derivation, not this read), and it touches none
 * of the EV_abs/EV%/PV/SPI/CPI formulas. It surfaces the in-execution region
 * that completion-based EV% omits; the presenter reads it paired with EV% and
 * estimateCoverage and NEVER sums it with EV% as overall progress (it is
 * in-progress volume, not earned value — R-S4/R-S6-isomorphic de-rate).
 */
export function computeExecutionCoverage(
  state: ProjectedState,
  eff: EffectiveSet,
): number {
  let agreed = 0;
  let implementing = 0;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined || n.estimateState !== 'agreed') continue;
    agreed += 1;
    if (n.lifecycle === 'implementing') implementing += 1;
  }
  return agreed > 0 ? implementing / agreed : 0;
}
