// PortfolioLiveBridge — the `moira ui --portfolio` live-refresh seam. Mounted
// ONLY when the injected portfolio fixture carries `live: true`. Same contract
// as the single-project LiveFixtureBridge (live.tsx): on every SSE ping (and on
// every (re)connect) refetch /api/fixture and swap the WHOLE portfolio fixture —
// every home re-derives through the one pipeline. Rules shared with live.tsx:
// stale-drop (an out-of-order response never overwrites a newer one) and asOf
// follow-or-hold (the user's manual asOf navigation is preserved).

import { useEffect, useRef } from 'react';
import type { IsoDate } from './engine';
import { usePortfolio } from './hooks';
import type { PortfolioFixture } from './portfolio-context';

export function PortfolioLiveBridge({ initialAsOf }: { initialAsOf: IsoDate }) {
  const { asOf, setAsOf, replaceFixture } = usePortfolio();

  const asOfRef = useRef(asOf);
  asOfRef.current = asOf;

  useEffect(() => {
    let lastServerAsOf = initialAsOf;
    let seq = 0;
    const refetch = async (): Promise<void> => {
      const mySeq = ++seq;
      let fx: PortfolioFixture;
      try {
        const resp = await fetch('/api/fixture', { cache: 'no-store' });
        if (!resp.ok) return;
        fx = (await resp.json()) as PortfolioFixture;
      } catch {
        return; // transient — the next ping (or reconnect) retries
      }
      if (mySeq !== seq) return; // superseded by a newer refetch
      if (!Array.isArray(fx.portfolio)) return; // server flipped modes — ignore
      replaceFixture(fx);
      if (asOfRef.current === lastServerAsOf) setAsOf(fx.asOf);
      lastServerAsOf = fx.asOf;
    };
    const es = new EventSource('/api/stream');
    es.addEventListener('open', () => void refetch());
    es.addEventListener('change', () => void refetch());
    return () => es.close();
    // initialAsOf is boot-constant; replaceFixture/setAsOf are stable callbacks.
  }, [initialAsOf, replaceFixture, setAsOf]);

  return null;
}
