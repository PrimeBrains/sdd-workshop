// INV-2 (issue #23): a project derived through the portfolio pipeline yields
// EXACTLY the numbers its own single-project dashboard derives at the same asOf
// — same engine, same options, byte-equal outputs. Plus: loadError entries stay
// error rows (never zeroed projects), and a spot-check against the same golden
// constants engine.golden.test.ts pins (backend parity chain).

import { describe, expect, it } from 'vitest';
import { makeCapacityLookup } from './capacity';
import { demoCapacity, demoEvents, DEMO_AS_OF } from './demo-data';
import {
  computeLandingCurve,
  derive,
  fold,
  orgCalendarFallback,
  tinyProjectEvents,
  TINY_AS_OF,
} from './engine';
import { deriveProject } from './portfolio-derive';

describe('portfolio derivation parity (INV-2)', () => {
  // orgCalendarEnabled UNSET → default-on (issue #32), same `!== false` discipline
  // as the single-project store — so the parity reference here must ALSO apply
  // the org-calendar fallback, or the two pipelines would disagree by construction.
  it('tiny fixture: derived/projected/landing all equal the standalone pipeline', () => {
    const via = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF);
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;
    const capacityOf = makeCapacityLookup([], orgCalendarFallback());
    expect(via.data.derived).toEqual(derive(tinyProjectEvents, { asOf: TINY_AS_OF, capacityOf }));
    expect(via.data.projected).toEqual(fold(tinyProjectEvents));
    expect(via.data.landing).toEqual(
      computeLandingCurve(tinyProjectEvents, { asOf: TINY_AS_OF, capacityOf }),
    );
  });

  it('demo fixture WITH a capacity tier: still byte-equal to standalone', () => {
    const via = deriveProject(
      { key: 'k', label: 'L', events: demoEvents, capacity: demoCapacity },
      DEMO_AS_OF,
    );
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;
    const capacityOf = makeCapacityLookup(demoCapacity, orgCalendarFallback());
    expect(via.data.derived).toEqual(derive(demoEvents, { asOf: DEMO_AS_OF, capacityOf }));
    expect(via.data.landing).toEqual(
      computeLandingCurve(demoEvents, { asOf: DEMO_AS_OF, capacityOf }),
    );
  });

  it('orgCalendarEnabled: false — parity reference reverts to the flat 1.0 fallback', () => {
    const via = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: false },
      TINY_AS_OF,
    );
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;
    const capacityOf = makeCapacityLookup([]); // no fallback → flat 1.0, pre-#32 behavior
    expect(via.data.derived).toEqual(derive(tinyProjectEvents, { asOf: TINY_AS_OF, capacityOf }));
    expect(via.data.landing).toEqual(
      computeLandingCurve(tinyProjectEvents, { asOf: TINY_AS_OF, capacityOf }),
    );
  });

  it('issue #32 portfolio wiring: orgCalendarEnabled=true skips weekends in the live forecast; false keeps the pre-#32 flat-1.0 behavior', () => {
    const enabled = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: true },
      TINY_AS_OF,
    );
    const disabled = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: false },
      TINY_AS_OF,
    );
    expect(enabled.kind).toBe('ok');
    expect(disabled.kind).toBe('ok');
    if (enabled.kind !== 'ok' || disabled.kind !== 'ok') return;

    // Every live-forecast predicted completion under the org calendar lands on
    // a business day — weekends are never assigned work.
    expect(enabled.data.derived.forecast.length).toBeGreaterThan(0);
    for (const row of enabled.data.derived.forecast) {
      if (row.predictedCompletion === null) continue;
      const dow = new Date(`${row.predictedCompletion}T00:00:00Z`).getUTCDay();
      expect([0, 6]).not.toContain(dow);
    }

    // The org calendar isn't a no-op: it changes the schedule relative to the
    // pre-#32 flat-1.0 fallback for this fixture (whose window spans weekends).
    expect(enabled.data.derived.forecast).not.toEqual(disabled.data.derived.forecast);
    expect(enabled.data.landing).not.toEqual(disabled.data.landing);
  });

  it('spot-check: the golden constants engine.golden.test.ts pins hold through the portfolio path', () => {
    const via = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF);
    if (via.kind !== 'ok') throw new Error('expected ok');
    expect(via.data.derived.evAbs).toBe(20);
    expect(via.data.derived.pv).toBe(20);
    expect(via.data.derived.ac).toBe(25);
    expect(via.data.derived.spi).toBe(1);
    expect(via.data.derived.cpi).toBe(0.8);
  });

  it('a loadError entry stays a visible error row — never a zeroed project', () => {
    const via = deriveProject({ key: 'k', label: '壊れた案件', loadError: 'boom' }, TINY_AS_OF);
    expect(via).toEqual({
      kind: 'error',
      error: { key: 'k', label: '壊れた案件', loadError: 'boom' },
    });
  });
});
