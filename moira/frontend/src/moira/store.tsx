// MoiraProvider — the one place derive()/fold() are called. The whole app reads
// the single DerivedState (metrics) + ProjectedState (per-node display attributes)
// via context (R-S2: one derivation, projected by every surface — never a second
// calculation). Appending an event or a capacity entry re-runs both — Moira's
// live re-derivation made literal.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  computeCriticalPath,
  computeLandingCurve,
  computePlannedCost,
  derive,
  fold,
  orgCalendarFallback,
  type CapacityEntry,
  type CapacityLookup,
  type CriticalPath,
  type DerivedState,
  type Event,
  type IsoDate,
  type LandingCurve,
  type PlannedCostResult,
  type ProjectedState,
} from './engine';
import { makeCapacityLookup } from './capacity';
import { MoiraContext, type MoiraState } from './context';

/**
 * The ONE `!== false` default-on resolution rule (issue #32): a RAW fixture
 * value (`.moira/config.json` `orgCalendar.enabled`, `undefined` when unset)
 * resolves to the boolean every derivation below actually uses. Both the
 * initial mount (`initialOrgCalendarEnabled`) AND a later live update
 * (`setOrgCalendarEnabled`) call through this SAME function — so the update
 * path can never drift from the mount-time discipline (never a second,
 * independently-written `!== false` elsewhere).
 */
export function resolveOrgCalendarEnabled(raw: boolean | undefined): boolean {
  return raw !== false;
}

export interface MoiraProviderProps {
  initialEvents: readonly Event[];
  initialCapacity?: readonly CapacityEntry[];
  initialAsOf: IsoDate;
  /** R-T6 reference dates — boot constants from the fixture (issue #13). */
  initialDeadline?: IsoDate | null;
  initialTargetDate?: IsoDate | null;
  /** viewpoint actor id — from the fixture `me` (issue #12); null unless served by `moira ui`. */
  initialMe?: string | null;
  /** org calendar (weekends + JP holidays) c(i,d) fallback (issue #32) — from
   *  the fixture `orgCalendarEnabled` (.moira/config.json `orgCalendar.enabled`).
   *  UNSET/omitted → enabled (default-on), same `!== false` discipline as the CLI. */
  initialOrgCalendarEnabled?: boolean;
  children: ReactNode;
}

