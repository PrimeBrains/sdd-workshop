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

declare module '@backend/fixtures/tiny-project.js' {
  import type { Event } from '@backend/types';
  export const tinyProjectEvents: readonly Event[];
  export const TINY_AS_OF: string;
}
