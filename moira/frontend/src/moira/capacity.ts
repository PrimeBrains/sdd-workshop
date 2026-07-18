// c(i,d) lookup plumbing for the frontend in-memory capacity tier.
//
// This is NOT a derivation — it is the input accessor the leveler consumes. It
// mirrors backend/src/capacity-store.ts:30-37/47-50 exactly (latest-ts wins per
// (human, date); an EXPLICIT entry always wins; ABSENCE falls through to
// `fallback`, default the flat 1.0 default — backward compatible; c=0 is
// in-domain). Re-implemented here (rather than importing CapacityStore, which
// carries node:fs) because it is a 6-line data lookup, not a metric computation.

import type { CapacityEntry, CapacityLookup, IsoDate } from './engine';

export const DEFAULT_CAPACITY = 1.0;

/**
 * `fallback` mirrors CapacityStore.capacityOf's fallback param (issue #32):
 * pass `orgCalendarFallback()` (engine.ts) to make unspecified weekends/JP
 * holidays resolve to 0 instead of a blanket 1.0. Omitted → the flat 1.0
 * default, byte-identical to the pre-#32 behavior.
 */
export function makeCapacityLookup(
  entries: readonly CapacityEntry[],
  fallback: CapacityLookup = () => DEFAULT_CAPACITY,
): CapacityLookup {
  return (humanId: string, date: IsoDate): number => {
    let best: CapacityEntry | undefined;
    for (const e of entries) {
      if (e.humanId !== humanId || e.date !== date) continue;
      if (best === undefined || e.ts >= best.ts) best = e;
    }
    return best === undefined ? fallback(humanId, date) : best.capacity;
  };
}

/**
 * Whether (human, date) has an EXPLICIT entry. Lets the capacity grid distinguish
 * "未指定 1.0 (assumed)" from "明示入力 1.0" — both return 1.0 from the lookup
 * (UI-DESIGN-BRIEF §5.1, red-line "explicit vs assumed").
 */
export function hasCapacityEntry(
  entries: readonly CapacityEntry[],
  humanId: string,
  date: IsoDate,
): boolean {
  return entries.some((e) => e.humanId === humanId && e.date === date);
}

/** Latest-ts entry for (human, date), or undefined if unspecified. */
export function latestEntry(
  entries: readonly CapacityEntry[],
  humanId: string,
  date: IsoDate,
): CapacityEntry | undefined {
  let best: CapacityEntry | undefined;
  for (const e of entries) {
    if (e.humanId !== humanId || e.date !== date) continue;
    if (best === undefined || e.ts >= best.ts) best = e;
  }
  return best;
}

/** α_i view: latest contract-reason capacity for (human, date); 1.0 if none.
 * α is a DERIVED VIEW of c (read-only), not a separate primitive (A4). */
export function alphaOf(
  entries: readonly CapacityEntry[],
  humanId: string,
  date: IsoDate,
): number {
  let best: CapacityEntry | undefined;
  for (const e of entries) {
    if (e.humanId !== humanId || e.date !== date || e.reason !== 'contract') continue;
    if (best === undefined || e.ts >= best.ts) best = e;
  }
  return best === undefined ? DEFAULT_CAPACITY : best.capacity;
}

/** Next append-only ts for a frontend-authored capacity revision (R-U14). */
export function nextCapacityTs(entries: readonly CapacityEntry[]): number {
  let max = 1000;
  for (const e of entries) if (e.ts > max) max = e.ts;
  return max + 1;
}
