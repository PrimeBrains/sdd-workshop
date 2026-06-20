// (2) EV% achievement and (3) EV_abs absolute earned value.
//
// P1 MODEL:164-166, R-U8 MODEL:235.
//   EV_abs = Σ over completed sub-units of their frozen baseline budget,
//            counting ONLY agreed work (R-U8). Unagreed-completed work is
//            excluded (R-U13 warning deferred, but the exclusion is ENFORCED).
//   EV%    = EV_abs / Σ(agreed effective leaves' LATEST estimate) ∈ [0,1].
//
// Numerator uses the FROZEN budget (I4-locked at completion, MODEL:200);
// denominator uses the LATEST estimate (drives EVM, MODEL:202). Both are read
// over the currently-effective leaf set (R-S5).

import type { ProjectedState } from '../types.js';
import type { EffectiveSet } from './effective-set.js';

const COMPLETED = new Set(['implemented', 'accepted']); // §2.5 MODEL:110, R-U13 MODEL:250

export function computeEvAbs(state: ProjectedState, eff: EffectiveSet): number {
  let sum = 0;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    if (n.estimateState !== 'agreed') continue; // R-U8: agreed only
    if (!COMPLETED.has(n.lifecycle)) continue; // completed only
    if (n.frozenBudget === null) continue; // unfixed budget excluded (R-U13)
    sum += n.frozenBudget;
  }
  return sum;
}

/**
 * Cumulative earned value — the distinct R-S5 read (MODEL:128): includes
 * superseded leaves (work was really done), excludes cancelled (R-C2 sunk,
 * MODEL:323). Over ALL leaves, not just the effective set.
 */
export function computeCumulativeEvAbs(state: ProjectedState): number {
  let sum = 0;
  for (const [id, n] of state.nodes) {
    if (n.lifecycle === 'cancelled') continue; // R-C2: sunk, excluded
    const kids = state.childrenOf.get(id) ?? [];
    if (kids.length > 0) continue; // leaves only (superseded leaves still count)
    if (n.estimateState !== 'agreed') continue;
    if (!COMPLETED.has(n.lifecycle)) continue;
    if (n.frozenBudget === null) continue;
    sum += n.frozenBudget;
  }
  return sum;
}

export function computeEvPercent(
  state: ProjectedState,
  eff: EffectiveSet,
  evAbs: number,
): number {
  let denom = 0;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    if (n.estimateState !== 'agreed') continue;
    if (n.latestEstimate === null) continue;
    denom += n.latestEstimate;
  }
  return denom > 0 ? evAbs / denom : 0;
}
