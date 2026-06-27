import { type Page } from '@playwright/test';
import { type MoiraFixture } from './types';

// Boot the app with a scenario fixture. addInitScript runs before any page script,
// so window.__MOIRA_FIXTURE__ exists when src/main.tsx reads it. The fixture is a
// plain serializable object (events/capacity/asOf) — no Maps, no functions.
export async function loadFixture(page: Page, fixture: MoiraFixture): Promise<void> {
  await page.addInitScript((fx) => {
    (window as unknown as { __MOIRA_FIXTURE__?: MoiraFixture }).__MOIRA_FIXTURE__ = fx;
  }, fixture);
  await page.goto('/');
}
