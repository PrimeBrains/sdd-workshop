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
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('作業中');
    await expect(metric(page, 'ev-percent')).toHaveText('8.0%');
    // EARS 4: レビュー作業の lifecycle は完了のまま（implemented）
    await expect(lifecycleBadge(specRow(page, 'F/review-req'))).toHaveText('完了(検収待ち)');
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

  // EARS 10: 二度目の差し戻しも判断項目にならない。【裁定 2026-07-04: 実装が正】
  // P5「差し戻しリスク」は warning セクションに出る期待信号（requirements-spec-returned の
  // EARS 10 と同じ裁定・詳細コメントは同 spec 参照）。判断項目の主題（再作業中の F/req が
  // コミット判断に並ばないこと）と P5 の表示の両方を回帰固定する。
  test('EARS 10: 二度目の差し戻しも decision の判断項目に出ない', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox.getByTestId('inbox-section:estimate')).not.toContainText('F/req（');
    await expect(inbox.getByTestId('inbox-section:assign')).not.toContainText('F/req（');
    await expect(inbox.getByTestId('inbox-section:accept')).not.toContainText('受入判断が必要: F/req（');
    // 裁定後の期待信号: P5 差し戻しリスクは warning セクションに出る（判断項目化ではない）。
    await expect(inbox.getByTestId('inbox-section:warning')).toContainText('差し戻しリスク: F/req');
    // 非空虚 witness（正の対照）: セクション機構は実在の検収待ち項目を描画している。
    await expect(inbox.getByTestId('inbox-section:accept')).toContainText('F/review-req（完了・検収待ち）');
  });

  // xfail: human-review queue list 未描画 (EARS 11 tripwire).
  test.fail('EARS 11: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, requirementsReReturned);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });
});
