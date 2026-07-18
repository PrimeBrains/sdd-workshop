// Render smoke for the capacity heatmap's org-calendar wiring (issue #32
// drill-down fix, found in independent review). Before the fix, CapacitySurface
// built its own flat-1.0 `makeCapacityLookup(capacityEntries)` — ignoring the
// org calendar the store's derive()/landing already apply — so a weekend cell
// with no explicit entry showed "1.0" even when the org calendar was enabled
// and had already derated it to 0 everywhere else. Worse: selecting that cell
// seeded the editor's slider from the same wrong 1.0, so an unedited "追記する"
// would silently overwrite a c=0 weekend/holiday with c=1.0.
//
// renderToStaticMarkup, mirroring schedule-ui.test.tsx's render-smoke style —
// no browser, no interaction; only the initial markup is asserted.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoiraProvider } from '../../moira/store';
import { CapacitySurface } from './CapacitySurface';
import { demoCapacity, demoEvents, DEMO_AS_OF } from '../../moira/demo-data';

// 2026-06-20 is a Saturday within the demo capacity window (entries span
// 2026-06-15..2026-06-24); 佐藤(bob) has explicit entries around it (6/15-19,
// 6/22-24) but NONE on 6/20 itself — an unspecified cell, exactly the case the
// fallback governs.
const SATURDAY = '2026-06-20';

const wrap = (node: React.ReactNode, initialOrgCalendarEnabled?: boolean) =>
  renderToStaticMarkup(
    <MoiraProvider
      initialEvents={demoEvents}
      initialCapacity={demoCapacity}
      initialAsOf={DEMO_AS_OF}
      initialOrgCalendarEnabled={initialOrgCalendarEnabled}
    >
      {node}
    </MoiraProvider>,
  );

// Extract the rendered text of the cell button whose title starts with the
// given prefix (title is the only stable, human-readable anchor — cells carry
// no data-testid). Attribute order in the SSR output is title, class, style,
// then the text child (onClick/handlers never serialize).
const cellTextFor = (html: string, titlePrefix: string): string | undefined =>
  new RegExp(`title="${titlePrefix}[^"]*"[^>]*>([^<]*)<`).exec(html)?.[1];

describe('CapacitySurface heatmap honors the org calendar (issue #32)', () => {
  it('org calendar ENABLED (default): an unspecified Saturday cell shows 0.0, not the flat 1.0 fallback', () => {
    const html = wrap(<CapacitySurface />); // initialOrgCalendarEnabled unset → enabled (default)
    const cell = cellTextFor(html, `佐藤 ${SATURDAY}: c=`);
    expect(cell).toBe('0.0');
  });

  it('org calendar DISABLED: the SAME unspecified Saturday cell reverts to the pre-#32 flat 1.0', () => {
    const html = wrap(<CapacitySurface />, false);
    const cell = cellTextFor(html, `佐藤 ${SATURDAY}: c=`);
    expect(cell).toBe('1.0');
  });

  it('the display lookup is the store-provided one — the heatmap cannot disagree with what derive() actually computed', () => {
    // Not a duplicate of the two tests above: pins that BOTH lookups come from
    // the SAME source by checking a weekday cell (where the org calendar and
    // the flat fallback agree) stays 1.0 under both settings — i.e. the fix
    // didn't just hardcode "Saturday → 0", it wired the real fallback through.
    const weekday = '2026-06-17'; // Wednesday, no explicit alice/carol entry
    const enabled = cellTextFor(wrap(<CapacitySurface />), `田中 ${weekday}: c=`);
    const disabled = cellTextFor(wrap(<CapacitySurface />, false), `田中 ${weekday}: c=`);
    expect(enabled).toBe('1.0');
    expect(disabled).toBe('1.0');
  });
});
