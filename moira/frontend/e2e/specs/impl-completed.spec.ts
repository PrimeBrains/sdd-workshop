// E2E regression for units/impl-completed (計器③) — the spine's terminal. Both impls
// + the impl review complete (EV% → 100% REAL), all 9 leaves accepted, and the human
// signs off F (accepted): the only feature completion in the backbone. The real 100%
// has P2 100% (vs the apparent 100% at P2 75% in tasks-completed).
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, lifecycleBadge, metric, specRow } from '../selectors';
import { implCompleted, implEstimateAgreed, tasksCompleted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './impl-completed.meta';

const IMPL = ['F/impl-1', 'F/impl-2', 'F/review-impl'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After 実装完了: 実装3葉+F が accepted・EV% 100% 本物・P2 100% [EARS 10,12,14,15,16]', async ({ page }) => {
    await loadFixture(page, implCompleted);
    await navTo(page, 'spec-value');
    // EARS 10/12/14: 実装・実装レビューが accepted（子9葉完了）
    for (const node of IMPL) {
      await expect(lifecycleBadge(specRow(page, node))).toHaveText('検収済');
    }
    // EARS 15: 人間が F を完了へ＝背骨唯一の feature accepted（終端）
    await expect(lifecycleBadge(specRow(page, 'F'))).toHaveText('検収済');
    // EARS 16: 本物の 100%（P2 も 100%）
    await expect(metric(page, 'ev-percent')).toHaveText('100.0%');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
    // EARS 3/4/9: binary EV — impl-1=8, impl-2=6, review-impl=2 満額
    await expect(covRow(page, 'F/impl-1')).toContainText('8');
    await expect(covRow(page, 'F/impl-2')).toContainText('6');
    await expect(covRow(page, 'F/review-impl')).toContainText('2');
  });

  // Real vs apparent: tasks-completed shows 100% at P2 75% (apparent); here P2 100%.
  test('本物の 100%: 見かけ(P2 75%) と対比して P2 100% [EARS 16 distinction]', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'estimate-coverage')).toHaveText('75%'); // apparent
    await loadFixture(page, implCompleted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%'); // real
  });

  // Non-vacuity for EARS 15: before impl completion F is still pending.
  test('非空虚: 実装完了前は F=pending（F accepted の非空虚） [witness]', async ({ page }) => {
    await loadFixture(page, implEstimateAgreed);
    await navTo(page, 'spec-value');
    await expect(lifecycleBadge(specRow(page, 'F'))).toHaveText('未着手');
  });

  // EARS 6,18: completion / feature sign-off stay out of the decision inbox.
  test('EARS 6,18: 実装完了・F 完了は decision インボックスに出ない', async ({ page }) => {
    await loadFixture(page, implCompleted);
    const inbox = await navTo(page, 'decision-inbox');
    // 正の対照: インボックス自体は描画されている（負アサートの空虚化防止）。
    await expect(inbox.getByTestId('inbox-total')).toBeVisible();
    await expect(inbox).not.toContainText('F/impl-1');
  });

  // ── xfail tripwires ──
  test.fail('EARS 13: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, implCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 19: reviewer 列（担当とは別）が出る（未描画）', async ({ page }) => {
    await loadFixture(page, implCompleted);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/impl-1').getByTestId('reviewer-badge')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 20: レビュー担当フィルタ（未供給）', async ({ page }) => {
    await loadFixture(page, implCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue-filter:reviewer')).toBeVisible({ timeout: 2000 });
  });
});
