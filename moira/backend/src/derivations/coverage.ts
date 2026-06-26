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
 * coverage = |agreed effective leaves| / |known effective leaves|
 *            (P2 MODEL:181 — measured in LEAF count, over the effective set so
 *            superseded/cancelled nodes are not counted).
 *
 * Leaf-based (v18): leaves are where estimates are primitive (I1 — original
 * estimates are at leaves only) and where work is performed and EV is earned.
 * Intermediate (rollup) nodes are excluded: by I1 a parent's estimate is
 * Σ(agreed children), a derived quantity that is never an independent agreement
 * target (§7#14d), so counting parents in the denominator (the old node-basis)
 * made 100% structurally unreachable for any decomposed tree and contradicted
 * §7#14d. Sharing the leaf basis with EV% (P1), scheduleCoverage and
 * executionCoverage removes the lone basis asymmetry. The §2.3 discovery signal
 * is preserved: an impl leaf born unestimated enters the denominator and drops
 * coverage; est(impl) agreement recovers it. (A stray agreement on an
 * intermediate node — not structurally forbidden; the estimate-agreement branch
 * in fold.ts checks only I6 (actor kind) — is coverage-inert here, which is
 * correct: a parent's estimate is Σ(agreed children) by I1 *as a norm*, so a
 * parent agreement is redundant or stale. The reference fold does not recompute
 * that rollup, so such a stale parent estimateState/frozenBudget persists in the
 * node-state read but never in any leaf-based derivation — a pre-existing
 * I1-enforcement/presentation concern independent of P2. §7#17.)
 */
export function computeEstimateCoverage(
  state: ProjectedState,
  eff: EffectiveSet,
): number {
  const known = eff.effectiveLeaves.length;
  if (known === 0) return 0; // honest empty (P0)
  let agreed = 0;
  for (const id of eff.effectiveLeaves) {
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