export function MoiraProvider({
  initialEvents,
  initialCapacity = [],
  initialAsOf,
  initialDeadline = null,
  initialTargetDate = null,
  initialMe = null,
  initialOrgCalendarEnabled,
  children,
}: MoiraProviderProps) {
  const [events, setEvents] = useState<readonly Event[]>(initialEvents);
  const [capacityEntries, setCapacityEntries] =
    useState<readonly CapacityEntry[]>(initialCapacity);
  const [asOf, setAsOf] = useState<IsoDate>(initialAsOf);

  // State (not a plain derived const): a live-updated drill-down (portfolio
  // issue #32 follow-up) needs a path to push a FRESH raw fixture value in
  // after mount, via setOrgCalendarEnabled below — replaceSnapshot's
  // events/capacity swap has no room for a third concern, so this gets its
  // own setter, resolved through the SAME `!== false` rule as the initial
  // value (never a second resolution site).
  const [orgCalendarEnabled, setOrgCalendarEnabledResolved] = useState<boolean>(() =>
    resolveOrgCalendarEnabled(initialOrgCalendarEnabled),
  );
  // Org calendar fallback (issue #32): default-on, so unspecified weekends/JP
  // holidays resolve to 0 capacity instead of a blanket 1.0 — the SAME
  // capacityOf every derivation below shares (R-S2: one derivation surface).
  // Memoized on [orgCalendarEnabled] only: orgCalendarFallback() mints a new
  // closure per call, so computing it inline (a new identity every render)
  // would defeat the derived/landing/previewCapacity useMemo/useCallback deps
  // below and re-derive on every render, not just on real input changes.
  const capacityFallback = useMemo<CapacityLookup | undefined>(
    () => (orgCalendarEnabled ? orgCalendarFallback() : undefined),
    [orgCalendarEnabled],
  );

  const projected = useMemo<ProjectedState>(() => fold(events), [events]);

  // The ONE c(i,d) lookup for the committed tier (R-S2) — built once here and
  // reused by BOTH derivations below AND exposed via context, so a surface's
  // display lookup (e.g. CapacitySurface's heatmap) is the SAME closure, never
  // a second `makeCapacityLookup` built locally that could silently disagree
  // with what was actually derived (issue #32 drill-down fix). previewCapacity
  // below still builds its OWN lookup — it layers UNCOMMITTED draft entries on
  // top, which this committed-tier lookup must never reflect.
  const capacityOf = useMemo<CapacityLookup>(
    () => makeCapacityLookup(capacityEntries, capacityFallback),
    [capacityEntries, capacityFallback],
  );

  const derived = useMemo<DerivedState>(
    () => derive(events, { asOf, capacityOf }),
    [events, asOf, capacityOf],
  );

  // Landing-forecast burnup (issue #13) — same single-derivation discipline as
  // derive(): computed once here, projected by surfaces (never recomputed there).
  const landing = useMemo<LandingCurve>(
    () => computeLandingCurve(events, { asOf, capacityOf }),
    [events, asOf, capacityOf],
  );

  // P7 dependency longest chain (issue #16) — same single-derivation discipline:
  // computed once here, projected by surfaces (never recomputed there).
  const criticalPath = useMemo<CriticalPath>(() => computeCriticalPath(events), [events]);

  // Planned-cost tree rollup (issue #34a) — same single-derivation discipline:
  // computed once here (from `projected`; an independent derivation, not part of
  // DerivedState), projected by schedule-time (never recomputed there).
  const plannedCost = useMemo<PlannedCostResult>(() => computePlannedCost(projected), [projected]);

  const appendEvent = useCallback((event: Event) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const appendCapacity = useCallback((entry: CapacityEntry) => {
    setCapacityEntries((prev) => [...prev, entry]);
  }, []);

  const replaceSnapshot = useCallback(
    (nextEvents: readonly Event[], nextCapacity: readonly CapacityEntry[]) => {
      setEvents(nextEvents);
      setCapacityEntries(nextCapacity);
    },
    [],
  );

  // The replaceSnapshot-equivalent port for org-calendar setting live updates
  // (issue #32 drill-down follow-up): takes the RAW fixture value (mirrors
  // `initialOrgCalendarEnabled`) and resolves it via the SAME `!== false`
  // discipline as the initial mount — a caller (DrillSyncBridge) pushes a
  // fresh per-project value without re-deriving the boolean itself.
  const setOrgCalendarEnabled = useCallback((raw: boolean | undefined) => {
    setOrgCalendarEnabledResolved(resolveOrgCalendarEnabled(raw));
  }, []);

  const nextStamp = useCallback(() => {
    let maxTs = 0;
    for (const e of events) if (e.ts > maxTs) maxTs = e.ts;
    const ts = maxTs + 1;
    return { id: `u${ts}`, ts };
  }, [events]);

  const previewCapacity = useCallback(
    (draft: readonly CapacityEntry[]): DerivedState => {
      // A SEPARATE lookup, deliberately not `capacityOf` above: this layers
      // UNCOMMITTED draft entries on top of the committed tier for the what-if
      // preview, which the committed-tier `capacityOf` must never reflect.
      const draftCapacityOf = makeCapacityLookup([...capacityEntries, ...draft], capacityFallback);
      return derive(events, { asOf, capacityOf: draftCapacityOf });
    },
    [events, capacityEntries, asOf, capacityFallback],
  );

  const value = useMemo<MoiraState>(
    () => ({
      events,
      capacityEntries,
      asOf,
      derived,
      projected,
      landing,
      criticalPath,
      plannedCost,
      deadline: initialDeadline,
      targetDate: initialTargetDate,
      me: initialMe,
      orgCalendarEnabled,
      capacityOf,
      appendEvent,
      appendCapacity,
      replaceSnapshot,
      setOrgCalendarEnabled,
      setAsOf,
      nextStamp,
      previewCapacity,
    }),
    [events, capacityEntries, asOf, derived, projected, landing, criticalPath, plannedCost, initialDeadline, initialTargetDate, initialMe, orgCalendarEnabled, capacityOf, appendEvent, appendCapacity, replaceSnapshot, setOrgCalendarEnabled, nextStamp, previewCapacity],
  );

  return <MoiraContext.Provider value={value}>{children}</MoiraContext.Provider>;
}
