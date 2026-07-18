// Ambient declarations for the backend RUNTIME modules we import.
//
// We deliberately do NOT add a broad `@backend/*` path mapping in tsconfig, so
// tsc resolves these specifiers via THESE declarations (typed from the
// self-contained types.ts) instead of walking the backend's NodeNext `.js`
// import graph (which would drag in node:fs typings). At runtime, the Vite
// `moira-backend-resolver` plugin maps `@backend/*` → ../backend/src/*.ts.

declare module '@backend/derive.js' {
  import type { CapacityLookup, DerivedState, Event, IsoDate } from '@backend/types';
  export interface DeriveOptions {
    asOf: IsoDate;
    capacityOf?: CapacityLookup;
    startDate?: IsoDate;
  }
  export function derive(events: readonly Event[], options: DeriveOptions): DerivedState;
}

declare module '@backend/fold.js' {
  import type { Event, ProjectedState } from '@backend/types';
  // Per-node projected attributes (assignee/estimate/budget/parent) for DISPLAY.
  // Metrics still come only from derive(); this is the allowed projection.
  export function fold(events: readonly Event[]): ProjectedState;
}

declare module '@backend/derivations/landing.js' {
  import type { CapacityLookup, Event, IsoDate, NodeId } from '@backend/types';
  export interface LandingPoint {
    date: IsoDate;
    pv: number;
    ev: number | null;
    forecast: number | null;
  }
  export interface LandingCurve {
    asOf: IsoDate;
    bac: number;
    points: LandingPoint[];
    landed: boolean;
    landingDate: IsoDate | null;
    unforecastedLeaves: NodeId[];
    forecastCoverage: number;
  }
  export interface LandingOptions {
    asOf: IsoDate;
    capacityOf?: CapacityLookup;
    startDate?: IsoDate;
    from?: IsoDate;
    to?: IsoDate;
  }
  export function computeLandingCurve(
    events: readonly Event[],
    opts: LandingOptions,
  ): LandingCurve;
}

declare module '@backend/derivations/critical-path.js' {
  import type { Event, NodeId } from '@backend/types';
  export interface CriticalPath {
    /** One deterministic maximal dependency chain, upstream → downstream. */
    path: NodeId[];
    /** Σ nominal duration days along the chain (0 when nothing is schedulable). */
    lengthDays: number;
  }
  export function computeCriticalPath(events: readonly Event[]): CriticalPath;
}

declare module '@backend/org-calendar.js' {
  import type { CapacityLookup, IsoDate } from '@backend/types';
  export interface BusinessDayOptions {
    /** Holiday set override (tests). Defaults to the committed JP data. */
    holidays?: ReadonlySet<string>;
    /** Coverage range of the holiday set (tests). */
    coverage?: { from: string; to: string };
    /** Sink for the out-of-coverage warning; default silent. */
    warn?: (msg: string) => void;
  }
  export function isWeekend(d: IsoDate): boolean;
  export function isBusinessDay(d: IsoDate, opts?: BusinessDayOptions): boolean;
  /** A CapacityLookup fallback (issue #32): business days get DEFAULT_CAPACITY,
   *  weekends/holidays get 0. Pass to CapacityStore.capacityOf/lookup or (here)
   *  makeCapacityLookup as `fallback`. */
  export function orgCalendarFallback(opts?: BusinessDayOptions): CapacityLookup;
}

declare module '@backend/fixtures/tiny-project.js' {
  import type { Event } from '@backend/types';
  export const tinyProjectEvents: readonly Event[];
  export const TINY_AS_OF: string;
}

declare module '@backend/derivations/planned-cost.js' {
  import type { NodeId, ProjectedState } from '@backend/types';
  export interface PlannedCostRow {
    node: NodeId;
    plannedCost: number;
  }
  export interface PlannedCostResult {
    /** Σ plannedCost over root nodes (== root's rollup for a single tree, robust for a forest). */
    total: number;
    byNode: PlannedCostRow[];
  }
  /** Post-order tree rollup of planned BUDGET (issue #34a): leaf = frozenBudget
   *  ?? latestEstimate ?? 0 (0 if cancelled/superseded); parent = Σ children. */
  export function computePlannedCost(state: ProjectedState): PlannedCostResult;
}

declare module '@backend/leveler.js' {
  import type { NodeId, ProjectedState } from '@backend/types';
  /** Nominal bar-length in days from the estimate (leveler's own duration
   *  function) — the single source the frontend's display geometry mirrors. */
  export function nominalDurationDays(state: ProjectedState, id: NodeId): number;
}
