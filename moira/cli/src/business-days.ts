// Business-day calendar for the morning digest (issue #25): weekends plus
// Japanese national holidays (static data/jp-holidays.ts) are skipped. Dates
// outside the holiday data's coverage warn ONCE and degrade to weekend-only
// skipping — an honest, visible fallback, never a silent wrong answer.
//
// UTC arithmetic throughout (dates.ts discipline) — one date semantics in the
// codebase; the day boundary is a report-window parameter (TE03), not a model
// concept.

import type { IsoDate } from 'moira-backend';
import { addDays } from './dates.js';
import { JP_HOLIDAYS, JP_HOLIDAYS_FROM, JP_HOLIDAYS_TO } from './data/jp-holidays.js';

export interface BusinessDayOptions {
  /** Holiday set override (tests). Defaults to the committed JP data. */
  holidays?: ReadonlySet<string>;
  /** Coverage range of the holiday set (tests). */
  coverage?: { from: string; to: string };
  /** Sink for the out-of-coverage warning (CLI passes err); default silent. */
  warn?: (msg: string) => void;
}

interface Resolved {
  holidays: ReadonlySet<string>;
  from: string;
  to: string;
  warn: (msg: string) => void;
}

function resolveOpts(opts?: BusinessDayOptions): Resolved {
  return {
    holidays: opts?.holidays ?? JP_HOLIDAYS,
    from: opts?.coverage?.from ?? JP_HOLIDAYS_FROM,
    to: opts?.coverage?.to ?? JP_HOLIDAYS_TO,
    warn: opts?.warn ?? ((): void => {}),
  };
}

function isWeekend(d: IsoDate): boolean {
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Stateful walker: warns once per walk when a date falls outside coverage. */
class Calendar {
  private warned = false;
  constructor(private readonly r: Resolved) {}

  isBusinessDay(d: IsoDate): boolean {
    if (isWeekend(d)) return false;
    if (d < this.r.from || d > this.r.to) {
      if (!this.warned) {
        this.warned = true;
        this.r.warn(
          `警告: ${d} は祝日データの範囲外 (${this.r.from}..${this.r.to}) — 土日のみスキップします (data/jp-holidays.ts を再生成してください)`,
        );
      }
      return true; // weekday, holiday status unknown — honest fallback
    }
    return !this.r.holidays.has(d);
  }
}

export function isBusinessDay(d: IsoDate, opts?: BusinessDayOptions): boolean {
  return new Calendar(resolveOpts(opts)).isBusinessDay(d);
}

/** The closest business day strictly BEFORE `d` (the morning digest's "prev"). */
export function previousBusinessDay(d: IsoDate, opts?: BusinessDayOptions): IsoDate {
  const cal = new Calendar(resolveOpts(opts));
  let cur = addDays(d, -1);
  // Bounded walk: any 14-day window contains a weekday outside holiday clusters;
  // 366 is a hard safety stop against a (malformed) all-holiday set.
  for (let i = 0; i < 366; i += 1) {
    if (cal.isBusinessDay(cur)) return cur;
    cur = addDays(cur, -1);
  }
  return cur;
}

/**
 * The last `n` business days up to and including `asOf` (if `asOf` itself is a
 * business day), ascending — the morning digest's trend window.
 */
export function lastNBusinessDays(asOf: IsoDate, n: number, opts?: BusinessDayOptions): IsoDate[] {
  const cal = new Calendar(resolveOpts(opts));
  const days: IsoDate[] = [];
  let cur = asOf;
  for (let i = 0; days.length < n && i < 366 * 3; i += 1) {
    if (cal.isBusinessDay(cur)) days.push(cur);
    cur = addDays(cur, -1);
  }
  return days.reverse();
}
