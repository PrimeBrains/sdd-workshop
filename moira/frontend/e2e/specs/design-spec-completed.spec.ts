// E2E regression for units/design-spec-completed (計器③). Green locks the EV arc to
// 80% (design completed +5, reviewed +1, approval adds none), terminal lifecycles
// (design/review accepted, tasks implementing), binary EV, and inbox-absence.
// Reviewer column / queues / schedule dates / filter ride as xfail tripwires.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, lifecycleBadge, metric, specRow } from '../selectors';
import { designCompleted, requirementsAccepted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './design-spec-completed.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 設計完了: design/review=accepted・tasks=implementing・EV% 80.0% [EARS 1,2,3,11,12,16,18]', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'spec-value');
    await expect(lifecycleBadge(specRow(page, 'F/design'))).toHaveText('accepted'); // EARS 12
    await expect(lifecycleBadge(specRow(page, 'F/review-design'))).toHaveText('accepted'); // EARS 16
    await expect(lifecycleBadge(specRow(page, 'F/tasks'))).toHaveText('implementing'); // EARS 18
    await expect(metric(page, 'ev-percent')).toHaveText('80.0%'); // EARS 2,13,14,19
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
    await expect(covRow(page, 'F/design')).toContainText('5'); // EARS 3 binary full budget
    await expect(covRow(page, 'F/review-design')).toContainText('1'); // EARS 11,15
  });

  // Non-vacuity for EARS 2: before design completed the metric reads 32.0%.
  test('非空虚: 設計完了前は EV% 32.0%（80% の非空虚） [witness]', async ({ page }) => {
    await loadFixture(page, requirementsAccepted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('32.0%');
  });

  // EARS 9/24: design completion / approval / tasks-start stay out of the inbox.
  test('EARS 9,24: 設計の完了・承認・タスク着手は decision インボックスに出ない', async ({ page }) => {
    await loadFixture(page, designCompleted);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox).not.toContainText('F/design');
    await expect(inbox).not.toContainText('F/tasks');
  });

  // ── xfail tripwires (defined-but-未描画 observables) ──
  test.fail('EARS 6,17: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 7,21: reviewer 列（担当とは別）が出る（未描画）', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/design').getByTestId('reviewer-badge')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 22: Inspector に予定開始日（未描画）', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('field:planned-start')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 23: レビュー担当フィルタ（未供給）', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue-filter:reviewer')).toBeVisible({ timeout: 2000 });
  });
});
