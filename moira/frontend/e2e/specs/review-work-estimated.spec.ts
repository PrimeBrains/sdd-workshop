// E2E regression for units/review-work-estimated (計器③). Metric-rich: the P2
// discovery signal 100%→50%→100% is the load-bearing behavior. The During and After
// 断面 cross-validate each other's coverage assertions (mutual non-vacuity).
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { estimateBadge, metric, specRow } from '../selectors';
import { reviewWorkAfter, reviewWorkDuring } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './review-work-estimated.meta';

const PHASES = ['F/req', 'F/design', 'F/tasks'];
const REVIEWS = ['F/review-req', 'F/review-design', 'F/review-tasks'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After: 6 葉が agreed・依存辺・見積カバレッジ 100% 回復 [EARS 1,2,5,6,8]', async ({ page }) => {
    await loadFixture(page, reviewWorkAfter);
    const root = await navTo(page, 'spec-value');
    for (const node of [...PHASES, ...REVIEWS]) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('見積合意済');
    }
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
    // EARS 2: 各フェーズ → レビュー作業ノードへの依存辺（policy=implemented）が描かれる。
    // policy 表示は glossary JA「完了で解放」（#10・EDGE_POLICY_JA.implemented、正準語は title）。
    await expect(root).toContainText('F/req ──完了で解放──▸ F/review-req');
  });

  test('During: レビュー葉は proposed*・フェーズは agreed のまま・カバレッジ 50% 低下 [EARS 3,4,7,8]', async ({ page }) => {
    await loadFixture(page, reviewWorkDuring);
    await navTo(page, 'spec-value');
    for (const node of REVIEWS) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('見積提案中*');
    }
    for (const node of PHASES) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('見積合意済');
    }
    await expect(metric(page, 'estimate-coverage')).toHaveText('50%');
  });
});
