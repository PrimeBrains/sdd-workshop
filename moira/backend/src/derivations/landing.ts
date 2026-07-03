// (12) Landing-forecast burnup — the time-phased read behind "will we land in
// time?" (issue #13). Implements the §2.1#3 / R-T6 (MODEL:67, MODEL:233-240)
// reference-date reads on the DERIVATION side only: the deadline / target date
// themselves are second-tier configuration inputs (R-T6, stored outside the
// event log) and are compared against this curve by the PRESENTATION layer.
//
// This is an INDEPENDENT derivation, deliberately NOT part of DerivedState —
// the golden arcs (backbone.golden) stay byte-identical; consumers call
// computeLandingCurve separately (the frontend store memoizes it next to
// derive()).
//
// Three step curves share ONE currency — the frozen baseline budget (the same
// addend EV_abs earns, ev.ts / MODEL:200):
//
//   pv(d)       — the plan: computePv over the CURRENT log's frozen slots,
//                 evaluated at each date d (the PMB as a curve).
//   ev(d)       — the past (d ≤ asOf): EV_abs re-derived from the (ts,id)-
//                 ordered event PREFIX whose events fall on or before d
//                 (transaction time). Exact recomputation per day — never
//                 interpolation, never a fabricated history. Note this curve
//                 is honestly NON-monotone: it reports what derive() would
//                 have reported THEN, so a later supersede / lifecycle
//                 regression can make past points exceed present ones
//                 (P5-isomorphic honesty; PBT honesty properties).
//   forecast(d) — the future (d ≥ asOf): ev(asOf) + Σ frozen budgets of
//                 incomplete effective leaves whose leveler-predicted
//                 completion (P7/P8 live forecast, leveler.ts) is ≤ d.
//                 Predictions in the past are clamped to asOf — for still-open
//                 work the earliest honest landing is "now".
//
// Incomplete leaves with no prediction (unassigned / unestimated → leveler
// null) or no frozen budget (unagreed) CANNOT be forecast. Following MODEL:237
// they are NOT potted: they are excluded from the curve and surfaced via
// unforecastedLeaves + forecastCoverage so the forecast line honestly tops out
// below BAC and the consumer de-rates the read (R-S6-isomorphic discipline).
// landingDate is D_pred over the forecastable incomplete region (MODEL:234:
// max predicted completion); when NOTHING is forecastable it is null — a
// visible gap, not a guess (MODEL:238, P0).

import { maxDate } from '../dates.js';
import { defaultCapacityLookup } from '../capacity-store.js';
import { fold } from '../fold.js';
import { level } from '../leveler.js';
import { sortEvents } from '../event-store.js';
import type { CapacityLookup, Event, IsoDate, NodeId, ProjectedState } from '../types.js';
import { computeEffectiveSet } from './effective-set.js';
import { computeEvAbs } from './ev.js';
import { computePv } from './pv.js';

const COMPLETED = new Set(['implemented', 'accepted']); // §2.5 MODEL:110
/** Range guard — same 10-year cap philosophy as the leveler's MAX_DAYS. */
const MAX_RANGE_DAYS = 3650;

export interface LandingPoint {
  date: IsoDate;
  /** The plan (PMB as a curve): cumulative frozen budget by frozen slot ≤ date. */
  pv: number;
  /** The past: EV_abs of the event prefix on/before date. null for date > asOf. */
  ev: number | null;
  /** The future: ev(asOf) + forecastable budgets predicted ≤ date. null for date < asOf. */
  forecast: number | null;
}

export interface LandingCurve {
  asOf: IsoDate;
  /** Σ frozenBudget over agreed effective leaves — the curves' shared ceiling. */
  bac: number;
  /** Daily step points over [from, to]; every curve is exact, never interpolated. */
  points: LandingPoint[];
  /** No incomplete effective leaves remain. */
  landed: boolean;
  /**
   * D_pred over the forecastable incomplete region (MODEL:234 — max predicted
   * completion, clamped to ≥ asOf). null when landed=false and nothing is
   * forecastable (visible gap, MODEL:238). Read PAIRED with forecastCoverage.
   */
  landingDate: IsoDate | null;
  /** Incomplete effective leaves excluded from the forecast (no prediction / no budget). */
  unforecastedLeaves: NodeId[];
  /** forecastable incomplete leaves / incomplete leaves (count ratio; 1 when none incomplete). */
  forecastCoverage: number;
}

export interface LandingOptions {
  /** Reporting "now" — the ev/forecast seam. Required. */
  asOf: IsoDate;
  /** c(i,d) lookup; defaults to a constant 1.0 MD/day (MODEL:34). */
  capacityOf?: CapacityLookup;
  /** Live-forecast start; same default rule as derive.ts (earliest frozen slot, else asOf). */
  startDate?: IsoDate;
  /** Curve window; defaults derived from the data (slots / asOf / predictions). */
  from?: IsoDate;
  to?: IsoDate;
}

const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);

/** Epoch-ms → the UTC calendar day it falls on (matches dates.ts UTC arithmetic). */
const tsDay = (ts: number): IsoDate => new Date(ts).toISOString().slice(0, 10);

