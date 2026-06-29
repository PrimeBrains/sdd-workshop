// derive() — the S4 orchestrator. Given the append-only event log and the c(i,d)
// lookup, it folds the log and assembles all 11 derivations (R-S2 MODEL:283).
//
// Re-derivation is triggered by event append AND by c changes (MODEL:283-284) —
// both are satisfied by simply calling derive() again with the updated inputs.

import { defaultCapacityLookup } from './capacity-store.js';
import { computeAc } from './derivations/ac.js';
import { computeActivityLog } from './derivations/activity.js';
import {
  computeEstimateCoverage,
  computeExecutionCoverage,
  computeScheduleCoverage,
} from './derivations/coverage.js';
import { computeEffectiveSet } from './derivations/effective-set.js';
import {
  computeCumulativeEvAbs,
  computeEvAbs,
  computeEvPercent,
} from './derivations/ev.js';
import {
  computeForecast,
  computeUnassignedBacklog,
} from './derivations/forecast.js';
import { computeCpi, computeSpi } from './derivations/indices.js';
import { computeNodeStates } from './derivations/node-states.js';
import { computePv } from './derivations/pv.js';
import { computeQueues } from './derivations/queues.js';
import { fold } from './fold.js';
import { level } from './leveler.js';
import type { CapacityLookup, DerivedState, Event, IsoDate } from './types.js';

export interface DeriveOptions {
  /** Reporting "now" — drives PV(t) and the forecast comparison. Required. */
  asOf: IsoDate;
  /** c(i,d) lookup; defaults to a constant 1.0 MD/day (MODEL:34). */
  capacityOf?: CapacityLookup;
  /**
   * Project start for the live forecast. If omitted, the earliest frozen slot in
   * the log (the project's planned start), else `asOf`.
   */
  startDate?: IsoDate;
}

export function derive(events: readonly Event[], options: DeriveOptions): DerivedState {
  const { asOf } = options;
  const capacityOf = options.capacityOf ?? defaultCapacityLookup;

  const state = fold(events);
  const eff = computeEffectiveSet(state);

  const evAbs = computeEvAbs(state, eff);
  const cumulativeEvAbs = computeCumulativeEvAbs(state);
  const evPercent = computeEvPercent(state, eff, evAbs);

  const estimateCoverage = computeEstimateCoverage(state, eff);
  const scheduleCoverage = computeScheduleCoverage(state, eff);
  const executionCoverage = computeExecutionCoverage(state, eff);

  const pv = computePv(state, eff, asOf);
  const { total: ac, byNode: acByNode } = computeAc(state);

  const spi = computeSpi(evAbs, pv);
  const cpi = computeCpi(evAbs, ac);

  const { agentWorkQueue, humanReviewQueue } = computeQueues(state, eff);

  let startDate = options.startDate;
  if (startDate === undefined) {
    let earliest: IsoDate | undefined;
    for (const n of state.nodes.values()) {
      if (n.frozenSlot !== null && (earliest === undefined || n.frozenSlot < earliest)) {
        earliest = n.frozenSlot;
      }
    }
    startDate = earliest ?? asOf;
  }
  const levelResult = level(state, eff, capacityOf, startDate);
  const forecast = computeForecast(state, eff, levelResult);
  const unassignedBacklog = computeUnassignedBacklog(state, eff);

  const nodeStates = computeNodeStates(state);
  const activityLog = computeActivityLog(events);

  return {
    asOf,
    nodeStates,
    evPercent,
    evAbs,
    cumulativeEvAbs,
    estimateCoverage,
    scheduleCoverage,
    executionCoverage,
    pv,
    ac,
    acByNode,
    spi,
    spiScheduleCoverage: scheduleCoverage,
    cpi,
    agentWorkQueue,
    humanReviewQueue,
    forecast,
    unassignedBacklog,
    activityLog,
    effectiveLeaves: eff.effectiveLeaves,
    structuralErrors: state.structuralErrors,
  };
}
