// c(i,d) — the second data tier (A4 MODEL:35, R-U14 MODEL:253).
//
// This is NOT one of the four node-work events (§5 MODEL:372). It is a separate
// append-only, reason-stamped, timestamped history of each human's daily
// capacity. A c change triggers re-derivation of the live forecast (R-S2
// MODEL:283), exactly like an event append.

import { readFileSync, writeFileSync } from 'node:fs';
import type { CapacityEntry, CapacityLookup, IsoDate } from './types.js';

/** Unspecified days default to 1.0 MD/day — backward compatible (A4 MODEL:34). */
export const DEFAULT_CAPACITY = 1.0;

export class CapacityStore {
  private entries: CapacityEntry[] = [];

  append(entry: CapacityEntry): void {
    this.entries.push(entry);
  }

  appendAll(entries: readonly CapacityEntry[]): void {
    for (const e of entries) this.entries.push(e);
  }

  /**
   * c(i,d): the latest-ts entry for (human, date); default 1.0 if none.
   * c=0 is in-domain (holidays/leave; MODEL:34) — only the ABSENCE of an entry
   * defaults to 1.0.
   */
  capacityOf(humanId: string, date: IsoDate): number {
    let best: CapacityEntry | undefined;
    for (const e of this.entries) {
      if (e.humanId !== humanId || e.date !== date) continue;
      if (best === undefined || e.ts >= best.ts) best = e;
    }
    return best === undefined ? DEFAULT_CAPACITY : best.capacity;
  }

  /** Bind `capacityOf` as a plain function for the leveler. */
  lookup(): CapacityLookup {
    return (humanId, date) => this.capacityOf(humanId, date);
  }

  all(): CapacityEntry[] {
    return [...this.entries];
  }

  loadJson(path: string): void {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as CapacityEntry[];
    this.appendAll(parsed);
  }

  /** Persist all entries (symmetric with EventStore.saveJson; append-only on disk). */
  saveJson(path: string): void {
    writeFileSync(path, JSON.stringify(this.all(), null, 2), 'utf8');
  }
}

/** A lookup that always returns the default capacity (1.0). */
export const defaultCapacityLookup: CapacityLookup = () => DEFAULT_CAPACITY;
