// PortfolioProvider — N independent derivations, one per home (issue #23).
// Each project runs the SAME fold/derive/landing pipeline (via portfolio-derive,
// through the single engine bridge); the portfolio never merges logs and never
// synthesizes cross-project accounting (D-50 / MODEL §5). Changing the uniform
// asOf re-derives every project — the single-project live-re-derivation
// discipline, applied per home.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { IsoDate } from './engine';
import { deriveProject } from './portfolio-derive';
import {
  PortfolioContext,
  type PortfolioFixture,
  type PortfolioProject,
  type PortfolioState,
} from './portfolio-context';

export interface PortfolioProviderProps {
  initialFixture: PortfolioFixture;
  children: ReactNode;
}

export function PortfolioProvider({ initialFixture, children }: PortfolioProviderProps) {
  const [fixture, setFixture] = useState<PortfolioFixture>(initialFixture);
  const [asOf, setAsOf] = useState<IsoDate>(initialFixture.asOf);

  const projects = useMemo<readonly PortfolioProject[]>(
    () => fixture.portfolio.map((p) => deriveProject(p, asOf)),
    [fixture, asOf],
  );

  const replaceFixture = useCallback((next: PortfolioFixture) => setFixture(next), []);

  const value = useMemo<PortfolioState>(
    () => ({
      label: fixture.label ?? null,
      asOf,
      projects,
      setAsOf,
      replaceFixture,
    }),
    [fixture.label, asOf, projects, replaceFixture],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
