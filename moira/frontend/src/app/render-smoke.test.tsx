// Render smoke — mounts the real components with the rich demo data via
// renderToStaticMarkup. Catches runtime errors (undefined access, bad geometry)
// that type-checking and data tests miss. No browser needed.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoiraProvider } from '../moira/store';
import { App } from '../App';
import { HealthSurface } from '../surfaces/health/HealthSurface';
import { CapacitySurface } from '../surfaces/capacity/CapacitySurface';
import { SpecValueSurface } from '../surfaces/spec/SpecValueSurface';
import { DecisionInboxSurface } from '../surfaces/inbox/DecisionInboxSurface';
import { demoEvents, demoCapacity, DEMO_AS_OF } from '../moira/demo-data';

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <MoiraProvider initialEvents={demoEvents} initialCapacity={demoCapacity} initialAsOf={DEMO_AS_OF}>
      {node}
    </MoiraProvider>,
  );

describe('surfaces render without throwing', () => {
  it('shell + default schedule-time surface (Gantt over demo data)', () => {
    const html = wrap(<App />);
    expect(html).toContain('Moira');
    expect(html).toContain('schedule-time');
    expect(html).toContain('Gantt');
    expect(html).toContain('認証基盤'); // demo feature label
    expect(html).toContain('未割当バックログ');
    expect(html).toContain('PV不算入'); // state C (hotfix) is drawn
  });

  it('schedule-time gantt highlights the P7 critical path (issue #16)', () => {
    const html = wrap(<App />);
    expect(html).toContain('data-critical-path="true"'); // some row is on the chain
    expect(html).toContain('クリティカルパス（依存のつながりで最長の経路）'); // legend appears only when a chain exists
  });

  it('health surface (two zones, de-rate, honest null/empty)', () => {
    const html = wrap(<HealthSurface />);
    expect(html).toContain('現行進捗');
    expect(html).toContain('累積稼得');
    expect(html).toContain('着地予想'); // landing burnup (issue #13)
    expect(html).toContain('期限未設定'); // demo data has no deadline → honest neutral verdict
    expect(html).toContain('CCPM'); // fever itself stays disclosed as future work
  });

  it('capacity surface (heatmap + editor + R-U14 history)', () => {
    const html = wrap(<CapacitySurface />);
    expect(html).toContain('capacity ヒートマップ');
    expect(html).toContain('改定履歴');
    expect(html).toContain('契約稼働率');
    expect(html).toContain('田中');
  });

  it('spec-value surface (tree + coverage table + traceability)', () => {
    const html = wrap(<SpecValueSurface />);
    expect(html).toContain('ノード木');
    expect(html).toContain('被覆マトリクス');
    expect(html).toContain('トレーサビリティ');
    expect(html).toContain('置き換え');
  });

  it('decision inbox (4 plain-language sections, no dismiss)', () => {
    const html = wrap(<DecisionInboxSurface onNavigate={() => {}} />);
    expect(html).toContain('判断要');
    // the 4 decisionType sections (issue #12)
    expect(html).toContain('見積に合意する');
    expect(html).toContain('担当を割り当てる');
    expect(html).toContain('受入判断する');
    expect(html).toContain('警告に対処する');
    expect(html).toContain('見積合意の矛盾'); // demo trigger fires (conflicting agreement)
    expect(html).toContain('差し戻しリスク'); // demo trigger fires (design diff-back at-risk)
  });
});
