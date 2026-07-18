// The Moira app state shape + context object. Separated from the provider and
// hooks so each file has a single export kind (clean react-refresh boundaries).

import { createContext } from 'react';
import type {
  CapacityEntry,
  CapacityLookup,
  CriticalPath,
  DerivedState,
  Event,
  IsoDate,
  LandingCurve,
  PlannedCostResult,
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
  /** P7 dependency longest chain (issue #16) — derived HERE, never in a surface. */
  criticalPath: CriticalPath;
  /** planned-cost tree rollup (issue #34a) — derived HERE (from `projected`,
   *  independent of derive()/DerivedState), never recomputed in a surface. */
  plannedCost: PlannedCostResult;
  /** R-T6 reference dates (boot-time fixture values; a reload re-resolves them). */
  deadline: IsoDate | null;
  targetDate: IsoDate | null;
  /** viewpoint actor id (fixture `me`, from `.moira/config.json`) — null unless served by `moira ui` (issue #12). */
  me: string | null;
  /** org calendar (weekends + JP holidays) as the c(i,d) fallback (issue #32),
   *  from fixture `orgCalendarEnabled` (.moira/config.json `orgCalendar.enabled`).
   *  UNSET/absent fixture value → treated as enabled (default-on). */
  orgCalendarEnabled: boolean;
  /** the ONE c(i,d) lookup every derivation above shares (R-S2) — over the
   *  committed `capacityEntries` tier with the org-calendar fallback already
   *  applied. Surfaces read c(i,d) display values through THIS (never build a
   *  second lookup locally), so a surface's display can never disagree with
   *  what derive()/landing actually computed from (issue #32 drill-down fix). */
  capacityOf: CapacityLookup;

  appendEvent: (event: Event) => void;
  appendCapacity: (entry: CapacityEntry) => void;
  /**
   * Replace the whole snapshot (both tiers) with a fresh read of the source —
   * the `moira ui` live bridge pushes re-reads of .moira/ through here. The
   * derivation chain re-runs exactly as for appends (R-S2: one derivation).
   */
  replaceSnapshot: (events: readonly Event[], capacity: readonly CapacityEntry[]) => void;
  /**
   * Update the org-calendar setting from a fresh RAW fixture value (mirrors
   * `initialOrgCalendarEnabled` — pass the fixture's `orgCalendarEnabled`
   * unresolved). The `!== false` default-on resolution happens HERE (store.tsx),
   * the same single place the initial mount resolves it — a caller must never
   * re-derive the boolean itself (issue #32 drill-down live-update fix).
   */
  setOrgCalendarEnabled: (raw: boolean | undefined) => void;
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
