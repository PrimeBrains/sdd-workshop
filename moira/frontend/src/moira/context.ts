// The Moira app state shape + context object. Separated from the provider and
// hooks so each file has a single export kind (clean react-refresh boundaries).

import { createContext } from 'react';
import type {
  CapacityEntry,
  DerivedState,
  Event,
  IsoDate,
  ProjectedState,
} from './engine';

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
   * preview and commit go through one engine, so no second-truth.
   */
  previewCapacity: (draft: readonly CapacityEntry[]) => DerivedState;
}

export const MoiraContext = createContext<MoiraState | null>(null);
