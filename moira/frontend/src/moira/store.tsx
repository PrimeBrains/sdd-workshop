// MoiraProvider — the one place derive()/fold() are called. The whole app reads
// the single DerivedState (metrics) + ProjectedState (per-node display attributes)
// via context (R-S2: one derivation, projected by every surface — never a second
// calculation). Appending an event or a capacity entry re-runs both — Moira's
// live re-derivation made literal.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  computeCriticalPath,
  computeLandingCurve,
  derive,
  fold,
  type CapacityEntry,
  type CriticalPath,
  type DerivedState,
  type Event,
  type IsoDate,
  type LandingCurve,
  type ProjectedState,
} from './engine';
import { makeCapacityLookup } from './capacity';
import { MoiraContext, type MoiraState } from './context';

export interface MoiraProviderProps {
  initialEvents: readonly Event[];
  initialCapacity?: readonly CapacityEntry[];
  initialAsOf: IsoDate;
  /** R-T6 reference dates — boot constants from the fixture (issue #13). */
  initialDeadline?: IsoDate | null;
  initialTargetDate?: IsoDate | null;
  /** viewpoint actor id — from the fixture `me` (issue #12); null unless served by `moira ui`. */
  initialMe?: string | null;
  children: ReactNode;
}

export function MoiraProvider({
  initialEvents,
  initialCapacity = [],
  initialAsOf,
  initialDeadline = null,
  initialTargetDate = null,
  initialMe = null,
  children,
}: MoiraProviderProps) {
  const [events, setEvents] = useState<readonly Event[]>(initialEvents);
  const [capacityEntries, setCapacityEntries] =
    useState<readonly CapacityEntry[]>(initialCapacity);
  const [asOf, setAsOf] = useState<IsoDate>(initialAsOf);

  const projected = useMemo<ProjectedState>(() => fold(events), [events]);

  const derived = useMemo<DerivedState>(() => {
    const capacityOf = makeCapacityLookup(capacityEntries);
    return derive(events, { asOf, capacityOf });
  }, [events, capacityEntries, asOf]);

  // Landing-forecast burnup (issue #13) — same single-derivation discipline as
  // derive(): computed once here, projected by surfaces (never recomputed there).
  const landing = useMemo<LandingCurve>(() => {
    const capacityOf = makeCapacityLookup(capacityEntries);
    return computeLandingCurve(events, { asOf, capacityOf });
  }, [events, capacityEntries, asOf]);

  // P7 dependency longest chain (issue #16) — same single-derivation discipline:
  // computed once here, projected by surfaces (never recomputed there).
  const criticalPath = useMemo<CriticalPath>(() => computeCriticalPath(events), [events]);

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

  const nextStamp = useCallback(() => {
    let maxTs = 0;
    for (const e of events) if (e.ts > maxTs) maxTs = e.ts;
    const ts = maxTs + 1;
    return { id: `u${ts}`, ts };
  }, [events]);

  const previewCapacity = useCallback(
    (draft: readonly CapacityEntry[]): DerivedState => {
      const capacityOf = makeCapacityLookup([...capacityEntries, ...draft]);
      return derive(events, { asOf, capacityOf });
    },
    [events, capacityEntries, asOf],
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
      deadline: initialDeadline,
      targetDate: initialTargetDate,
      me: initialMe,
      appendEvent,
      appendCapacity,
      replaceSnapshot,
      setAsOf,
      nextStamp,
      previewCapacity,
    }),
    [events, capacityEntries, asOf, derived, projected, landing, criticalPath, initialDeadline, initialTargetDate, initialMe, appendEvent, appendCapacity, replaceSnapshot, nextStamp, previewCapacity],
  );

  return <MoiraContext.Provider value={value}>{children}</MoiraContext.Provider>;
}
