// buildReport / formatReportText — the morning digest (issue #25). Events carry
// REAL epoch-ms timestamps (the seqStamper/Log ts=1,2,3… all land on 1970-01-01,
// useless for as-of prefix cuts), so each event is pinned to a UTC day — the
// same deviation landing.test.ts documents.

import { describe, expect, it } from 'vitest';
import type { Actor, Event, IsoDate } from 'moira-backend';
import { buildReport, formatReportText, reportFilename } from './report.js';

const h1: Actor = { kind: 'human', id: 'h1' };
const ai: Actor = { kind: 'agent', id: 'ai' };

function builder() {
  let seq = 0;
  const stamp = (iso: IsoDate): { id: string; ts: number } => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: Date.parse(`${iso}T12:00:00.000Z`) };
  };
  const events: Event[] = [];
  return {
    events,
    decompose(iso: IsoDate, parent: string, children: Array<{ node: string; estimate?: number }>) {
      events.push({ kind: 'decompose', ...stamp(iso), actor: ai, parent, reason: 'r', children });
    },
    agree(iso: IsoDate, node: string, frozenBudget: number) {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node,
        machine: 'estimate-agreement', to: 'agreed', frozenBudget,
      });
    },
    schedule(iso: IsoDate, node: string, frozenSlot: IsoDate) {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node,
        machine: 'lifecycle', to: 'ready', assignee: h1, frozenSlot,
      });
    },
    life(iso: IsoDate, node: string, to: 'implementing' | 'implemented' | 'accepted') {
      events.push({
        kind: 'transition', ...stamp(iso), actor: h1, node, machine: 'lifecycle', to,
      });
    },
    cost(iso: IsoDate, node: string, amount: number) {
      events.push({ kind: 'cost', ...stamp(iso), actor: h1, node, amount });
    },
  };
}

/**
 * A one-week mini project (all dates are July 2026 weekdays):
 *   07-01(Wed) root→{f1→a(2),b(3); f2→c(5)}, all agreed, a/b/c scheduled
 *   07-02(Thu) a implemented, cost(a)=2
 *   07-03(Fri) a accepted
 *   07-06(Mon) c implemented, cost(c)=4
 * asOf=07-06, prev=07-03 (the preceding business day).
 */
function weekLog(): Event[] {
  const b = builder();
  b.decompose('2026-07-01', 'root', [{ node: 'f1' }, { node: 'f2' }]);
  b.decompose('2026-07-01', 'f1', [
    { node: 'a', estimate: 2 },
    { node: 'b', estimate: 3 },
  ]);
  b.decompose('2026-07-01', 'f2', [{ node: 'c', estimate: 5 }]);
  b.agree('2026-07-01', 'a', 2);
  b.agree('2026-07-01', 'b', 3);
  b.agree('2026-07-01', 'c', 5);
  b.schedule('2026-07-01', 'a', '2026-07-02');
  b.schedule('2026-07-01', 'b', '2026-07-08');
  b.schedule('2026-07-01', 'c', '2026-07-06');
  b.life('2026-07-02', 'a', 'implemented');
  b.cost('2026-07-02', 'a', 2);
  b.life('2026-07-03', 'a', 'accepted');
  b.life('2026-07-06', 'c', 'implemented');
  b.cost('2026-07-06', 'c', 4);
  return b.events;
}

const OPTS = {
  asOf: '2026-07-06' as IsoDate,
  prev: '2026-07-03' as IsoDate,
  seriesDays: ['2026-07-02', '2026-07-03', '2026-07-06'] as IsoDate[],
  projectRoot: 'root',
  startDate: '2026-07-01' as IsoDate,
  dates: { deadline: '2026-07-10', targetDate: '2026-07-08' },
};

/** Same weekLog, but each root-child feature is ALSO defined as a milestone
 *  (issue #35) — 'a' is completed (07-03) so M1 exercises the phantom-
 *  prediction exclusion (its forecastEnd must come from 'b', not 'a'). */