const dayDiff = (a: IsoDate, b: IsoDate): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** ISO-date successor without re-parsing (delegates to dates.ts semantics). */
const nextDay = (d: IsoDate): IsoDate => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

export function computeLandingCurve(
  events: readonly Event[],
  opts: LandingOptions,
): LandingCurve {
  const { asOf } = opts;
  const capacityOf = opts.capacityOf ?? defaultCapacityLookup;

  const sorted = sortEvents(events); // (ts,id) total order — I3; input never mutated
  const state = fold(sorted);
  const eff = computeEffectiveSet(state);

  // BAC + slot extremes over the effective leaves (what the curves draw).
  let bac = 0;
  let earliestSlot: IsoDate | undefined;
  let latestSlot: IsoDate | undefined;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    if (n.estimateState === 'agreed' && n.frozenBudget !== null) bac += n.frozenBudget;
    if (n.frozenSlot !== null) {
      if (earliestSlot === undefined || n.frozenSlot < earliestSlot) earliestSlot = n.frozenSlot;
      if (latestSlot === undefined || n.frozenSlot > latestSlot) latestSlot = n.frozenSlot;
    }
  }

  // Live forecast — leveler run ONCE on the full state (derive.ts startDate rule:
  // explicit → earliest frozen slot anywhere in the log → asOf).
  let startDate = opts.startDate;
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

  // Forecast accruals over INCOMPLETE effective leaves.
  const accruals: Array<{ date: IsoDate; budget: number }> = [];
  const unforecastedLeaves: NodeId[] = [];
  let incompleteCount = 0;
  let landingDate: IsoDate | null = null;
  for (const id of eff.effectiveLeaves) {
    const n = state.nodes.get(id);
    if (n === undefined) continue;
    if (COMPLETED.has(n.lifecycle)) continue;
    incompleteCount += 1;
    const predicted = levelResult.predicted.get(id) ?? null;
    if (predicted === null || n.frozenBudget === null) {
      unforecastedLeaves.push(id); // not potted — the visible gap (MODEL:237, P0)
      continue;
    }
    const accrueAt = maxDate(predicted, asOf); // past prediction ⇒ earliest honest landing is now
    accruals.push({ date: accrueAt, budget: n.frozenBudget });
    landingDate = landingDate === null ? accrueAt : maxDate(landingDate, accrueAt);
  }
  unforecastedLeaves.sort();
  accruals.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const landed = incompleteCount === 0;
  const forecastCoverage =
    incompleteCount === 0 ? 1 : (incompleteCount - unforecastedLeaves.length) / incompleteCount;

  // Window. from ≤ asOf ≤ to always holds (the ev/forecast seam is inside).
  let from = opts.from !== undefined ? minDate(opts.from, asOf) : asOf;
  if (opts.from === undefined && earliestSlot !== undefined) from = minDate(earliestSlot, asOf);
  let to = opts.to !== undefined ? maxDate(opts.to, asOf) : asOf;
  if (opts.to === undefined) {
    if (latestSlot !== undefined) to = maxDate(to, latestSlot);
    if (landingDate !== null) to = maxDate(to, landingDate);
  }
  if (dayDiff(from, to) > MAX_RANGE_DAYS) to = addRange(from, MAX_RANGE_DAYS);

  // ev(asOf) — the prefix on/before asOf (independent of the window walk).
  const evAtAsOf = evOfPrefix(sorted, asOf);

  // Daily walk. For past days the event prefix grows and is re-folded — exact
  // recomputation (log sizes are small; fold is O(n)); the leveler is NOT
  // re-run per day (it belongs to the single live forecast above).
  const points: LandingPoint[] = [];
  const prefix: Event[] = [];
  let evIdx = 0;
  let accIdx = 0;
  let accCum = 0;
  for (let d = from; d <= to; d = nextDay(d)) {
    let ev: number | null = null;
    if (d <= asOf) {
      while (evIdx < sorted.length && tsDay(sorted[evIdx]!.ts) <= d) {
        prefix.push(sorted[evIdx]!);
        evIdx += 1;
      }
      const st = fold(prefix);
      ev = computeEvAbs(st, computeEffectiveSet(st));
    }
    let forecast: number | null = null;
    if (d >= asOf) {
      while (accIdx < accruals.length && accruals[accIdx]!.date <= d) {
        accCum += accruals[accIdx]!.budget;
        accIdx += 1;
      }
      forecast = evAtAsOf + accCum;
    }
    points.push({ date: d, pv: computePv(state, eff, d), ev, forecast });
  }

  return { asOf, bac, points, landed, landingDate, unforecastedLeaves, forecastCoverage };
}

function evOfPrefix(sorted: readonly Event[], day: IsoDate): number {
  const prefix: Event[] = [];
  for (const e of sorted) {
    if (tsDay(e.ts) > day) break;
    prefix.push(e);
  }
  const st: ProjectedState = fold(prefix);
  return computeEvAbs(st, computeEffectiveSet(st));
}

function addRange(d: IsoDate, days: number): IsoDate {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
