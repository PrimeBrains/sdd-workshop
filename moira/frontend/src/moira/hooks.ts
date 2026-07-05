// Context hooks. Kept separate from the provider so the provider file exports
// only a component (clean react-refresh boundary).

import { useContext } from 'react';
import { MoiraContext, type MoiraState } from './context';
import { DEMO_ACTORS } from './demo-data';
import type { Actor, DerivedState } from './engine';
import { PortfolioContext, type PortfolioState } from './portfolio-context';
import { rosterState } from './roster';

export function useMoira(): MoiraState {
  const ctx = useContext(MoiraContext);
  if (ctx === null) throw new Error('useMoira must be used within a MoiraProvider');
  return ctx;
}

/** Portfolio mode (issue #23): the N independently-derived projects. Surfaces
 *  read through this hook — never the provider module (same seam discipline as
 *  useMoira). */
export function usePortfolio(): PortfolioState {
  const ctx = useContext(PortfolioContext);
  if (ctx === null) throw new Error('usePortfolio must be used within a PortfolioProvider');
  return ctx;
}

/** Convenience: the single DerivedState (the only metric source for surfaces). */
export function useDerived(): DerivedState {
  return useMoira().derived;
}

export interface RosterView {
  /** every human/agent to offer as assignee/reassign candidates. */
  all: readonly Actor[];
  /** the human subset (capacity is a human-only concept). */
  humans: readonly Actor[];
  /** the viewpoint actor — the default human committer (agree, reassign). */
  me: Actor;
}

const SYNTHETIC_ME: Actor = { kind: 'human', id: 'me' };

/**
 * The roster the surfaces render. Three regimes (issue #11):
 *   1. demo (no fixture)          → the DEMO roster (unchanged; render-smoke green).
 *   2. fixture + members non-empty → exactly those members.
 *   3. fixture + members empty     → DERIVED from observed data (assignees ∪
 *      capacity humanIds ∪ me), so an un-provisioned real project still shows
 *      only names the user actually supplied — never the demo roster.
 */
export function useRoster(): RosterView {
  const { projected, capacityEntries } = useMoira();
  const rs = rosterState();

  if (!rs.fixtureMode) {
    const all = Object.values(DEMO_ACTORS).map((a) => a.actor);
    return {
      all,
      humans: all.filter((a) => a.kind === 'human'),
      me: DEMO_ACTORS.alice!.actor,
    };
  }

  let all: Actor[];
  if (rs.members.length > 0) {
    all = rs.members.map((m) => ({ kind: m.kind, id: m.id }));
  } else {
    // observed-data derivation — dedup by id, prefer an explicit assignee kind.
    const byId = new Map<string, Actor>();
    for (const n of projected.nodes.values()) {
      if (n.assignee !== null) byId.set(n.assignee.id, n.assignee);
    }
    for (const e of capacityEntries) {
      if (!byId.has(e.humanId)) byId.set(e.humanId, { kind: 'human', id: e.humanId });
    }
    if (rs.me !== null && !byId.has(rs.me.id)) byId.set(rs.me.id, rs.me);
    all = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  const humans = all.filter((a) => a.kind === 'human');
  const me = rs.me ?? humans[0] ?? all[0] ?? SYNTHETIC_ME;
  return { all, humans, me };
}
