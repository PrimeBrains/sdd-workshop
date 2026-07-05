// Per-project derivation for the portfolio (issue #23) — a PURE function so the
// INV-2 golden test can prove: a project derived through the portfolio pipeline
// yields EXACTLY the numbers its own single-project dashboard shows at the same
// asOf. One fold/derive/landing per home, via the single engine bridge; logs are
// never merged (D-50).

import { computeLandingCurve, derive, fold } from './engine';
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
    const capacityOf = makeCapacityLookup(capacityEntries);
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
