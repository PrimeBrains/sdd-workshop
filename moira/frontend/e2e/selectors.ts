// DOM-facing selectors — the single place that knows the data-testid vocabulary
// added to the surfaces (Step 2). Specs read through these so a testid rename is a
// one-line change here. Each returns a Playwright Locator.
import { type Locator, type Page } from '@playwright/test';

export function surfaceRoot(page: Page, surface: string): Locator {
  return page.getByTestId(`surface-root:${surface}`);
}

export function navButton(page: Page, surface: string): Locator {
  return page.getByTestId(`nav:${surface}`);
}

/** A health/spec/schedule metric value cell, keyed e.g. 'ev-percent', 'estimate-coverage', 'spi'. */
export function metric(page: Page, key: string): Locator {
  return page.getByTestId(`metric:${key}`);
}

/** A spec-value node-tree row, keyed by node id (e.g. 'F/req'). */
export function specRow(page: Page, node: string): Locator {
  return page.getByTestId(`spec-row:${node}`);
}

/** A spec-value coverage-matrix row, keyed by leaf node id. */
export function covRow(page: Page, node: string): Locator {
  return page.getByTestId(`cov-row:${node}`);
}

/** A schedule-time Gantt row (click to open the Inspector). */
export function ganttRow(page: Page, node: string): Locator {
  return page.getByTestId(`gantt-row:${node}`);
}

export function inspector(page: Page): Locator {
  return page.getByTestId('inspector');
}

/** An Inspector read-zone field value, keyed e.g. 'frozen-slot', 'predicted', 'ev', 'pv'. */
export function inspectorField(page: Page, key: string): Locator {
  return page.getByTestId(`field:${key}`);
}

/** The lifecycle badge inside a given row locator. */
export function lifecycleBadge(row: Locator): Locator {
  return row.getByTestId('lifecycle-badge');
}

/** The estimate badge inside a given row locator. */
export function estimateBadge(row: Locator): Locator {
  return row.getByTestId('estimate-badge');
}
