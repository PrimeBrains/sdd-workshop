// Portfolio render smoke (issue #23) — mounts the real PortfolioShell over two
// real fixtures (demo + tiny) plus a loadError entry, via renderToStaticMarkup.
// Catches runtime errors type-checking misses; the E2E layer comes later via
// kiro-scenario (計器③) once a human-seeded scenario unit exists.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortfolioProvider } from '../moira/portfolio-store';
import type { PortfolioFixture } from '../moira/portfolio-context';
import { demoCapacity, demoEvents, DEMO_AS_OF } from '../moira/demo-data';
import { tinyProjectEvents, TINY_AS_OF } from '../moira/engine';
import { deriveProject } from '../moira/portfolio-derive';
import { useMoira } from '../moira/hooks';
import { PersonView } from '../surfaces/portfolio/PersonView';
import { PortfolioOverview } from '../surfaces/portfolio/PortfolioOverview';
import { PortfolioShell, DrilldownProvider, applyDrilldownSlice, type DrillSyncIo } from './PortfolioShell';
import { resolveOrgCalendarEnabled } from '../moira/store';

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

// A regression test for a bug found in independent review: PortfolioShell's
// drill-down did not pass the case's own `orgCalendarEnabled` (issue #32) into
// the `MoiraProvider` it mounts, so a project with the org calendar disabled in
// the portfolio list silently reverted to enabled in its single-project view —
// the list and the drill-down disagreed on the same case's forecast.
//
// renderToStaticMarkup has no event handling, so the click that normally drives
// the drill-down can't be simulated here. `DrilldownProvider` (extracted from
// PortfolioShell for exactly this reason) takes `children`, so the test can
// mount it directly with a `children` PROBE that reads `useMoira()` back out —
// proving what the mounted provider's context actually resolves to, without
// needing to fake the click.
function OrgCalendarProbe() {
  const { orgCalendarEnabled } = useMoira();
  return <div data-testid="probe-org-cal">{String(orgCalendarEnabled)}</div>;
}

describe('PortfolioShell drill-down propagates the per-project orgCalendarEnabled (issue #32)', () => {
  it('a project fixture with orgCalendarEnabled: false reaches the drilled provider as false', () => {
    const via = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: false },
      TINY_AS_OF,
    );
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;

    const html = renderToStaticMarkup(
      <DrilldownProvider project={via.data} asOf={TINY_AS_OF}>
        <OrgCalendarProbe />
      </DrilldownProvider>,
    );
    expect(html).toContain('data-testid="probe-org-cal">false<');
  });

  it('a project fixture with orgCalendarEnabled UNSET still resolves to true (the `!== false` default is preserved)', () => {
    const via = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF);
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;
    expect(via.data.orgCalendarEnabled).toBeUndefined(); // raw passthrough, not pre-resolved

    const html = renderToStaticMarkup(
      <DrilldownProvider project={via.data} asOf={TINY_AS_OF}>
        <OrgCalendarProbe />
      </DrilldownProvider>,
    );
    expect(html).toContain('data-testid="probe-org-cal">true<');
  });
});

// A regression test for the UPDATE path specifically (the Major found in
// independent review of the #32 initial-propagation fix above): a case's
// orgCalendarEnabled can also change via a portfolio LIVE refetch while
// already drilled in — not just at first mount. `renderToStaticMarkup` has no
// effect timing (SSR is one synchronous pass; `useEffect` never runs), so the
// full effect → setState → re-render → capacityOf chain can't be observed
// through a DOM-free render the way this file's other tests work. Instead —
// mirroring live.tsx/live.test.ts's `createLiveRefetcher` (issue #6): the
// side-effecting logic is extracted into `applyDrilldownSlice`, a plain
// function over injected io ports, tested here WITHOUT a DOM. The
// React-guaranteed half (an effect firing on a changed prop re-renders with
// the new context value) is not re-proven; the two halves that actually
// carried the bug — (1) does the update path push org-calendar at all, and
// (2) does it use the SAME resolution rule as the initial mount — are.
describe('applyDrilldownSlice pushes a FRESH org-calendar value on a live update (issue #32 update-path fix)', () => {
  function recordedIo(): { io: DrillSyncIo; calls: string[]; orgCalendarPushes: Array<boolean | undefined> } {
    const calls: string[] = [];
    const orgCalendarPushes: Array<boolean | undefined> = [];
    const io: DrillSyncIo = {
      applyLabels: () => calls.push('labels'),
      applyRoster: () => calls.push('roster'),
      replaceSnapshot: () => calls.push('snapshot'),
      setOrgCalendarEnabled: (raw) => {
        calls.push('orgCalendar');
        orgCalendarPushes.push(raw);
      },
    };
    return { io, calls, orgCalendarPushes };
  }

  it('true → false: the RAW false value is pushed through setOrgCalendarEnabled', () => {
    const before = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF); // unset (resolves true)
    const after = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: false },
      TINY_AS_OF,
    );
    expect(before.kind).toBe('ok');
    expect(after.kind).toBe('ok');
    if (before.kind !== 'ok' || after.kind !== 'ok') return;

    const { io, orgCalendarPushes } = recordedIo();
    applyDrilldownSlice(before.data, io); // simulates the initial slice (unset)
    applyDrilldownSlice(after.data, io); // simulates a live refetch flipping it off
    expect(orgCalendarPushes).toEqual([undefined, false]); // RAW, not pre-resolved booleans
  });

  it('false → true: a later refetch that turns the org calendar back on is pushed too', () => {
    const before = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: false },
      TINY_AS_OF,
    );
    const after = deriveProject(
      { key: 'k', label: 'L', events: tinyProjectEvents, orgCalendarEnabled: true },
      TINY_AS_OF,
    );
    expect(before.kind).toBe('ok');
    expect(after.kind).toBe('ok');
    if (before.kind !== 'ok' || after.kind !== 'ok') return;

    const { io, orgCalendarPushes } = recordedIo();
    applyDrilldownSlice(before.data, io);
    applyDrilldownSlice(after.data, io);
    expect(orgCalendarPushes).toEqual([false, true]);
  });

  it('pushes registries and the log snapshot BEFORE the org-calendar setting (registry-first, #6 ordering)', () => {
    const via = deriveProject({ key: 'k', label: 'L', events: tinyProjectEvents }, TINY_AS_OF);
    expect(via.kind).toBe('ok');
    if (via.kind !== 'ok') return;

    const { io, calls } = recordedIo();
    applyDrilldownSlice(via.data, io);
    expect(calls).toEqual(['labels', 'roster', 'snapshot', 'orgCalendar']);
  });
});

// Binds the update-path setter (store.tsx `setOrgCalendarEnabled`) to the
// EXACT SAME resolution rule as the initial mount — both call through
// `resolveOrgCalendarEnabled`, so this one function is what the "one place"
// discipline (issue #32) actually rests on. A regression here would mean the
// update path could silently diverge from the mount-time default-on rule.
describe('resolveOrgCalendarEnabled (the shared mount + update resolution rule)', () => {
  it('true → false is a real transition, not a no-op', () => {
    expect(resolveOrgCalendarEnabled(true)).toBe(true);
    expect(resolveOrgCalendarEnabled(false)).toBe(false);
  });

  it('false → undefined (unset) resolves back to true — the default-on rule', () => {
    expect(resolveOrgCalendarEnabled(false)).toBe(false);
    expect(resolveOrgCalendarEnabled(undefined)).toBe(true);
  });
});
