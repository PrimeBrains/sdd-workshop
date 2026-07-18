// c(i,d) resolution (A4 MODEL:35): explicit CapacityEntry always wins; the
// ABSENCE of an entry falls through to a caller-supplied fallback (issue #32 —
// orgCalendarFallback in org-calendar.ts is the motivating fallback, but this
// file tests capacity-store.ts's own contract independent of that calendar).

import { describe, expect, it } from 'vitest';
import { CapacityStore, DEFAULT_CAPACITY } from './capacity-store.js';
import type { CapacityLookup } from './types.js';

describe('CapacityStore.capacityOf (explicit entry vs fallback)', () => {
  it('defaults to DEFAULT_CAPACITY with no fallback and no entry (backward compatible)', () => {
    const store = new CapacityStore();
    expect(store.capacityOf('alice', '2026-07-06')).toBe(DEFAULT_CAPACITY);
  });

  it('an explicit entry always wins over the fallback, even a nonzero fallback', () => {
    const store = new CapacityStore();
    store.append({ humanId: 'alice', date: '2026-07-06', capacity: 0.5, reason: 'leave', ts: 1 });
    const fallback: CapacityLookup = () => 1.0;
    expect(store.capacityOf('alice', '2026-07-06', fallback)).toBe(0.5);
  });

  it('an explicit entry of 0 is never overridden by the fallback (c=0 is in-domain, MODEL:34)', () => {
    const store = new CapacityStore();
    store.append({ humanId: 'alice', date: '2026-07-06', capacity: 0, reason: 'holiday', ts: 1 });
    const fallback: CapacityLookup = () => 1.0;
    expect(store.capacityOf('alice', '2026-07-06', fallback)).toBe(0);
  });

  it('an unspecified (human, date) falls through to the fallback', () => {
    const store = new CapacityStore();
    const fallback: CapacityLookup = (humanId, date) => (humanId === 'alice' && date === '2026-07-04' ? 0 : 1.0);
    expect(store.capacityOf('alice', '2026-07-04', fallback)).toBe(0); // weekend-like fallback
    expect(store.capacityOf('alice', '2026-07-06', fallback)).toBe(1.0);
  });

  it('latest-ts entry wins among multiple entries for the same (human, date), fallback irrelevant once any entry exists', () => {
    const store = new CapacityStore();
    store.append({ humanId: 'alice', date: '2026-07-06', capacity: 0.3, reason: 'temporary-reduction', ts: 1 });
    store.append({ humanId: 'alice', date: '2026-07-06', capacity: 0.8, reason: 'temporary-reduction', ts: 2 });
    expect(store.capacityOf('alice', '2026-07-06', () => 1.0)).toBe(0.8);
  });
});

describe('CapacityStore.lookup (bound CapacityLookup, fallback passthrough)', () => {
  it('binds capacityOf with no fallback (backward compatible: defaults to DEFAULT_CAPACITY)', () => {
    const store = new CapacityStore();
    const lookup = store.lookup();
    expect(lookup('alice', '2026-07-06')).toBe(DEFAULT_CAPACITY);
  });

  it('passes the fallback through to every lookup call', () => {
    const store = new CapacityStore();
    store.append({ humanId: 'alice', date: '2026-07-06', capacity: 0.5, reason: 'leave', ts: 1 });
    const fallback: CapacityLookup = (_h, d) => (d === '2026-07-04' ? 0 : 1.0);
    const lookup = store.lookup(fallback);
    expect(lookup('alice', '2026-07-06')).toBe(0.5); // explicit entry still wins
    expect(lookup('alice', '2026-07-04')).toBe(0); // no entry → fallback
    expect(lookup('alice', '2026-07-05')).toBe(1.0); // no entry → fallback
  });
});
