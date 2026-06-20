// Deterministic ISO-date ('YYYY-MM-DD') arithmetic in UTC. No reliance on the
// ambient clock — every function is pure in its arguments.

import type { IsoDate } from './types.js';

function parse(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function format(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Lexicographic compare is correct for 'YYYY-MM-DD'; this is a typed helper. */
export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}
