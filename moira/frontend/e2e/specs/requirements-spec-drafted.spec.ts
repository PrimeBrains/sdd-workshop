// E2E regression for units/requirements-spec-drafted (計器③) — the xfail showcase.
// The slice renders lifecycle state + EV% (green regression locks), but the
// reviewer column, the agent/human review-queue lists, 3-of-4 schedule dates, and
// the reviewer filter are defined-but-未描画 → they ride as test.fail() tripwires that
// flip CI red the moment the slice implements them. The 24% EV assert is proven
// non-vacuous by the Before/Given fixture (0.0%).
import { test, expect } from '@playwright/test';
import { loadFixture, navTo, selectGanttRow } from '../helpers';
import { covRow, inspectorField, lifecycleBadge, metric, specRow } from '../selectors';
import { requirementsBefore, requirementsDrafted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './requirements-spec-drafted.meta';

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 打鍵: req=implemented・EV% 24.0%・EV寄与 二値・自動承認しない [EARS 1,2,3,14]', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'spec-value');
    // EARS 1 (作成完了) + EARS 14 (自動承認しない): lifecycle は implemented で accepted でない。
    // スライスは英語ラベルを描画（シナリオ JP「レビュー待ち」は目標＝meta にラベル差を記録）。
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('implemented');
    // EARS 2: 出来高が要件定義分だけ上がる（0%→24.0%）。
    await expect(metric(page, 'ev-percent')).toHaveText('24.0%');
    // EARS 3: 二値（部分EVなし）— req の被覆行は満額の凍結予算 3 を示す。
    await expect(covRow(page, 'F/req')).toContainText('3');
  });

  // Non-vacuity for EARS 2/3 + EARS 10 (承認前に出来高を増減しない): the Before/Given
  // fixture (nothing completed) renders 0.0%, so the 24% assert above cannot false-pass.
  test('Before/Given: EV% 0.0%（24% アサートの非空虚を証明） [EARS 10 + 非空虚]', async ({ page }) => {
    await loadFixture(page, requirementsBefore);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('0.0%');
  });

  // EARS 9: 成果物のレビュー待ちは横断 decision インボックスに出さない。
  test('EARS 9: 要件定義は decision インボックスに出ない', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox).not.toContainText('F/req');
  });

  // EARS 12 (partial / green portion): the Inspector read-zone fields that DO exist
  // today (EV・PV) render — locked against regression while the 3 missing dates xfail.
  test('EARS 12 (部分): Inspector に EV・PV が出る（実在分の回帰固定）', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'schedule-time');
    await selectGanttRow(page, 'F/req');
    await expect(inspectorField(page, 'ev')).toBeVisible();
    await expect(inspectorField(page, 'pv')).toBeVisible();
  });

  // ── xfail tripwires: each backed by an explicit "(スライス未描画)" line in the unit ──

  test.fail('EARS 5/6: 人間レビュー待ちキューの一覧（未描画 :241-259,:400）', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 7/11: reviewer 列（担当とは別）が spec-value に出る（未描画 :171-172,:217,:400）', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/req').getByTestId('reviewer-badge')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 12: Inspector に予定開始日・実績開始日・実績終了日（未描画 :286-302,:403）', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'schedule-time');
    await selectGanttRow(page, 'F/req');
    await expect(inspectorField(page, 'planned-start')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 13: レビュー担当フィルタ（未供給 :261-284,:402）', async ({ page }) => {
    await loadFixture(page, requirementsDrafted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue-filter:reviewer')).toBeVisible({ timeout: 2000 });
  });
});
