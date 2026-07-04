// E2E regression for units/discovery-spec-initialized (計器③) — the genesis state.
// Green locks: F + 3 phase rows appear, all pending, P2 0%, NO impl row. The "0%"
// is proven non-vacuous against estimate-agreed's 100%. Activity shows the births.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { lifecycleBadge, metric, specRow } from '../selectors';
import { discovered, estimateAgreed } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './discovery-spec-initialized.meta';

const PHASES = ['F/req', 'F/design', 'F/tasks'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 発見: F+3フェーズが pending・見積カバレッジ 0%・実装行なし [EARS 1,2,3,5]', async ({ page }) => {
    await loadFixture(page, discovered);
    await navTo(page, 'spec-value');
    // EARS 1 (3行生成) + EARS 2 (lifecycle 適用＝pending)
    for (const node of PHASES) {
      await expect(specRow(page, node)).toBeVisible();
      await expect(lifecycleBadge(specRow(page, node))).toHaveText('未着手');
    }
    // EARS 3: 全行未見積 → 見積カバレッジ 0%
    await expect(metric(page, 'estimate-coverage')).toHaveText('0%');
    // EARS 5: 実装の行を生成してはならない
    await expect(specRow(page, 'F/impl-1')).toHaveCount(0);
  });

  // Non-vacuity for EARS 3: estimate-agreed renders 100%, so the 0% above is real.
  test('非空虚: estimate-agreed は 100%（0% アサートが空虚でない） [EARS 3 witness]', async ({ page }) => {
    await loadFixture(page, estimateAgreed);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
  });

  // The new activity surface records the births (フィーチャーを発見 / ノードを展開).
  test('活動履歴に発見の行が出る（activity 新規サーフェス）', async ({ page }) => {
    await loadFixture(page, discovered);
    const root = await navTo(page, 'activity');
    await expect(root.getByText('フィーチャーを発見').first()).toBeVisible();
  });
});
