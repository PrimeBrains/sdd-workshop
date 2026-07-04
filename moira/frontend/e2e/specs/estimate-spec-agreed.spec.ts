// E2E regression for units/estimate-spec-agreed (計器③). Asserts the full target;
// the activity/history surface (新規) is now implemented, so EARS 5 is a green lock
// (was a test.fail tripwire). Green asserts are proven non-vacuous by the
// all-proposed before-fixture.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { estimateBadge, metric, specRow } from '../selectors';
import { estimateAgreed, estimateProposed } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './estimate-spec-agreed.meta';

const PHASES = ['F/req', 'F/design', 'F/tasks'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 承認: 3 フェーズが agreed・見積カバレッジ 100% [EARS 1,3,4]', async ({ page }) => {
    await loadFixture(page, estimateAgreed);
    await navTo(page, 'spec-value');
    for (const node of PHASES) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('見積合意済');
    }
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
  });

  // Non-vacuity + EARS 6 (WHILE 未承認 → agreed にしない): the SAME asserts must hold
  // the opposite values on the all-proposed before-fixture. If estimate-coverage read
  // 100% on empty/proposed data, the green assert above would be a false pass.
  test('Before 提案中: 3 フェーズが proposed*・見積カバレッジ 0%（非空虚） [EARS 6]', async ({ page }) => {
    await loadFixture(page, estimateProposed);
    await navTo(page, 'spec-value');
    for (const node of PHASES) {
      await expect(estimateBadge(specRow(page, node))).toHaveText('見積提案中*');
    }
    await expect(metric(page, 'estimate-coverage')).toHaveText('0%');
  });

  // EARS 5: 履歴（activity・新規サーフェス）の「見積を承認」行。surface 実装済み →
  // green 回帰固定（旧 test.fail トリップワイヤから昇格）。
  test('EARS 5: 履歴画面（activity 新規）に「見積を承認」行が出る', async ({ page }) => {
    await loadFixture(page, estimateAgreed);
    const root = await navTo(page, 'activity');
    await expect(root.getByText('見積を承認').first()).toBeVisible();
  });
});
