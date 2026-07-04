// E2E regression for units/tasks-spec-completed (計器③). The honesty climax: every
// spec phase is accepted and EV% reads 100% — but it is APPARENT, because impl-1/
// impl-2 are born unestimated and estimate coverage drops to 75%. The screen shows
// 100% and 75% together so the apparent 100% can't be mistaken for done.
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { covRow, estimateBadge, lifecycleBadge, metric, specRow } from '../selectors';
import { tasksCompleted, designCompleted } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './tasks-spec-completed.meta';

const SPEC_LEAVES = ['F/req', 'F/design', 'F/tasks', 'F/review-req', 'F/review-design', 'F/review-tasks'];

test.describe(SPEC_META.scenarioUnit, () => {
  test('After タスク完了: 全 spec 葉 accepted・EV% 100% 見かけ・P2 75% [EARS 12,16,18,20,21]', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'spec-value');
    // EARS 18: 全 spec 葉が accepted
    for (const node of SPEC_LEAVES) {
      await expect(lifecycleBadge(specRow(page, node))).toHaveText('検収済');
    }
    // EARS 21: 見かけ 100% と P2 75% を同時に正直表示（apparent ≠ done）
    await expect(metric(page, 'ev-percent')).toHaveText('100.0%');
    await expect(metric(page, 'estimate-coverage')).toHaveText('75%');
    // EARS 3/11: binary EV — tasks=2, review-tasks=0.5 満額
    await expect(covRow(page, 'F/tasks')).toContainText('2');
    await expect(covRow(page, 'F/review-tasks')).toContainText('0.5');
  });

  test('EARS 19,20: 実装ノードが未見積で誕生（proposed*・見積 —）', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/impl-1')).toBeVisible(); // 実装ノード誕生
    await expect(estimateBadge(specRow(page, 'F/impl-1'))).toHaveText('見積提案中*');
    await expect(specRow(page, 'F/impl-1')).toContainText('見積 —'); // 未見積
  });

  // Non-vacuity for EARS 20: before impl birth, coverage was 100%.
  test('非空虚: 実装誕生前は見積カバレッジ 100%（75% の非空虚） [witness]', async ({ page }) => {
    await loadFixture(page, designCompleted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
  });

  // EARS 9: task completion/approval is not an inbox item (F/tasks accepted → absent).
  // NB: the newly-born unestimated impl node legitimately DOES appear as a 「合意が必要」
  // commit (the estimate-impl-agreed next step), so EARS 27's impl-birth part is
  // deferred (see meta) — we assert only the タスク承認 part here.
  test('EARS 9: タスク承認は decision インボックスに出ない', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    const inbox = await navTo(page, 'decision-inbox');
    // 正の対照: インボックス自体は描画されている（負アサートの空虚化防止）。
    await expect(inbox.getByTestId('inbox-total')).toBeVisible();
    await expect(inbox).not.toContainText('F/tasks');
  });

  // ── xfail tripwires ──
  test.fail('EARS 6,17: 人間レビュー待ちキューの一覧（未描画）', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue:human-review')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 7,24: reviewer 列（担当とは別）が出る（未描画）', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'spec-value');
    await expect(specRow(page, 'F/tasks').getByTestId('reviewer-badge')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 25: Inspector に予定開始日（未描画）', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('field:planned-start')).toBeVisible({ timeout: 2000 });
  });

  test.fail('EARS 26: レビュー担当フィルタ（未供給）', async ({ page }) => {
    await loadFixture(page, tasksCompleted);
    await navTo(page, 'schedule-time');
    await expect(page.getByTestId('queue-filter:reviewer')).toBeVisible({ timeout: 2000 });
  });
});
