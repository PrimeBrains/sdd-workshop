// LiveFixtureBridge — the `moira ui` live-refresh seam (issue #6). Mounted ONLY
// when the injected fixture carries `live: true` (i.e. served by the moira CLI);
// the Playwright fixture seam and demo mode never set it, so this file is inert
// there. Listens on the server's SSE ping stream and, on every ping (and on
// every (re)connect, which covers changes missed while disconnected), refetches
// /api/fixture and swaps the snapshot into MoiraProvider — the existing
// derivation chain re-runs (R-S2), no second path.

import { useEffect, useRef } from 'react';
import type { CapacityEntry, Event, IsoDate } from './engine';
import { useMoira } from './hooks';
import { setUserLabels } from './labels';
import { setRoster, type RosterMember } from './roster';

export interface LiveFixture {
  events: readonly Event[];
  capacity?: readonly CapacityEntry[];
  asOf: IsoDate;
  nodeLabels?: Record<string, string>;
  actorLabels?: Record<string, string>;
  members?: readonly RosterMember[];
  me?: string;
}

/** The bridge's side-effect ports — injected so the refetch logic is testable
 *  without a DOM (the vitest env is plain node; no new dev deps). */
export interface LiveBridgeIo {
  /** resolve null on any failure — the next ping/reconnect retries. */
  fetchFixture: () => Promise<LiveFixture | null>;
  applyLabels: (nodeLabels?: Record<string, string>, actorLabels?: Record<string, string>) => void;
  applyRoster: (members?: readonly RosterMember[], me?: string) => void;
  replaceSnapshot: (events: readonly Event[], capacity: readonly CapacityEntry[]) => void;
  getAsOf: () => IsoDate;
  setAsOf: (asOf: IsoDate) => void;
}

/**
 * One refetch pass: pull the fresh fixture and swap it in. Rules it owns:
 * - stale-drop: an out-of-order response (a newer refetch already started) is
 *   discarded, so a slow old snapshot can never overwrite a newer one;
 * - asOf follow-or-hold: track the server's asOf only while the user hasn't
 *   navigated away from it (their manual asOf navigation is preserved).
 */
export function createLiveRefetcher(io: LiveBridgeIo, initialServerAsOf: IsoDate): () => Promise<void> {
  let lastServerAsOf = initialServerAsOf;
  let seq = 0;
  return async (): Promise<void> => {
    const mySeq = ++seq;
    const fx = await io.fetchFixture();
    if (fx === null || mySeq !== seq) return; // failed, or superseded by a newer refetch
    // Registry updates (labels, roster) BEFORE the state swap — the #6 pattern:
    // the derivation that re-runs on replaceSnapshot must see the fresh labels/roster.
    io.applyLabels(fx.nodeLabels, fx.actorLabels);
    io.applyRoster(fx.members, fx.me);
    io.replaceSnapshot(fx.events, fx.capacity ?? []);
    if (io.getAsOf() === lastServerAsOf) io.setAsOf(fx.asOf);
    lastServerAsOf = fx.asOf;
  };
}

export function LiveFixtureBridge({ initialAsOf }: { initialAsOf: IsoDate }) {
  const { asOf, setAsOf, replaceSnapshot } = useMoira();

  // Read the current asOf via a ref so the EventSource effect never re-subscribes.
  const asOfRef = useRef(asOf);
  asOfRef.current = asOf;

  useEffect(() => {
    const refetch = createLiveRefetcher(
      {
        fetchFixture: async () => {
          try {
            const resp = await fetch('/api/fixture', { cache: 'no-store' });
            if (!resp.ok) return null;
            return (await resp.json()) as LiveFixture;
          } catch {
            return null; // transient — the next ping (or reconnect) retries
          }
        },
        applyLabels: setUserLabels,
        applyRoster: setRoster,
        replaceSnapshot,
        getAsOf: () => asOfRef.current,
        setAsOf,
      },
      initialAsOf,
    );
    const es = new EventSource('/api/stream');
    es.addEventListener('open', () => void refetch());
    es.addEventListener('change', () => void refetch());
    return () => es.close();
    // initialAsOf is boot-constant; replaceSnapshot/setAsOf are stable callbacks.
  }, [initialAsOf, replaceSnapshot, setAsOf]);

  return null;
}
