// Action helpers — navigation and writes on top of the selectors. Keeps specs
// readable (navTo / selectGanttRow / setAsOf) and centralizes waits.
import { type Locator, type Page } from '@playwright/test';
import { ganttRow, inspector, navButton, surfaceRoot } from './selectors';

export type SurfaceId =
  | 'spec-value'
  | 'schedule-time'
  | 'activity'
  | 'health'
  | 'decision-inbox'
  | 'capacity';

/** Switch to a surface (left-rail nav) and return its mounted root locator. */
export async function navTo(page: Page, surface: SurfaceId): Promise<Locator> {
  await navButton(page, surface).click();
  const root = surfaceRoot(page, surface);
  await root.waitFor();
  return root;
}

/** Click a Gantt row and return the opened Inspector locator. */
export async function selectGanttRow(page: Page, node: string): Promise<Locator> {
  await ganttRow(page, node).click();
  const insp = inspector(page);
  await insp.waitFor();
  return insp;
}

/** Set the reporting date (asOf) in the top bar. */
export async function setAsOf(page: Page, iso: string): Promise<void> {
  await page.getByTestId('asof-input').fill(iso);
}

export { loadFixture } from './fixtures/load';
