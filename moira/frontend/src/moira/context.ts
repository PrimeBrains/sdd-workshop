// The Moira app state shape + context object. Separated from the provider and
// hooks so each file has a single export kind (clean react-refresh boundaries).

import { createContext } from 'react';
import type {
  CapacityEntry,
  DerivedState,
  Event,
  IsoDate,
  LandingCurve,
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
  /** landing-forecast burnup (issue #13) — derived HERE, never in a surface. */
  landing: LandingCurve;
  /** R-T6 reference dates (boot-time fixture values; a reload re-resolves them). */
  deadline: IsoDate | null;
  targetDate: IsoDate | null;
  /** viewpoint actor id (fixture `me`, from `.moira/config.json`) — null unless served by `moira ui` (issue #12). */
  me: string | null;

  appendEvent: (event: Event) => void;
  appendCapacity: (entry: CapacityEntry) => void;
  /**
   * Replace the whole snapshot (both tiers) with a fresh read of the source —
   * the `moira ui` live bridge pushes re-reads of .moira/ through here. The
   * derivation chain re-runs exactly as for appends (R-S2: one derivation).
   */
  replaceSnapshot: (events: readonly Event[], capacity: readonly CapacityEntry[]) => void;
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
