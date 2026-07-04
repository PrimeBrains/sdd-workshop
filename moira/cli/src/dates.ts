// Deterministic ISO-date ('YYYY-MM-DD') arithmetic in UTC. No reliance on the
// ambient clock — every function is pure in its arguments.
//
// SOURCE: verbatim copy of moira/backend/src/dates.ts. The backend barrel
// (index.ts) does NOT export these helpers, and the WBS packing must walk the
// calendar with the SAME discipline as the leveler (skip c=0 days, addDays,
// maxDate). Kept as a local copy rather than reaching into backend internals.

import type { IsoDate } from 'moira-backend';

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
