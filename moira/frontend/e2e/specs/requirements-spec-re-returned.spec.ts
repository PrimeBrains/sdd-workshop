// E2E regression for units/requirements-spec-re-returned (計器③). The fold: the
// second review adds NO new node (still 6 leaves) and leaves review-work EV/lifecycle
// untouched, while the requirement reverts again (EV% 32→8). Non-vacuity: the
// resubmitted before-fixture reads 32.0%.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, lifecycleBadge, metric, specRow } from '../selectors';
import { requirementsReReturned, requirementsResubmitted1 } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './requirements-spec-re-returned.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 二度目差し戻し: req=implementing・EV% 8.0%・レビュー作業据え置き [EARS 1,4,5,6]', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    await navTo(page, 'spec-value');
    // EARS 5/6: 要件定義が再び後退（implementing）・出来高 8.0%
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('implementing');
    await expect(metric(page, 'ev-percent')).toHaveText('8.0%');
    // EARS 4: レビュー作業の lifecycle は完了のまま（implemented）
    await expect(lifecycleBadge(specRow(page, 'F/review-req'))).toHaveText('implemented');
    // EARS 1: レビュー作業の出来高は 1 のまま
    await expect(covRow(page, 'F/review-req')).toContainText('1');
  });

  // EARS 2: the fold adds NO new work row — still exactly 6 leaves (no 4th review).
  test('EARS 2: 二度目レビューで新作業行を追加しない（葉数 6 のまま）', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    await navTo(page, 'spec-value');
    await expect(page.locator('[data-testid^="cov-row:"]')).toHaveCount(6);
  });

  // Non-vacuity for EARS 6: after the (seam) resubmit the value is back at 32.0%.
  test('非空虚: 再提出後は EV% 32.0%（再後退の非空虚） [EARS 6 witness]', async ({ page }) => {
    await loadFixture(page, requirementsResubmitted1);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('32.0%');
  });

  // EARS 10: the second return is not a cross-cutting decision item (no 「差し戻し」
  // row). The reverted node may still appear as a P5 at-risk warning (expected).
  test('EARS 10: 二度目の差し戻しも decision の判断項目に出ない', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox).not.toContainText('差し戻し');
  });

  // xfail: human-review queue list 未描画 (EARS 11 tripwire).
  test.fail('EARS 11: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });
});
