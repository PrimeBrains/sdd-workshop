// Organizational calendar — c(i,d) fallback for weekends + Japanese national
// holidays (issue #32). Without this, every day (including weekends/holidays)
// silently defaults to full capacity via DEFAULT_CAPACITY, so a project's
// live forecast (leveler.ts) schedules work on non-working days.
//
// Ported from moira/cli/src/business-days.ts + data/jp-holidays.ts (issue #25's
// morning-digest calendar) so the SAME calendar discipline is available as a
// capacity-store fallback, not just a report-side helper. The static holiday
// data/coverage-range/warn-once-and-degrade behavior is copied verbatim — see
// data/jp-holidays.ts for regeneration instructions.
//
// UTC arithmetic throughout (dates.ts discipline) — one date semantics in the
// codebase; the day boundary is a report-window parameter (TE03), not a model
// concept.
//
// NOTE: previousBusinessDay / lastNBusinessDays are NOT ported here — they are
// report-window walkers specific to the morning digest and stay in moira/cli.

import type { CapacityLookup, IsoDate } from './types.js';
import { DEFAULT_CAPACITY } from './capacity-store.js';
import { JP_HOLIDAYS, JP_HOLIDAYS_FROM, JP_HOLIDAYS_TO } from './data/jp-holidays.js';

export { JP_HOLIDAYS, JP_HOLIDAYS_FROM, JP_HOLIDAYS_TO };

export interface BusinessDayOptions {
  /** Holiday set override (tests). Defaults to the committed JP data. */
  holidays?: ReadonlySet<string>;
  /** Coverage range of the holiday set (tests). */
  coverage?: { from: string; to: string };
  /** Sink for the out-of-coverage warning (callers pass e.g. console.error); default silent. */
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

export function isWeekend(d: IsoDate): boolean {
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

/**
 * A CapacityLookup fallback for capacity-store.capacityOf/lookup: business
 * days get DEFAULT_CAPACITY, weekends/holidays get 0 — so the org calendar
 * (not a blanket 1.0) is what an unspecified c(i,d) day resolves to (issue #32).
 * Explicit CapacityEntry entries in the store always take precedence over this
 * fallback (capacity-store.ts).
 */
export function orgCalendarFallback(opts?: BusinessDayOptions): CapacityLookup {
  // ONE Calendar for the fallback's whole lifetime — not one per lookup — so
  // "warn once" holds across every date the leveler queries through this
  // fallback (same "one Calendar per walk" discipline as business-days.ts's
  // previousBusinessDay/lastNBusinessDays, here scoped to the fallback
  // closure's lifetime rather than a single bounded walk).
  const cal = new Calendar(resolveOpts(opts));
  return (_humanId, date) => (cal.isBusinessDay(date) ? DEFAULT_CAPACITY : 0);
}