const OPTS_WITH_MILESTONES = {
  ...OPTS,
  milestones: [
    { name: 'M1', nodes: ['f1'] },
    { name: 'M2', nodes: ['f2'] },
  ],
};

describe('buildReport', () => {
  const r = buildReport(weekLog(), OPTS);

  it('now/prev are as-of prefix derivations of the SAME log (TE03, no snapshot)', () => {
    // now: a(2) accepted + c(5) implemented = 7; prev cut (≤07-03): only a = 2
    expect(r.now.evAbs).toBe(7);
    expect(r.prevMetrics.evAbs).toBe(2);
    expect(r.delta.evAbs).toBe(5);
    expect(r.now.ac).toBe(6);
    expect(r.prevMetrics.ac).toBe(2);
    expect(r.delta.ac).toBe(4);
    expect(r.now.evPercent).toBeCloseTo(7 / 10, 6);
    expect(r.prevMetrics.evPercent).toBeCloseTo(2 / 10, 6);
  });

  it('activity window is (prev, asOf] — exactly the Monday events', () => {
    expect(r.activity).toHaveLength(2); // c implemented + cost(c)
    expect(r.activity.map((a) => a.node)).toEqual(['c', 'c']);
    expect(r.activity[0]!.label).toBe('作成完了（レビュー待ち）');
  });

  it('features carry the engine EV per root-child slice with deltas', () => {
    expect(r.features).toEqual([
      {
        feature: 'f1', evAbs: 2, prevEvAbs: 2, deltaEvAbs: 0,
        evPercent: 2 / 5, budget: 5, leafCount: 2, completedLeafCount: 1,
      },
      {
        feature: 'f2', evAbs: 5, prevEvAbs: 0, deltaEvAbs: 5,
        evPercent: 1, budget: 5, leafCount: 1, completedLeafCount: 1,
      },
    ]);
  });

  it('queues read the asOf state (c waits for human review, b for work)', () => {
    expect(r.queues.humanReview).toEqual(['c']);
  });

  it('landing is the canonical D_pred (computeLandingCurve) vs the reference dates', () => {
    // b (3 MD) is the only incomplete leaf; the leveler fills h1 with c(07-01..05)
    // first, then b lands 07-06..08 → D_pred 2026-07-08.
    expect(r.landing.landed).toBe(false);
    expect(r.landing.landingDate).toBe('2026-07-08');
    expect(r.landing.forecastCoverage).toBe(1);
    expect(r.landing.unforecastedCount).toBe(0);
    expect(r.landing.deadline).toBe('2026-07-10');
    expect(r.landing.daysLate).toBe(-2); // two days of slack — observation, not judgement
  });

  it('series walks the as-of points in ascending order', () => {
    expect(r.series.map((m) => m.date)).toEqual(['2026-07-02', '2026-07-03', '2026-07-06']);
    expect(r.series.map((m) => m.evAbs)).toEqual([2, 2, 7]);
  });

  it('empty log → honest zeros, never fabricated', () => {
    const empty = buildReport([], { ...OPTS, dates: {} });
    expect(empty.now.evAbs).toBe(0);
    expect(empty.features).toEqual([]);
    expect(empty.activity).toEqual([]);
    expect(empty.landing.landed).toBe(true);
    expect(empty.landing.landingDate).toBeNull();
    expect(empty.landing.deadline).toBeNull();
    expect(empty.landing.daysLate).toBeNull();
    expect(empty.structuralErrors).toEqual([]);
    expect(empty.retroactive).toBeNull();
  });

  it('milestones default to [] when opts.milestones is omitted (existing calls stay unaffected)', () => {
    expect(r.milestones).toEqual([]);
  });

  it('a clean append-only log with no reversal → retroactive is null (honest silence)', () => {
    expect(r.retroactive).toBeNull();
  });
});

