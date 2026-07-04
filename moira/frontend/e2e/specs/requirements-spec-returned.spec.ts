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
    await expect(lifecycleBadge(specRow(page, 'F/req'))).toHaveText('作業中');
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

  // EARS 10 (unit :396): 差し戻しという事象そのものは横断 decision の判断項目にならない。
  // 【裁定 2026-07-04: 実装が正】unit §4-4 は inbox を空と描くが、差し戻された F/req は
  // #12 の warning セクションに P5「差し戻しリスク」として出る（unit 自身も §4-2/§7 で P5 を
  // 「正直な信号」と期待しており、実画面提示のうえユーザーが実装側を正と裁定）。よって
  // (a) コミット判断3セクションに F/req が項目として出ないこと（EARS 10 の核心）と、
  // (b) P5 警告が warning セクションに出ること（裁定後の期待信号）の両方を回帰固定する。
  // unit §4-4/EARS 10 文言の改訂は kiro-scenario 所管の follow-up。
  test('EARS 10: 差し戻しは decision インボックスの判断項目に出ない', async ({ page }) => {
    await loadFixture(page, requirementsReturned);
    const inbox = await navTo(page, 'decision-inbox');
    await expect(inbox.getByTestId('inbox-section:estimate')).not.toContainText('F/req（');
    await expect(inbox.getByTestId('inbox-section:assign')).not.toContainText('F/req（');
    await expect(inbox.getByTestId('inbox-section:accept')).not.toContainText('受入判断が必要: F/req（');
    // 裁定後の期待信号: P5 差し戻しリスクは warning セクションに出る（判断項目化ではない）。
    await expect(inbox.getByTestId('inbox-section:warning')).toContainText('差し戻しリスク: F/req');
    // 非空虚 witness（正の対照）: セクション機構は実在の検収待ち項目を描画している。
    await expect(inbox.getByTestId('inbox-section:accept')).toContainText('F/review-req（完了・検収待ち）');
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
