// MoiraProvider — the one place derive()/fold() are called. The whole app reads
// the single DerivedState (metrics) + ProjectedState (per-node display attributes)
// via context (R-S2: one derivation, projected by every surface — never a second
// calculation). Appending an event or a capacity entry re-runs both — Moira's
// live re-derivation made literal.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  derive,
  fold,
  type CapacityEntry,
  type DerivedState,
  type Event,
  type IsoDate,
  type ProjectedState,
} from './engine';
import { makeCapacityLookup } from './capacity';
import { MoiraContext, type MoiraState } from './context';

export interface MoiraProviderProps {
  initialEvents: readonly Event[];
  initialCapacity?: readonly CapacityEntry[];
  initialAsOf: IsoDate;
  children: ReactNode;
}

export function MoiraProvider({
  initialEvents,
  initialCapacity = [],
  initialAsOf,
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
      appendEvent,
      appendCapacity,
      replaceSnapshot,
      setAsOf,
      nextStamp,
      previewCapacity,
    }),
    [events, capacityEntries, asOf, derived, projected, appendEvent, appendCapacity, replaceSnapshot, nextStamp, previewCapacity],
  );

  return <MoiraContext.Provider value={value}>{children}</MoiraContext.Provider>;
}
