// Portfolio render smoke (issue #23) — mounts the real PortfolioShell over two
// real fixtures (demo + tiny) plus a loadError entry, via renderToStaticMarkup.
// Catches runtime errors type-checking misses; the E2E layer comes later via
// kiro-scenario (計器③) once a human-seeded scenario unit exists.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortfolioProvider } from '../moira/portfolio-store';
import type { PortfolioFixture } from '../moira/portfolio-context';
import { demoCapacity, demoEvents, DEMO_AS_OF } from '../moira/demo-data';
import { tinyProjectEvents } from '../moira/engine';
import { PersonView } from '../surfaces/portfolio/PersonView';
import { PortfolioOverview } from '../surfaces/portfolio/PortfolioOverview';
import { PortfolioShell } from './PortfolioShell';

const FIXTURE: PortfolioFixture = {
  portfolio: [
    { key: 'proj-a', label: '案件A（デモ）', events: demoEvents, capacity: demoCapacity },
    { key: 'proj-b', label: '案件B（tiny）', events: tinyProjectEvents },
    { key: 'proj-c', label: '壊れた案件', loadError: '.moira/ (config.json) が見つからない: /x' },
  ],
  asOf: DEMO_AS_OF,
  label: '部門ポートフォリオ',
};

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(<PortfolioProvider initialFixture={FIXTURE}>{node}</PortfolioProvider>);

describe('portfolio shell renders without throwing', () => {
  it('shell + overview: every home is a row; the broken home is a VISIBLE error row', () => {
    const html = wrap(<PortfolioShell />);
    expect(html).toContain('ポートフォリオ — 部門ポートフォリオ');
    expect(html).toContain('案件A（デモ）');
    expect(html).toContain('案件B（tiny）');
    expect(html).toContain('壊れた案件');
    expect(html).toContain('読込エラー:');
    expect(html).toContain('基準日（全案件で統一）');
    expect(html).toContain('ログのマージなし（D-50）');
  });

  it('overview totals only counts (readable projects only) and discloses why honestly', () => {
    const html = wrap(<PortfolioOverview onOpenProject={() => {}} />);
    expect(html).toContain('合計（読めた2案件・件数のみ）'); // 2 ok + 1 loadError in FIXTURE
    expect(html).toContain('横断の合成会計は行いません（D-50）');
    // corrected rationale (R1): units ARE common (A6) — non-aggregation is a design judgment
    expect(html).toContain('集約は案件間の分散（危機案件）を平均で隠すため採らない設計判断');
    expect(html).toContain('粒度');
    expect(html).toContain('同じ基準日で単独ダッシュボードを開いたときと同じ数値');
    expect(html).toContain('バッファ残');
    expect(html).toContain('レビュー待ち');
  });

  it('person view carries the permanent D-50 / Actor.id disclosure and excluded-home banner', () => {
    const html = wrap(<PersonView />);
    expect(html).toContain('人横断（掛け持ちの見える化）');
    expect(html).toContain('容量整合の強制・平準化は行いません（D-50）');
    expect(html).toContain('人の同定は Actor.id の一致のみ');
    expect(html).toContain('完了予定日・凍結スロットの同日一致'); // proxy semantics disclosed
    expect(html).toContain('未宣言日を 1.0 と見なして合算しません');
    // a broken home must NOT silently vanish from the person view
    expect(html).toContain('読み込めなかった案件は本ビューに含まれていません');
    expect(html).toContain('壊れた案件');
  });
});
