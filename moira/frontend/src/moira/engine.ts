// The single bridge to the Moira derivation engine. Everything the UI renders is
// a projection of derive()'s output — the SAME code the backend runs (R-S2,
// single source of truth). No metric is recomputed in the frontend.
//
// fold() is also re-exported: the UI reads per-node PROJECTED ATTRIBUTES
// (assignee / latestEstimate / frozenBudget / parent / ownCost) for display.
// That is a projection, not a metric recomputation (UI-DESIGN-BRIEF §0 用語精密化).

import { derive } from '@backend/derive.js';
import { computeLandingCurve } from '@backend/derivations/landing.js';
import type { LandingCurve, LandingOptions, LandingPoint } from '@backend/derivations/landing.js';
import { fold } from '@backend/fold.js';
import { tinyProjectEvents, TINY_AS_OF } from '@backend/fixtures/tiny-project.js';
import type {
  AcRow,
  ActivityRow,
  Actor,
  ActorKind,
  CapacityEntry,
  CapacityLookup,
  DependencyEdge,
  DerivedState,
  EstimateState,
  Event,
  ForecastRow,
  IsoDate,
  LifecycleState,
  NodeId,
  NodeStateRow,
  ProjectedNode,
  ProjectedState,
  SupersedeEdge,
} from '@backend/types';

export { computeLandingCurve, derive, fold, tinyProjectEvents, TINY_AS_OF };
export type { LandingCurve, LandingOptions, LandingPoint };
export type {
  AcRow,
  ActivityRow,
  Actor,
  ActorKind,
  CapacityEntry,
  CapacityLookup,
  DependencyEdge,
  DerivedState,
  EstimateState,
  Event,
  ForecastRow,
  IsoDate,
  LifecycleState,
  NodeId,
  NodeStateRow,
  ProjectedNode,
  ProjectedState,
  SupersedeEdge,
};
