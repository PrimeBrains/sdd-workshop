// (6) PV(t) — the time-phased baseline budget (§3 MODEL:194-204).
//
// PV(asOf) = Σ over agreed, scheduled, non-cancelled leaves whose frozen slot is
//            at or before `asOf`, of their frozen baseline budget.
//
// Three exclusions are ENFORCED (MODEL:197-199):
//   - scheduled-but-unagreed   → no budget addend (no frozenBudget). MODEL:198
//   - agreed-but-unscheduled   → no slot, stays out of PV.            MODEL:197
//   - completed-but-never-scheduled → in EV_abs (frozenBudget) but NOT in PV
//                                      (frozenSlot === null). MODEL:197
//
// PV reads ONLY the frozen dimensions — never latest/live. ISO date strings
// compare lexicographically, which is correct for 'YYYY-MM-DD'.

import type { IsoDate, ProjectedState } from '../types.js';
import type { EffectiveSet } from './effective-set.js';

export function computePv(
  state: ProjectedState,
  eff: EffectiveSet,
  asOf: IsoDate,
): number {
  let sum = 0;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    if (n.estimateState !== 'agreed') continue; // unagreed → no budget
    if (n.frozenSlot === null) continue; // unscheduled → no slot
    if (n.frozenBudget === null) continue;
    if (n.frozenSlot <= asOf) sum += n.frozenBudget;
  }
  return sum;
}
