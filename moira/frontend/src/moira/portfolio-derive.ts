// Per-project derivation for the portfolio (issue #23) — a PURE function so the
// INV-2 golden test can prove: a project derived through the portfolio pipeline
// yields EXACTLY the numbers its own single-project dashboard shows at the same
// asOf. One fold/derive/landing per home, via the single engine bridge; logs are
// never merged (D-50).

import { computeLandingCurve, derive, fold, orgCalendarFallback } from './engine';
import type { IsoDate } from './engine';
import { makeCapacityLookup } from './capacity';
import type { PortfolioProject, PortfolioProjectFixture } from './portfolio-context';

export function deriveProject(p: PortfolioProjectFixture, asOf: IsoDate): PortfolioProject {
  if (p.loadError !== undefined) {
    return { kind: 'error', error: { key: p.key, label: p.label, loadError: p.loadError } };
  }
  try {
    const events = p.events ?? [];
    const capacityEntries = p.capacity ?? [];
    // Org calendar fallback (issue #32), PER PROJECT — mirrors store.tsx's
    // single-project discipline (`initialOrgCalendarEnabled !== false`), but
    // read from THIS project's own fixture slice, not a portfolio-wide flag:
    // one home's org-calendar setting never leaks into another home's forecast
    // (D-50 — homes stay independent). Generated ONCE per call and reused for
    // BOTH derive() and computeLandingCurve() below (via the one capacityOf
    // closure) — never a fresh orgCalendarFallback() per makeCapacityLookup
    // call, so its "warn once" Calendar sees one stable lifetime per derivation.
    const orgCalendarEnabled = p.orgCalendarEnabled !== false;
    const capacityFallback = orgCalendarEnabled ? orgCalendarFallback() : undefined;
    const capacityOf = makeCapacityLookup(capacityEntries, capacityFallback);
    const projected = fold(events);
    const derived = derive(events, { asOf, capacityOf });
    const landing = computeLandingCurve(events, { asOf, capacityOf });
    return {
      kind: 'ok',
      data: {
        key: p.key,
        label: p.label,
        events,
        capacityEntries,
        nodeLabels: p.nodeLabels ?? {},
        actorLabels: p.actorLabels ?? {},
        members: p.members ?? [],
        deadline: p.deadline ?? null,
        targetDate: p.targetDate ?? null,
        // RAW passthrough (not the resolved `orgCalendarEnabled` local above) —
        // a drill-down provider re-applies `!== false` itself (issue #32/#23
        // fix: the single-project drill-down was silently defaulting to
        // enabled for homes whose OWN fixture had it disabled).
        orgCalendarEnabled: p.orgCalendarEnabled,
        derived,
        projected,
        landing,
      },
    };
  } catch (e) {
    // A log the engine rejects outright stays a VISIBLE error row — a zeroed
    // project would fabricate accounting that was never derived.
    return {
      kind: 'error',
      error: { key: p.key, label: p.label, loadError: e instanceof Error ? e.message : String(e) },
    };
  }
}