describe('buildReport retroactive-append detection (issue #36)', () => {
  // events.json's on-disk order is always fully re-sorted by (ts,id) on save
  // (backend EventStore.saveJson), so the ONLY way a real `moira` write path
  // can still show up as "physically out of order" by the time report reads
  // it is via a hand-edited events.json — hence this test constructs the RAW
  // array directly, out of (ts,id) order, exactly as such a hand edit would.
  it('an event appended AFTER the log with a ts predating a business day already reported (prev) → warning with count + node', () => {
    const events = weekLog();
    events.push({
      kind: 'cost',
      id: 'e999', // physically last, but...
      ts: Date.parse('2026-07-01T12:00:00.000Z'), // ...ts predates every event already in the array
      actor: h1,
      node: 'a',
      amount: 1,
    });
    const r = buildReport(events, OPTS); // OPTS.prev = '2026-07-03'
    expect(r.retroactive).not.toBeNull();
    expect(r.retroactive!.count).toBe(1);
    expect(r.retroactive!.nodes).toEqual(['a']);
    expect(r.retroactive!.oldestTs).toBe(Date.parse('2026-07-01T12:00:00.000Z'));
    expect(r.retroactive!.moreNodesCount).toBe(0);
  });

  it('an out-of-order append whose ts is NEWER than prev → no warning (nothing in the already-reported window changed)', () => {
    const events = weekLog();
    events.push({
      kind: 'cost',
      id: 'e000', // sorts before everything already appended — still a physical reversal...
      ts: Date.parse('2026-07-06T08:00:00.000Z'), // ...but its ts (07-06) is after prev (07-03)
      actor: h1,
      node: 'c',
      amount: 1,
    });
    const r = buildReport(events, OPTS);
    expect(r.retroactive).toBeNull();
  });

  it('an id-decoded retroactive record appended BEFORE prev (already reported) → no warning (no permanent false alarm, issue #37-review item 1)', () => {
    // realStamper-shaped id: appended 07-01, but its ts is backdated onto
    // 06-30 (before the append day) — a genuine retroactive record by the
    // id-decode signal. Crucially, the APPEND itself (07-01) is on or before
    // `prev` (07-03): a report already run on/after 07-01 would already have
    // folded this record's effect into its Δ, so warning about it again on
    // every subsequent report (as the pre-fix code did, since it only
    // compared appendTs > e.ts and never checked appendTs against prev)
    // would be a stale, permanent false alarm.
    const appendTs = Date.parse('2026-07-01T12:00:00.000Z');
    const claimedTs = Date.parse('2026-06-30T12:00:00.000Z');
    const anchored: Event = {
      kind: 'cost',
      id: `${appendTs.toString(36)}-000001-abcd`,
      ts: claimedTs,
      actor: h1,
      node: 'a',
      amount: 1,
    };
    const events = [anchored, ...weekLog()];
    const r = buildReport(events, OPTS); // OPTS.prev = '2026-07-03', after the 07-01 append
    expect(r.retroactive).toBeNull();
  });

  it('a realStamper-shaped id moved PHYSICALLY out of order (no backdating) is STILL caught, via the independent physical-order signal (issue #37-review item 2)', () => {
    // The id's embedded instant matches its own ts exactly (no backdating —
    // the id-decode signal alone would find nothing retroactive here), but
    // the event is spliced in physically BEHIND already-newer events, i.e.
    // exactly what a hand edit that moved an existing (legitimately-id'd) row
    // further down the file would produce. Before the fix, realStamper-shaped
    // ids were judged EXCLUSIVELY by the id signal, so this case slipped
    // through undetected; the two signals must be evaluated independently.
    const ts = Date.parse('2026-07-01T09:00:00.000Z');
    const moved: Event = {
      kind: 'cost',
      id: `${ts.toString(36)}-000001-abcd`, // decodes to the SAME ts — not backdated
      ts,
      actor: h1,
      node: 'a',
      amount: 1,
    };
    const events = [...weekLog(), moved]; // physically LAST, chronologically EARLIEST
    const r = buildReport(events, OPTS); // OPTS.prev = '2026-07-03'
    expect(r.retroactive).not.toBeNull();
    expect(r.retroactive!.count).toBe(1);
    expect(r.retroactive!.nodes).toEqual(['a']);
  });

  it('a ts-anchored event (WBS import style, issue #24) is caught by id-decode alone, even in chronologically-correct physical position', () => {
    // realStamper-shaped id (cli/src/stamp.ts): `${ts.toString(36)}-${seq6}-${rand4}`.
    // The id's embedded instant is when the event was actually appended; here
    // it is FAR after asOf, while the event's own `ts` is backdated onto
    // 07-01 (like WBS import's `at()` helper backdates actuals) — the exact
    // shape a real `moira import wbs` run with 実績開始日=07-01 produces.
    const realAppendTs = Date.parse('2026-07-10T09:00:00.000Z');
    const claimedTs = Date.parse('2026-07-01T12:00:00.000Z');
    const anchored: Event = {
      kind: 'cost',
      id: `${realAppendTs.toString(36)}-000001-abcd`,
      ts: claimedTs,
      actor: h1,
      node: 'b',
      amount: 1,
    };
    // Placed at the FRONT — the chronologically-correct physical position for
    // its (backdated) ts, so the physical-order fallback would NOT flag it;
    // only decoding the id catches this one.
    const events = [anchored, ...weekLog()];
    const r = buildReport(events, OPTS);
    expect(r.retroactive).not.toBeNull();
    expect(r.retroactive!.nodes).toContain('b');
    expect(r.retroactive!.oldestTs).toBe(claimedTs);
  });
});

