// E2E regression for units/requirements-spec-returned (計器③). The headline: a
// return REVERTS earned value (EV% 24→8) while the review work keeps its own EV (1).
// Non-vacuity: the drafted before-fixture shows 24.0%. queue list rides as xfail.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, lifecycleBadge, metric, specRow } from '../selectors';
import { requirementsReturned, requirementsDrafted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './requirements-spec-returned.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 差し戻し: req=implementing・EV% 8.0%・レビュー出来高は別に残る [EARS 2,3,4,5,8]', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    await navTo(page, 'spec-value');
    // EARS 4: 要件定義はレビュー待ち→再作業中（implementing）へ後退
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('implementing');
    // EARS 5: 差し戻しで要件定義ぶんの出来高を失う（24%→8%）
    await expect(metric(page, 'ev-percent')).toHaveText('8.0%');
    // EARS 2/3/8: レビュー作業は満額の出来高 1 を別行で保持（二値・区別）
    await expect(covRow(page, 'F/review-req')).toContainText('完了');
    await expect(covRow(page, 'F/review-req')).toContainText('1');
  });

  // Non-vacuity for EARS 5: the drafted (pre-return) fixture reads 24.0%.
  test('非空虚: 差し戻し前は EV% 24.0%（後退の非空虚） [EARS 5 witness]', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('24.0%');
  });

  // EARS 10: the return itself is NOT a cross-cutting decision item (no 「差し戻し」
  // row). NB: the node may still appear as a P5 at-risk warning (a separate, expected
  // MODEL signal) — so we assert the absence of a return-as-decision, not the node id.
  test('EARS 10: 差し戻しは decision インボックスの判断項目に出ない', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox).not.toContainText('差し戻し');
  });

  // The return reads as 「差し戻し（再着手）」 on the activity surface.
  test('活動履歴に「差し戻し」の行が出る', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    const root = await navTo(page, 'activity');
    await expect(root.getByText('差し戻し（再着手）').first()).toBeVisible();
  });

  // xfail: human-review queue list is 未描画 (EARS 7 tripwire).
  test.fail('EARS 7: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });
});
