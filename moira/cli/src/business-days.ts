// Business-day calendar for the morning digest (issue #25): weekends plus
// Japanese national holidays are skipped. issue #32 unified this calendar
// into moira-backend's org-calendar.ts (shared with the leveler's capacity
// fallback, moira/backend/src/org-calendar.ts) — isWeekend/isBusinessDay/
// BusinessDayOptions/the static holiday data are no longer duplicated here,
// just re-exported. previousBusinessDay/lastNBusinessDays stay in the CLI:
// they are report-window walkers specific to the morning digest, not part of
// the capacity-store fallback surface.
//
// UTC arithmetic throughout (dates.ts discipline) — one date semantics in the
// codebase; the day boundary is a report-window parameter (TE03), not a model
// concept.

import type { BusinessDayOptions, IsoDate } from 'moira-backend';
import { isBusinessDay } from 'moira-backend';
import { addDays } from './dates.js';

export { isWeekend, isBusinessDay, type BusinessDayOptions } from 'moira-backend';

/**
 * Wrap `opts.warn` so it fires at most once per call to this function — the
 * SAME "warn once per walk" discipline org-calendar.ts's internal Calendar
 * keeps within one instance, preserved here even though moira-backend's
 * isBusinessDay() constructs a fresh (stateless) Calendar on every call.
 */
function warnOnceOpts(opts?: BusinessDayOptions): BusinessDayOptions | undefined {
  if (opts?.warn === undefined) return opts;
  const warn = opts.warn;
  let warned = false;
  return {
    ...opts,
    warn: (msg: string): void => {
      if (warned) return;
      warned = true;
      warn(msg);
    },
  };
}

/** The closest business day strictly BEFORE `d` (the morning digest's "prev"). */
export function previousBusinessDay(d: IsoDate, opts?: BusinessDayOptions): IsoDate {
  const o = warnOnceOpts(opts);
  let cur = addDays(d, -1);
  // Bounded walk: any 14-day window contains a weekday outside holiday clusters;
  // 366 is a hard safety stop against a (malformed) all-holiday set.
  for (let i = 0; i < 366; i += 1) {
    if (isBusinessDay(cur, o)) return cur;
    cur = addDays(cur, -1);
  }
  return cur;
}

/**
 * The last `n` business days up to and including `asOf` (if `asOf` itself is a
 * business day), ascending — the morning digest's trend window.
 */
export function lastNBusinessDays(asOf: IsoDate, n: number, opts?: BusinessDayOptions): IsoDate[] {
  const o = warnOnceOpts(opts);
  const days: IsoDate[] = [];
  let cur = asOf;
  for (let i = 0; days.length < n && i < 366 * 3; i += 1) {
    if (isBusinessDay(cur, o)) days.push(cur);
    cur = addDays(cur, -1);
  }
  return days.reverse();
}
