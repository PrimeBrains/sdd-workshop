// The one place derive()/fold() are called. The whole app reads this single
// DerivedState (metrics) + ProjectedState (per-node display attributes) via
// context (R-S2: one derivation, projected by every surface — never a second
// calculation). Appending an event or a capacity entry re-runs both — Moira's
// live re-derivation made literal.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

export interface MoiraState {
  /** append-only event log (tier 1) — the single source of truth (A2). */
  events: readonly Event[];
  /** c(i,d) history (tier 2, R-U14). */
  capacityEntries: readonly CapacityEntry[];
  /** reporting "now" — drives PV(t) and the forecast comparison. */
  asOf: IsoDate;
  /** the single derived state every surface projects (METRICS). */
  derived: DerivedState;
  /** projected state for per-node DISPLAY attributes (not metrics). */
  projected: ProjectedState;

  appendEvent: (event: Event) => void;
  appendCapacity: (entry: CapacityEntry) => void;
  setAsOf: (asOf: IsoDate) => void;
  /** next (ts, id) for a frontend-authored append — monotonic over the log. */
  nextStamp: () => { id: string; ts: number };
  /**
   * what-if: derive() with DRAFT capacity entries layered on top of the current
   * tier (UI-DESIGN-BRIEF §5.4). Runs the SAME derivation as the committed view —
   * preview and commit go through one engine, so no second-truth. derive() stays
   * here (the single allowed call site).
   */
  previewCapacity: (draft: readonly CapacityEntry[]) => DerivedState;
}

const MoiraContext = createContext<MoiraState | null>(null);

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
      setAsOf,
      nextStamp,
      previewCapacity,
    }),
    [events, capacityEntries, asOf, derived, projected, appendEvent, appendCapacity, nextStamp, previewCapacity],
  );

  return <MoiraContext.Provider value={value}>{children}</MoiraContext.Provider>;
}

export function useMoira(): MoiraState {
  const ctx = useContext(MoiraContext);
  if (ctx === null) throw new Error('useMoira must be used within a MoiraProvider');
  return ctx;
}

export function useDerived(): DerivedState {
  return useMoira().derived;
}
