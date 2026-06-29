// Flow-level E2E regression for flows/new-feature-happy-path (計器③, flow tier). Where
// the per-unit specs lock each snapshot, THIS spec walks the THROUGH-LINE: it boots
// the app at each backbone snapshot in order and asserts the EV%/coverage arc on
// spec-value, proving the emergent claim — the achievement signal stays honest at
// every seam from discovery (0%) to true completion (100% real, P2 100%).
import { test, expect } from '@playwright/test';
import { loadFixture, navTo } from '../helpers';
import { lifecycleBadge, metric, specRow } from '../selectors';
import { BACKBONE } from '../fixtures/scenario-fixtures';
import { SPEC_META } from './new-feature-happy-path.flow.meta';

// The expected rendered arc (spec-value renders EV% at 1 decimal, coverage at 0).
// EV% 0→24→8→32→80→100(apparent)→43.9→100(real); P2 0→100→75→100.
const ARC: Record<string, { ev: string; cov: string }> = {
  'discovery-spec-initialized': { ev: '0.0%', cov: '0%' },
  'estimate-spec-proposed': { ev: '0.0%', cov: '0%' },
  'estimate-spec-agreed': { ev: '0.0%', cov: '100%' },
  'requirements-spec-drafted': { ev: '24.0%', cov: '100%' },
  'requirements-spec-returned': { ev: '8.0%', cov: '100%' },
  'requirements-spec-re-returned': { ev: '8.0%', cov: '100%' },
  'requirements-spec-accepted': { ev: '32.0%', cov: '100%' },
  'design-spec-completed': { ev: '80.0%', cov: '100%' },
  'tasks-spec-completed': { ev: '100.0%', cov: '75%' },
  'estimate-impl-agreed': { ev: '43.9%', cov: '100%' },
  'impl-completed': { ev: '100.0%', cov: '100%' },
};

test.describe(SPEC_META.scenarioUnit, () => {
  // EARS 1,3: the whole arc — EV% rises on completion, holds on approval, and the
  // coverage pair-read stays visible at every snapshot.
  test('通しの弧: 11 断面で EV%/見積カバレッジが宣言どおり遷移する [EARS 1,3]', async ({ page }) => {
    for (const { slug, fixture } of BACKBONE) {
      const exp = ARC[slug]!;
      await loadFixture(page, fixture);
      await navTo(page, 'spec-value');
      await expect(metric(page, 'ev-percent'), `${slug}: EV%`).toHaveText(exp.ev);
      await expect(metric(page, 'estimate-coverage'), `${slug}: P2`).toHaveText(exp.cov);
    }
  });

  // EARS 2: a return reverts EV (24% → 8%) — the seam where rework shows its cost.
  test('差し戻しで EV% が後退する（24.0% → 8.0%） [EARS 2]', async ({ page }) => {
    const drafted = BACKBONE.find((b) => b.slug === 'requirements-spec-drafted')!.fixture;
    const returned = BACKBONE.find((b) => b.slug === 'requirements-spec-returned')!.fixture;
    await loadFixture(page, drafted);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('24.0%');
    await loadFixture(page, returned);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('8.0%');
  });

  // EARS 4: apparent 100% is NOT presented as absolute completion — coverage 75%.
  test('見かけ100%は P2 75% で正直に注意される [EARS 4]', async ({ page }) => {
    const tasks = BACKBONE.find((b) => b.slug === 'tasks-spec-completed')!.fixture;
    await loadFixture(page, tasks);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('100.0%');
    await expect(metric(page, 'estimate-coverage')).toHaveText('75%');
  });

  // EARS 5: agreeing impl scope grows the total → EV% drops non-monotonically 100→43.9.
  test('正直化: 実装見積合意で達成率が 100.0% → 43.9% に下がる [EARS 5]', async ({ page }) => {
    const impl = BACKBONE.find((b) => b.slug === 'estimate-impl-agreed')!.fixture;
    await loadFixture(page, impl);
    await navTo(page, 'spec-value');
    await expect(metric(page, 'ev-percent')).toHaveText('43.9%');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
  });

  // EARS 6,7: the terminal — F accepted, real 100% (coverage also 100%).
  test('終端: F が accepted・本物の100%（P2 も100%） [EARS 6,7]', async ({ page }) => {
    const done = BACKBONE.find((b) => b.slug === 'impl-completed')!.fixture;
    await loadFixture(page, done);
    await navTo(page, 'spec-value');
    await expect(lifecycleBadge(specRow(page, 'F'))).toHaveText('accepted');
    await expect(metric(page, 'ev-percent')).toHaveText('100.0%');
    await expect(metric(page, 'estimate-coverage')).toHaveText('100%');
  });
});