describe('buildReport with milestones (issue #35)', () => {
  const r = buildReport(weekLog(), OPTS_WITH_MILESTONES);

  it('rolls up each milestone’s subset EVM at asOf, reusing the SAME single derive() forecast (no re-leveling)', () => {
    expect(r.milestones).toEqual([
      {
        milestone: 'M1',
        evAbs: 2,
        evPercent: 0.4,
        pv: 2,
        ac: 2,
        bac: 5,
        spi: 1,
        cpi: 1,
        leafCount: 2,
        plannedEnd: '2026-07-08',
        forecastEnd: '2026-07-08', // driven by 'b' — NOT 'a' (a is completed 07-03; see next test)
        bottleneckLeaf: 'b',
        bottleneckOnCriticalPath: false, // no dependency edge touches b in weekLog
      },
      {
        milestone: 'M2',
        evAbs: 5,
        evPercent: 1,
        pv: 5,
        ac: 4,
        bac: 5,
        spi: 1,
        cpi: 1.25,
        leafCount: 1,
        plannedEnd: '2026-07-06',
        forecastEnd: null, // c is completed — its leveler prediction is a phantom, excluded
        bottleneckLeaf: null,
        bottleneckOnCriticalPath: false,
      },
    ]);
  });

  it('a completed leaf never paces forecastEnd even though the leveler still assigns it a date (landing.ts-isomorphic honesty)', () => {
    const m1 = r.milestones.find((m) => m.milestone === 'M1')!;
    // 'a' (completed 07-03, cost=2) is excluded from forecastEnd/bottleneck —
    // only 'b' (still incomplete) can pace M1's live forecast.
    expect(m1.bottleneckLeaf).not.toBe('a');
  });

  it('milestones is [] (section suppressed) when opts.milestones is omitted or empty', () => {
    expect(buildReport(weekLog(), OPTS).milestones).toEqual([]);
    expect(buildReport(weekLog(), { ...OPTS, milestones: [] }).milestones).toEqual([]);
  });
});

describe('reportFilename', () => {
  it('is deterministic, dated, and mirrors the output format', () => {
    expect(reportFilename('pl-sato', '2026-07-06')).toBe('moira-report-pl-sato-2026-07-06.md');
    expect(reportFilename('pl-sato', '2026-07-06', true)).toBe(
      'moira-report-pl-sato-2026-07-06.json',
    );
  });

  it('slugs a path-hostile projectRoot so it cannot escape the target dir', () => {
    expect(reportFilename('a/../b', '2026-07-06')).toBe('moira-report-a_.._b-2026-07-06.md');
    expect(reportFilename('///', '2026-07-06')).toBe('moira-report-project-2026-07-06.md');
  });
});

