// Append-only event log (A2 MODEL:25). The log is the single source of truth;
// derived state is always recomputed from it (R-S2 MODEL:283), never mutated
// in place (R-U2 MODEL:215).

import { readFileSync, writeFileSync } from 'node:fs';
import type { Event } from './types.js';

/**
 * Deterministic total order by (ts, id) — I3 MODEL:146 / R-D5 MODEL:343.
 * Returns a sorted COPY; the input is never mutated (fold purity).
 */
export function sortEvents(events: readonly Event[]): Event[] {
  return [...events].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

export class EventStore {
  private events: Event[] = [];

  append(event: Event): void {
    this.events.push(event);
  }

  appendAll(events: readonly Event[]): void {
    for (const e of events) this.events.push(e);
  }

  /** All events in deterministic (ts, id) order. */
  all(): Event[] {
    return sortEvents(this.events);
  }

  size(): number {
    return this.events.length;
  }

  loadJson(path: string): void {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Event[];
    this.appendAll(parsed);
  }

  saveJson(path: string): void {
    writeFileSync(path, JSON.stringify(this.all(), null, 2), 'utf8');
  }
}
