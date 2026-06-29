// E2E regression for units/estimate-impl-agreed (計器③). The 正直化 moment: agreeing
// the impl estimates grows the denominator 12.5→28.5, so the apparent 100% drops to
// the honest 43.9% (non-monotonic) while estimate coverage recovers 75→100%.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, estimateBadge, lifecycleBadge, metric, specRow } from '../selectors';
import { implEstimateAgreed, tasksCompleted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './estimate-impl-agreed.meta';

const IMPL = ['F/impl-1', 'F/impl-2', 'F/review-impl'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 実装見積合意: EV% 43.9%・P2 100%・実装ノード agreed [EARS 4,6,7]', async ({ page }) => {
    await loadFixture(page, implEstimateAgreed);
    await navTo(page, 'spec-value');
    // EARS 7: 全体量増（12.5→28.5）で達成率が正直に下がる
    await expect(metric(page, 'ev-percent')).toHaveText('43.9%');
    // EARS 6: 見積カバレッジ回復（75→100%）・実装3ノードが agreed
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
    for (const node of IMPL) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('agreed');
    }
    // EARS 4: 実装レビュー作業ノードが存在する
    await expect(specRow(page, 'F/review-impl')).toBeVisible();
  });

  // EARS 7 + non-vacuity: before agreement the apparent figure is 100.0% / P2 75%.
  test('正直化: 合意前 100.0%/P2 75% → 合意後 43.9%/P2 100% [EARS 6,7]', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('100.0%'); // apparent
    await expect(metric(page, 'estimate-coverage')).toHaveText('75%');
  });

  // EARS 9: existing spec leaves are untouched (still accepted, EV contribution intact).
  test('EARS 9: 既存 req/design/tasks の完了状態・出来高は不変', async ({ page }) => {
    await loadFixture(page, implEstimateAgreed);
    await navTo(page, 'spec-value');
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('accepted');
    await expect(covRow(page, 'F/req')).toContainText('3'); // EV寄与 unchanged
  });

  // EARS 6: the agreement reads as 「見積を承認」 on the activity surface.
  test('活動履歴に「見積を承認」の行が出る', async ({ page }) => {
    await loadFixture(page, implEstimateAgreed);
    const root = await navTo(page, 'activity');
    await expect(root.getByText('見積を承認').first()).toBeVisible();
  });
});