describe('formatReportText', () => {
  const r = buildReport(weekLog(), OPTS);
  const text = formatReportText(r, (id) => id, 'demo');

  it('keeps SPI/EV% welded to their coverage on the same line (R-S4/R-S6)', () => {
    const evLine = text.split('\n').find((l) => l.includes('EV% '));
    expect(evLine).toContain('estimate coverage');
    const spiLine = text.split('\n').find((l) => l.includes('SPI '));
    expect(spiLine).toContain('schedule coverage');
  });

  it('renders the delta, queue, feature table and trend table sections', () => {
    expect(text).toContain('## 前回比 Δ（2026-07-03 → 2026-07-06）');
    expect(text).toContain('ΔEV_abs +5');
    expect(text).toContain('レビュー待ち（人間ゲート）: [c]');
    expect(text).toContain('| feature | ΔEV_abs | EV_abs | EV% | 完了葉/葉 |');
    expect(text).toContain('| 日付 | EV_abs | EV% | 見積cov | SPI | sched cov | CPI |');
    expect(text).toContain('着地予測（P7 生きた予測・D_pred）: 2026-07-08 | forecast coverage 100%');
    expect(text).toContain('期日まで余裕: 2 日');
  });

  it('omits the "## マイルストーン別" section entirely when no milestone is defined', () => {
    expect(text).not.toContain('## マイルストーン別');
  });

  it('a normal report (no retroactive appends) never mentions 遡及 (honest silence)', () => {
    expect(text).not.toContain('遡及');
  });
});

describe('formatReportText retroactive-append warning (issue #36)', () => {
  it('renders the ⚠ 遡及記録 line right after the 前回比 Δ section, with count/node label/oldest date', () => {
    const events = weekLog();
    events.push({
      kind: 'cost',
      id: 'e999',
      ts: Date.parse('2026-07-01T12:00:00.000Z'),
      actor: h1,
      node: 'a',
      amount: 1,
    });
    const r = buildReport(events, OPTS);
    const text = formatReportText(r, (id) => (id === 'a' ? 'タスクA' : id), 'demo');
    const lines = text.split('\n');
    const deltaHeaderIdx = lines.findIndex((l) => l.startsWith('## 前回比 Δ'));
    const warnIdx = lines.findIndex((l) => l.includes('⚠ 遡及記録'));
    expect(warnIdx).toBeGreaterThan(deltaHeaderIdx);
    expect(lines[warnIdx]).toContain('⚠ 遡及記録 1 件');
    expect(lines[warnIdx]).toContain('前回営業日以前の日付への追記あり');
    expect(lines[warnIdx + 1]).toContain('タスクA (a)');
    expect(lines[warnIdx + 1]).toContain('最古の遡及日付: 2026-07-01');
  });
});

describe('formatReportText with milestones (issue #35)', () => {
  const r = buildReport(weekLog(), OPTS_WITH_MILESTONES);
  const text = formatReportText(r, (id) => id, 'demo');

  it('renders the "## マイルストーン別" table with EV%/EV_abs/SPI/CPI/BAC/plannedEnd/forecastEnd/bottleneck', () => {
    expect(text).toContain('## マイルストーン別（名前 + 構成ノード束 — 期日/バッファは持たない）');
    expect(text).toContain(
      '| milestone | EV% | EV_abs | SPI | CPI | BAC | 予定終了(基準) | 予測終了 | ボトルネック葉 |',
    );
    expect(text).toContain('| M1 | 40% | 2 | 1.00 | 1.00 | 5 | 2026-07-08 | 2026-07-08 | b |');
    expect(text).toContain('| M2 | 100% | 5 | 1.00 | 1.25 | 5 | 2026-07-06 | (予測不能) | - |');
  });
});
