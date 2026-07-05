// Portfolio state shape + context (issue #23). Separated from the provider and
// hooks so each file has a single export kind (clean react-refresh boundaries) —
// mirrors context.ts.
//
// A portfolio is a PRESENTATION-LAYER juxtaposition of N independent homes:
// every project is folded/derived on its own, and no cross-project accounting
// is ever synthesized (D-50 / MODEL §5: cross-project Σc consistency is an
// organizational responsibility, out of model scope).

import { createContext } from 'react';
import type {
  CapacityEntry,
  DerivedState,
  Event,
  IsoDate,
  LandingCurve,
  ProjectedState,
} from './engine';
import type { RosterMember } from './roster';

/** One project's slice of the injected portfolio fixture — the same per-home
 *  fields the single-project fixture carries, plus identity/label/loadError. */
export interface PortfolioProjectFixture {
  /** Stable identity (the CLI uses the normalized absolute home root). */
  key: string;
  label: string;
  events?: readonly Event[];
  capacity?: readonly CapacityEntry[];
  nodeLabels?: Record<string, string>;
  actorLabels?: Record<string, string>;
  members?: readonly RosterMember[];
  deadline?: IsoDate;
  targetDate?: IsoDate;
  /** Why this home could not be read. When set, the data fields are ignored. */
  loadError?: string;
}

export interface PortfolioFixture {
  portfolio: readonly PortfolioProjectFixture[];
  /** ONE uniform asOf across all projects (comparability). */
  asOf: IsoDate;
  label?: string;
  live?: boolean;
}

/** A loaded project, derived independently — one fold/derive/landing per home,
 *  all through the single engine bridge (R-S2 per project). */
export interface PortfolioProjectData {
  key: string;
  label: string;
  events: readonly Event[];
  capacityEntries: readonly CapacityEntry[];
  nodeLabels: Record<string, string>;
  actorLabels: Record<string, string>;
  members: readonly RosterMember[];
  deadline: IsoDate | null;
  targetDate: IsoDate | null;
  derived: DerivedState;
  projected: ProjectedState;
  landing: LandingCurve;
}

/** A home that could not be read/derived — kept as a VISIBLE error row
 *  (honest gap; never rendered as a zeroed project). */
export interface PortfolioProjectError {
  key: string;
  label: string;
  loadError: string;
}

export type PortfolioProject =
  | { kind: 'ok'; data: PortfolioProjectData }
  | { kind: 'error'; error: PortfolioProjectError };

export interface PortfolioState {
  /** portfolio display name (portfolio.json `label`), or null. */
  label: string | null;
  /** the uniform reporting date all projects derive at. */
  asOf: IsoDate;
  projects: readonly PortfolioProject[];
  setAsOf: (asOf: IsoDate) => void;
  /** live bridge: swap the whole injected fixture (all homes re-read). */
  replaceFixture: (fixture: PortfolioFixture) => void;
}

export const PortfolioContext = createContext<PortfolioState | null>(null);
