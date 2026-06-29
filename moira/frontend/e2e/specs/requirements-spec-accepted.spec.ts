// E2E regression for units/requirements-spec-accepted (計器③). The headline:
// approval is NOT earned value — req moves to accepted and EV% stays 32.0%; design
// then starts (implementing). Non-vacuity: the metric reads 8.0% on the returned
// fixture, so 32.0% is real.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, lifecycleBadge, metric, specRow } from '../selectors';
import {
  requirementsAccepted,
  requirementsResubmitted2,
  requirementsReturned,
} from '../fixtures/scenario-fixtures';
import { SPEC_META } from './requirements-spec-accepted.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 承認: req=accepted・EV% 32.0%・review=accepted・design=implementing [EARS 1,4,5,7]', async ({ page }) => {
    await loadFixture(page, requirementsAccepted);
    await navTo(page, 'spec-value');
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('accepted'); // EARS 1
    await expect(lifecycleBadge(specRow(page, 'F/review-req'))).toHaveText('accepted'); // EARS 5
    await expect(covRow(page, 'F/review-req')).toContainText('1'); // EARS 4 (出来高据え置き)
    await expect(lifecycleBadge(specRow(page, 'F/design'))).toHaveText('implementing'); // EARS 7
    await expect(metric(page, 'ev-percent')).toHaveText('32.0%'); // EARS 2/3/8
  });

  // EARS 2/3/8 (approval-neutral): EV% is 32.0% BOTH before approval (resubmitted)
  // and after — approval added no earned value.
  test('承認は出来高を足さない: 承認前後とも EV% 32.0% [EARS 2,3,8]', async ({ page }) => {
    await loadFixture(page, requirementsResubmitted2);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('32.0%');
    await loadFixture(page, requirementsAccepted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('32.0%');
  });

  // Non-vacuity: the metric DOES read other values (8.0% on the returned fixture).
  test('非空虚: 差し戻し状態では EV% 8.0%（32.0% が定数でない） [witness]', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('8.0%');
  });

  // EARS 10: neither approval nor design-start hits the decision inbox.
  test('EARS 10: 承認・設計着手は decision インボックスに出ない', async ({ page }) => {
    await loadFixture(page, requirementsAccepted);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox).not.toContainText('F/req');
    await expect(inbox).not.toContainText('F/design');
  });

  // xfail: human-review queue list 未描画 (EARS 6 tripwire).
  test.fail('EARS 6: 人間レビュー待ち一覧からの除外表示（未描画）', async ({ page }) => {
    await loadFixture(page, requirementsAccepted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });
});
