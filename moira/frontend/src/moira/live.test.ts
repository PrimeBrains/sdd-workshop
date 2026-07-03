// createLiveRefetcher — the moira-ui live bridge's refetch rules (issue #6),
// tested without a DOM: the io ports are stubbed, EventSource wiring stays in
// the (thin) React component.

import { describe, expect, it } from 'vitest';
import { createLiveRefetcher, type LiveBridgeIo, type LiveFixture } from './live';

function fx(asOf: string, eventCount: number): LiveFixture {
  const events = Array.from({ length: eventCount }, (_, i) => ({ x: i }));
  return { events: events as unknown as LiveFixture['events'], asOf };
}

interface Recorded {
  io: LiveBridgeIo;
  snapshots: Array<{ events: number; capacity: number }>;
  asOfLog: string[];
  labelCalls: number;
  setAsOfCurrent: (v: string) => void;
}

function recordedIo(fetches: Array<() => Promise<LiveFixture | null>>, initialAsOf: string): Recorded {
  let asOf = initialAsOf;
  const rec: Recorded = {
    snapshots: [],
    asOfLog: [],
    labelCalls: 0,
    setAsOfCurrent: (v) => {
      asOf = v;
    },
    io: {
      fetchFixture: () => {
        const next = fetches.shift();
        if (next === undefined) throw new Error('unexpected extra fetch');
        return next();
      },
      applyLabels: () => {
        rec.labelCalls += 1;
      },
      replaceSnapshot: (events, capacity) => {
        rec.snapshots.push({ events: events.length, capacity: capacity.length });
      },
      getAsOf: () => asOf,
      setAsOf: (v) => {
        asOf = v;
        rec.asOfLog.push(v);
      },
    },
  };
  return rec;
}

describe('createLiveRefetcher', () => {
  it('swaps the snapshot in and defaults missing capacity to []', async () => {
    const rec = recordedIo([async () => fx('2026-07-02', 3)], '2026-07-01');
    await createLiveRefetcher(rec.io, '2026-07-01')();
    expect(rec.snapshots).toEqual([{ events: 3, capacity: 0 }]);
    expect(rec.labelCalls).toBe(1);
  });

  it('follows the server asOf while the user has not navigated away', async () => {
    const rec = recordedIo(
      [async () => fx('2026-07-02', 1), async () => fx('2026-07-03', 2)],
      '2026-07-01',
    );
    const refetch = createLiveRefetcher(rec.io, '2026-07-01');
    await refetch(); // user still on boot asOf 2026-07-01 → follow to 07-02
    await refetch(); // still tracking → follow to 07-03
    expect(rec.asOfLog).toEqual(['2026-07-02', '2026-07-03']);
  });

  it('holds the asOf the user navigated to', async () => {
    const rec = recordedIo(
      [async () => fx('2026-07-02', 1), async () => fx('2026-07-03', 2)],
      '2026-07-01',
    );
    const refetch = createLiveRefetcher(rec.io, '2026-07-01');
    await refetch(); // follows to 2026-07-02
    rec.setAsOfCurrent('2026-01-15'); // user navigates the timeline
    await refetch(); // snapshot still swaps, but asOf must NOT be clobbered
    expect(rec.snapshots).toHaveLength(2);
    expect(rec.asOfLog).toEqual(['2026-07-02']); // no second follow
  });

  it('drops an out-of-order (stale) response', async () => {
    let releaseSlow: (v: LiveFixture) => void = () => undefined;
    const slow = new Promise<LiveFixture>((r) => {
      releaseSlow = r;
    });
    const rec = recordedIo([() => slow, async () => fx('2026-07-03', 9)], '2026-07-01');
    const refetch = createLiveRefetcher(rec.io, '2026-07-01');
    const first = refetch(); // hangs on the slow fetch
    await refetch(); // newer refetch completes first
    releaseSlow(fx('2026-07-02', 1)); // old response arrives late...
    await first;
    // ...and is discarded: only the newer snapshot was applied.
    expect(rec.snapshots).toEqual([{ events: 9, capacity: 0 }]);
    expect(rec.asOfLog).toEqual(['2026-07-03']);
  });

  it('a failed fetch is a no-op (next ping retries)', async () => {
    const rec = recordedIo([async () => null, async () => fx('2026-07-02', 2)], '2026-07-01');
    const refetch = createLiveRefetcher(rec.io, '2026-07-01');
    await refetch();
    expect(rec.snapshots).toHaveLength(0);
    await refetch();
    expect(rec.snapshots).toEqual([{ events: 2, capacity: 0 }]);
    expect(rec.asOfLog).toEqual(['2026-07-02']);
  });
});
