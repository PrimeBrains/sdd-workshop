// INV-2 (issue #23): a project derived through the portfolio pipeline yields
// EXACTLY the numbers its own single-project dashboard derives at the same asOf
// — same engine, same options, byte-equal outputs. Plus: loadError entries stay
// error rows (never zeroed projects), and a spot-check against the same golden
// constants engine.golden.test.ts pins (backend parity chain).

import { describe, expect, it } from 'vitest';
import { makeCapacityLookup } from './capacity';
import { demoCapacity, demoEvents, DEMO_AS_OF } from './demo-data';
import { computeLandingCurve, derive, fold, tinyProjectEvents, TINY_AS_OF } from './engine';
import { deriveProject } from './portfolio-derive';

describe('portfolio derivation parity (INV-2)', () => {
  it('tiny fixture: derived/projected/landing all equal the standalone pipeline', () => {
    const via = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF);
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;
    const capacityOf = makeCapacityLookup([]);
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
    const capacityOf = makeCapacityLookup(demoCapacity);
    expect(via.data.derived).toEqual(derive(demoEvents, { asOf: DEMO_AS_OF, capacityOf }));
    expect(via.data.landing).toEqual(
      computeLandingCurve(demoEvents, { asOf: DEMO_AS_OF, capacityOf }),
    );
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
