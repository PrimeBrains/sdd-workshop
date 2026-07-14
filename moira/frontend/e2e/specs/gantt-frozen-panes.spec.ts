// E2E mechanics for the schedule-time Gantt frozen panes (issues #30/#31).
//
// This is a PURE UI-operability spec, NOT a scenario-unit regression — it has no
// SPEC_META and therefore does not participate in the 計器③ coverage gate
// (coverage-check.test.ts only inspects *.meta.ts). Sticky behavior cannot be
// verified by renderToStaticMarkup (schedule-ui.test.tsx only pins the markup
// hooks); the real freeze on scroll needs a browser, which is what this asserts.
//
// The SUT boots from demo data (no fixture injected → main.tsx falls back to
// demoEvents), whose deep tree + multi-week schedule overflows both axes at the
// viewport below (measured: ~750px of overflow on each axis). We scroll a MODERATE
// 300px on each axis — well inside the overflow so it is not clamped to the max,
// where CSS sticky exhibits a small containing-block boundary drift. Each assertion
// is guarded by an overflow check so it can never false-pass on a non-scrolling box.
import { test, expect, type Locator } from '@playwright/test';
import { navTo } from '../helpers';

// Fixed viewport → deterministic demo geometry. The schedule surface's inspector
// column keeps the Gantt track narrow (≈748px horizontal overflow); the short
// height sits the container at its 260px maxHeight floor so the 19-row demo (≈524px)
// overflows vertically by ≈264px. SCROLL stays well inside both so it is never
// clamped to the max (where CSS sticky shows a small containing-block boundary drift).
test.use({ viewport: { width: 900, height: 520 } });

const SCROLL = 150;

const left = async (loc: Locator): Promise<number> => {
  const b = await loc.boundingBox();
  expect(b, 'element has no bounding box (not rendered?)').not.toBeNull();
  return b!.x;
};
const top = async (loc: Locator): Promise<number> => {
  const b = await loc.boundingBox();
  expect(b, 'element has no bounding box (not rendered?)').not.toBeNull();
  return b!.y;
};

test.describe('schedule-time Gantt frozen panes (issues #30/#31)', () => {
  test('#30 左列固定 / #31 日付ヘッダー固定（実スクロールで確認）', async ({ page }) => {
    await page.goto('/');
    await navTo(page, 'schedule-time');

    const scroll = page.getByTestId('gantt-scroll');
    await scroll.waitFor();
    const corner = page.getByTestId('gantt-corner');
    const header = page.getByTestId('gantt-date-header');
    // first body row's label cell (its first child div) — proves the whole column
    // freezes, not just the header corner.
    const firstRow = page.locator('[data-testid^="gantt-row:"]').first();
    await firstRow.waitFor();
    const labelCell = firstRow.locator(':scope > div').first();

    const geom = await scroll.evaluate((el) => ({
      left: el.getBoundingClientRect().left,
      top: el.getBoundingClientRect().top,
      hOver: el.scrollWidth - el.clientWidth,
      vOver: el.scrollHeight - el.clientHeight,
    }));
    // both axes must genuinely overflow past the moderate scroll — else the freeze
    // assertions would be vacuous (or clamped into the boundary-drift regime).
    expect(geom.hOver, 'insufficient horizontal overflow').toBeGreaterThan(SCROLL + 20);
    expect(geom.vOver, 'insufficient vertical overflow').toBeGreaterThan(SCROLL + 20);

    // ── #30: a horizontal scroll must NOT move the left column ────────────────
    const cornerX0 = await left(corner);
    const labelX0 = await left(labelCell);
    // both start flush against the container's left edge
    expect(Math.abs(cornerX0 - geom.left)).toBeLessThan(2);
    expect(Math.abs(labelX0 - geom.left)).toBeLessThan(2);

    const sl = await scroll.evaluate((el, s) => {
      el.scrollLeft = s;
      return el.scrollLeft;
    }, SCROLL);
    expect(sl, 'horizontal scroll did not take / was clamped').toBe(SCROLL);
    expect(Math.abs((await left(corner)) - cornerX0)).toBeLessThan(2);
    expect(Math.abs((await left(labelCell)) - labelX0)).toBeLessThan(2);

    // ── #31: a vertical scroll must NOT move the date-header row ──────────────
    await scroll.evaluate((el) => {
      el.scrollLeft = 0;
    });
    const headerY0 = await top(header);
    expect(Math.abs(headerY0 - geom.top)).toBeLessThan(2); // starts at container top

    const st = await scroll.evaluate((el, s) => {
      el.scrollTop = s;
      return el.scrollTop;
    }, SCROLL);
    expect(st, 'vertical scroll did not take / was clamped').toBe(SCROLL);
    expect(Math.abs((await top(header)) - headerY0)).toBeLessThan(2);
  });
});
