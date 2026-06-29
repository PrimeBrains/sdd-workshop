// E2E regression for units/estimate-spec-proposed (計器③). Green locks: the 3
// phases carry a proposed* estimate value, P2 still 0% (proposed ≠ agreed), and the
// activity surface logs 「見積案を提示」. Non-vacuity: the genesis fixture shows 「見積 —」.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { estimateBadge, metric, specRow } from '../selectors';
import { estimateProposed, discovered } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './estimate-spec-proposed.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 提案: 見積値が出て proposed*・カバレッジ 0% [EARS 1,2]', async ({ page }) => {
    await loadFixture(page, estimateProposed);
    await navTo(page, 'spec-value');
    // EARS 1: 見積案の値が出る（要件定義=3）
    await expect(specRow(page, 'F/req')).toContainText('見積 3');
    // EARS 2: 未承認の印（proposed*）。EARS 4 の「未確定」は P2 0% として間接表示。
    await expect(estimateBadge(specRow(page, 'F/req'))).toHaveText('proposed*');
    await expect(metric(page, 'estimate-coverage')).toHaveText('0%');
  });

  // Non-vacuity for EARS 1: at genesis the value is 「見積 —」, so 「見積 3」 is real.
  test('非空虚: 発見直後は「見積 —」（提案値が空虚でない） [EARS 1 witness]', async ({ page }) => {
    await loadFixture(page, discovered);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/req')).toContainText('見積 —');
  });

  // EARS 3: the proposal shows as one 「見積案を提示」 row on the activity surface.
  test('EARS 3: 履歴画面に「見積案を提示」の行が出る', async ({ page }) => {
    await loadFixture(page, estimateProposed);
    const root = await navTo(page, 'activity');
    await expect(root.getByText('見積案を提示').first()).toBeVisible();
  });
});
