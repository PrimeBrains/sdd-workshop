// `moira report` — the morning digest (issue #25, roadmap skill #14
// moira-evm-digest, TE03). "Previous" is NEVER a stored snapshot (⊥A2): it is
// the same append-only log re-folded over the (ts,id) ≤ cut prefix — the as-of
// derivation TE03 defines, the pattern landing.ts proved. Pure functions: the
// command layer loads the repo, this module only computes and formats.
//
// Day-boundary discipline: tsDay is the UTC calendar day of the event's ts —
// the SAME rule as backend/src/derivations/landing.ts (tsDay/evOfPrefix). One
// date semantics in the codebase; the JST skew (00:00–09:00 events land on the
// previous UTC day) is accepted per TE03 「日境界はパラメータ」 and documented in
// the CLI README.
//
// Capacity is passed as-is to every point-in-time derive: all reported metrics
// (EV_abs/EV%/PV/AC/SPI/CPI/coverages/queues) are capacity-INDEPENDENT — c(i,d)
// only feeds the leveler→forecast rows, which the digest reads only at `asOf`.
//
// Canon guardrails: no per-developer EV scoreboard (TE03/A4 — value belongs to
// the tree, only AC may be read per actor; this module exposes neither), and
// SPI/EV% are never emitted without their coverage pair (R-S4/R-S6).

import type {
  ActivityRow,
  CapacityLookup,
  DerivedState,
  Event,
  IsoDate,
  MilestoneDefinition,
  MilestoneRollupRow,
  NodeId,
} from 'moira-backend';
import {
  computeFeatureRollup,
  computeLandingCurve,
  computeMilestoneRollup,
  derive,
  sortEvents,
} from 'moira-backend';
import { fmt, pct } from './format.js';
import type { ReferenceDates } from './store.js';

// --- shapes -----------------------------------------------------------------

export interface ReportOptions {
  asOf: IsoDate;
  prev: IsoDate;
  /** Trend window, ascending (typically lastNBusinessDays(asOf, n)). */
  seriesDays: readonly IsoDate[];
  projectRoot: NodeId;
  capacityOf?: CapacityLookup;
  startDate?: IsoDate;
  /** Current latest-wins reference dates (deadline is asked of TODAY's dates). */
  dates: ReferenceDates;
  /**
   * Resolved milestones (issue #35; store.ts resolveMilestones). Omitted/empty
   * → the "## マイルストーン別" section is suppressed entirely (existing
   * optional-section discipline, same as an empty `features`/`series`).
   */
  milestones?: readonly MilestoneDefinition[];
}

/** One as-of point of the pair-read metric set. */
export interface ReportMetrics {
  date: IsoDate;
  evAbs: number;
  evPercent: number;
  estimateCoverage: number;
  pv: number;
  ac: number;
  spi: number | null;
  scheduleCoverage: number;
  cpi: number | null;
  executionCoverage: number;
}

export interface ReportFeatureRow {
  feature: NodeId;
  evAbs: number;
  prevEvAbs: number;
  deltaEvAbs: number;
  evPercent: number;
  budget: number;
  leafCount: number;
  completedLeafCount: number;
}

export interface ReportJson {
  schemaVersion: 1;
  asOf: IsoDate;
  prev: IsoDate;
  now: ReportMetrics;
  prevMetrics: ReportMetrics;
  delta: { evAbs: number; evPercent: number; pv: number; ac: number };
  activity: ActivityRow[];
  queues: { humanReview: NodeId[]; agentWork: NodeId[]; unassigned: NodeId[] };
  features: ReportFeatureRow[];
  /** Per-milestone EVM + landing read (issue #35). Empty when no milestone is
   *  defined — the text renderer suppresses the section entirely in that case. */
  milestones: MilestoneRollupRow[];
  landing: {
    landed: boolean; // no incomplete effective leaves remain
    landingDate: IsoDate | null; // D_pred (MODEL:234) — null = visible gap, not a guess
    forecastCoverage: number; // pair-read for landingDate (R-S6-isomorphic)
    unforecastedCount: number; // incomplete leaves the forecast cannot place — honest gap
    deadline: IsoDate | null;
    targetDate: IsoDate | null;
    daysLate: number | null; // landingDate − deadline (observation only; R-T4 keeps the judgement human)
  };
  series: ReportMetrics[];
  structuralErrors: string[];
  /** Retroactive-append warning (issue #36) — null in normal operation
   *  (honest silence); see buildRetroactiveWarning. */
  retroactive: RetroactiveWarning | null;
}

// --- as-of prefix (TE03) ------------------------------------------------------

/** UTC calendar day of an event ts — verbatim landing.ts discipline. */
function tsDay(ts: number): IsoDate {
  return new Date(ts).toISOString().slice(0, 10);
}

function prefixByDay(sorted: readonly Event[], day: IsoDate): Event[] {
  return sorted.filter((e) => tsDay(e.ts) <= day);
}

// --- retroactive-append detection (issue #36) --------------------------------
//
// events.json's PHYSICAL order is NOT append order: every commit path
// (cli/src/store.ts appendEvents → backend EventStore.saveJson) fully
// re-sorts by (ts,id) on save (backend/src/event-store.ts saveJson calls
// all() == sortEvents()), so by the time `report` re-reads the file, any
// append-order signal has already collapsed into (ts,id) order for events
// that passed through a normal `moira ...` write. Two complementary signals
// remain, and they are evaluated INDEPENDENTLY (OR, not either/or per event
// — issue #37-review item 2): a genuine realStamper id does not immunize an
// event against ALSO having been physically spliced out of order by a hand
// edit, so both checks always run and either one flags the record (no double
// counting — each event contributes at most one flagged entry):
//
//  1. The event id itself. realStamper (cli/src/stamp.ts) derives id as
//     `${ts.toString(36)}-${seq}-${rand}` from the SAME wall-clock instant it
//     hands out as `ts` — EXCEPT when a caller backdates `ts` afterward while
//     leaving the id untouched (WBS import's `at()` helper, issue #24's
//     ts-anchoring: `{ id: s.id, ts: epoch(actualDate) }`). Decoding the id's
//     prefix recovers the moment the event was actually appended,
//     independent of the (possibly backdated) `ts` field — a mismatch
//     (appended later than the ts it claims) is a retroactive record. This
//     is the mechanism that actually fires for real `moira import wbs` runs,
//     since the resort above erases the physical-position signal before
//     `report` ever sees the file.
//  2. Regardless of whether signal 1 fired, we ALSO scan the RAW on-disk
//     order buildReport is handed (the `events` param, BEFORE sortEvents()
//     below normalizes it): a running-(ts,id)-max scan over that order
//     catches an entry sitting behind an already-newer one — i.e. physically
//     spliced in out of chronological order. This is the only signal
//     available for ids that don't match the realStamper shape (hand-edited
//     events.json rows, a caller's own stamper — including this file's own
//     tests), but it also catches a realStamper-shaped id whose ROW was
//     physically moved without touching its ts/id (signal 1 alone would miss
//     that, since appendTs == ts for such a row).
//
// Either signal, once found, is judged against the SAME (ts,id) semantics
// fold already uses (I3/R-D5) — no new event kind or stored field (D-66).
//
// A THIRD refinement (issue #37-review item 1) governs whether a flagged
// record is still WARNING-worthy today, independent of the above detection:
// see the `gateAppendTs` field and buildRetroactiveWarning below.

const REAL_STAMP_ID_RE = /^([0-9a-z]+)-\d{6}-[0-9a-z]{4}$/;

/** Wall-clock append instant encoded in a realStamper-shaped id, or null if
 *  the id doesn't match that shape — no signal, so no verdict (avoids false
 *  positives on ids we can't interpret). */
function decodeAppendTs(id: string): number | null {
  const m = REAL_STAMP_ID_RE.exec(id);
  const ts36 = m?.[1];
  if (ts36 === undefined) return null;
  const decoded = Number.parseInt(ts36, 36);
  return Number.isFinite(decoded) ? decoded : null;
}

/** Deterministic (ts,id) comparator — the SAME total order sortEvents uses. */
function cmpTsId(a: Event, b: Event): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The event's subject node — same per-kind rule as the backend's activity
 *  log projection (decompose→parent, relate→to, transition/cost→node). */
function eventNode(e: Event): NodeId | null {
  switch (e.kind) {
    case 'decompose':
      return e.parent;
    case 'relate':
      return e.to;
    case 'transition':
    case 'cost':
      return e.node;
    default:
      return null;
  }
}

interface RetroactiveEvent {
  ts: number;
  node: NodeId | null;
  /**
   * The wall-clock append instant, but ONLY when signal 1 (id-decode) is what
   * flagged this record — null otherwise (id undecodable, or flagged solely
   * via signal 2's physical-order scan). buildRetroactiveWarning uses this to
   * decide whether a record is still warning-worthy TODAY (issue #37-review
   * item 1): an id-decoded record already appended before `prev` was already
   * folded into an earlier report and should stop nagging; a physical-order-
   * only detection has no known append time, so it keeps warning forever
   * (the accepted fallback — see the file-header comment above).
   */
  gateAppendTs: number | null;
}

/** Scan the RAW (as-loaded) event order and flag every retroactively-appended
 *  event, via EITHER of the two signals above (independently — see the
 *  file-header comment; issue #37-review item 2). */
function findRetroactiveEvents(rawEvents: readonly Event[]): RetroactiveEvent[] {
  const flagged: RetroactiveEvent[] = [];
  let runningMax: Event | undefined;
  for (const e of rawEvents) {
    const appendTs = decodeAppendTs(e.id);
    const idRetroactive = appendTs !== null && appendTs > e.ts;
    const physicallyRetroactive =
      runningMax !== undefined && cmpTsId(e, runningMax) < 0;
    if (idRetroactive || physicallyRetroactive) {
      flagged.push({
        ts: e.ts,
        node: eventNode(e),
        gateAppendTs: appendTs !== null && idRetroactive ? appendTs : null,
      });
    }
    if (runningMax === undefined || cmpTsId(e, runningMax) > 0) runningMax = e;
  }
  return flagged;
}

const RETROACTIVE_NODE_DISPLAY_LIMIT = 5;

export interface RetroactiveWarning {
  /** Retroactive records whose (semantic, possibly backdated) ts falls on or
   *  before `prev` — the ones that actually rewrite a day the reader already
   *  compared against — AND (issue #37-review item 1) still warning-worthy
   *  today: an id-decoded record whose append itself happened on or before
   *  `prev` was already folded into an earlier report and is excluded here,
   *  even though it still counts in findRetroactiveEvents. See
   *  buildRetroactiveWarning's docstring for the exact gate. */
  count: number;
  /** Oldest offending ts (epoch ms) among those records. */
  oldestTs: number;
  /** Up to RETROACTIVE_NODE_DISPLAY_LIMIT distinct subject nodes touched, in
   *  first-seen order. */
  nodes: NodeId[];
  /** Remaining distinct nodes beyond `nodes`, 0 if none. */
  moreNodesCount: number;
}

/**
 * `null` when nothing is retroactive-into-the-already-reported-past — normal
 * operation stays silent (no warning fabricated where there is nothing to
 * warn about). A retroactive record ts'd AFTER `prev` doesn't change the Δ
 * already reported, so it is excluded here (still counted by
 * findRetroactiveEvents, just not warning-worthy).
 *
 * issue #37-review item 1: an id-decoded record (gateAppendTs !== null) is
 * ALSO excluded once its append itself is no longer new — i.e. once the
 * append happened on or before `prev`, it was already folded into an earlier
 * report's Δ, and re-warning on it every single day thereafter would be a
 * permanent false alarm on old, already-digested history (the exact defect
 * this fix closes). Records with no known append time (gateAppendTs === null
 * — undecodable id, or a physical-order-only detection) have no such gate:
 * they keep warning until the underlying record is fixed, per the accepted
 * fallback documented at findRetroactiveEvents/RetroactiveEvent above.
 */
function buildRetroactiveWarning(
  rawEvents: readonly Event[],
  prev: IsoDate,
): RetroactiveWarning | null {
  const relevant = findRetroactiveEvents(rawEvents).filter((e) => {
    if (tsDay(e.ts) > prev) return false;
    if (e.gateAppendTs !== null) return tsDay(e.gateAppendTs) > prev;
    return true;
  });
  if (relevant.length === 0) return null;

  const nodesSeen = new Set<NodeId>();
  const nodes: NodeId[] = [];
  for (const e of relevant) {
    if (e.node === null || nodesSeen.has(e.node)) continue;
    nodesSeen.add(e.node);
    if (nodes.length < RETROACTIVE_NODE_DISPLAY_LIMIT) nodes.push(e.node);
  }

  return {
    count: relevant.length,
    oldestTs: Math.min(...relevant.map((e) => e.ts)),
    nodes,
    moreNodesCount: Math.max(0, nodesSeen.size - nodes.length),
  };
}

// --- build --------------------------------------------------------------------

export function buildReport(events: readonly Event[], opts: ReportOptions): ReportJson {
  const sorted = sortEvents(events);
  const deriveAt = (day: IsoDate): DerivedState =>
    derive(prefixByDay(sorted, day), {
      asOf: day,
      ...(opts.capacityOf !== undefined ? { capacityOf: opts.capacityOf } : {}),
      ...(opts.startDate !== undefined ? { startDate: opts.startDate } : {}),
    });

  const now = deriveAt(opts.asOf);
  const prev = deriveAt(opts.prev);

  const metricsOf = (d: DerivedState): ReportMetrics => ({
    date: d.asOf,
    evAbs: d.evAbs,
    evPercent: d.evPercent,
    estimateCoverage: d.estimateCoverage,
    pv: d.pv,
    ac: d.ac,
    spi: d.spi,
    scheduleCoverage: d.scheduleCoverage,
    cpi: d.cpi,
    executionCoverage: d.executionCoverage,
  });
  const nowM = metricsOf(now);
  const prevM = metricsOf(prev);

  // Window: events strictly after prev's day, up to and including asOf's day.
  const activity = now.activityLog.filter(
    (r) => tsDay(r.ts) > opts.prev && tsDay(r.ts) <= opts.asOf,
  );

  // Feature rollup: engine EV over each root-child slice, at both cuts.
  const nowRows = computeFeatureRollup(prefixByDay(sorted, opts.asOf), opts.projectRoot);
  const prevRows = computeFeatureRollup(prefixByDay(sorted, opts.prev), opts.projectRoot);
  const prevEvOf = new Map(prevRows.map((r) => [r.feature, r.evAbs]));
  const features: ReportFeatureRow[] = nowRows.map((r) => {
    const prevEvAbs = prevEvOf.get(r.feature) ?? 0;
    return {
      feature: r.feature,
      evAbs: r.evAbs,
      prevEvAbs,
      deltaEvAbs: r.evAbs - prevEvAbs,
      evPercent: r.evPercent,
      budget: r.budget,
      leafCount: r.leafCount,
      completedLeafCount: r.completedLeafCount,
    };
  });

  // Milestone rollup (issue #35): subset EVM + landing read over each
  // milestone's node-id bundle, at `asOf`. Reuses `now.forecast` — the SAME
  // single derive() leveler run above — rather than re-leveling a subset (see
  // milestone-rollup.ts's file-header rationale). No section when no
  // milestone is defined (existing optional-section discipline).
  const milestones: MilestoneRollupRow[] =
    opts.milestones !== undefined && opts.milestones.length > 0
      ? computeMilestoneRollup(prefixByDay(sorted, opts.asOf), opts.milestones, now.forecast, {
          asOf: opts.asOf,
        })
      : [];

  // Landing vs reference dates — the canonical D_pred from computeLandingCurve
  // (NOT a hand-rolled max over forecast rows: the leveler also levels completed
  // leaves, so their phantom predictions would dishonestly push the max out).
  // Observation only; the judgement stays human (R-T4).
  const curve = computeLandingCurve(prefixByDay(sorted, opts.asOf), {
    asOf: opts.asOf,
    ...(opts.capacityOf !== undefined ? { capacityOf: opts.capacityOf } : {}),
    ...(opts.startDate !== undefined ? { startDate: opts.startDate } : {}),
  });
  const deadline = opts.dates.deadline ?? null;
  const daysLate =
    curve.landingDate !== null && deadline !== null
      ? diffDays(curve.landingDate, deadline)
      : null;

  const series = opts.seriesDays.map((d) => metricsOf(deriveAt(d)));

  return {
    schemaVersion: 1,
    asOf: opts.asOf,
    prev: opts.prev,
    now: nowM,
    prevMetrics: prevM,
    delta: {
      evAbs: nowM.evAbs - prevM.evAbs,
      evPercent: nowM.evPercent - prevM.evPercent,
      pv: nowM.pv - prevM.pv,
      ac: nowM.ac - prevM.ac,
    },
    activity,
    queues: {
      humanReview: now.humanReviewQueue,
      agentWork: now.agentWorkQueue,
      unassigned: now.unassignedBacklog,
    },
    features,
    milestones,
    landing: {
      landed: curve.landed,
      landingDate: curve.landingDate,
      forecastCoverage: curve.forecastCoverage,
      unforecastedCount: curve.unforecastedLeaves.length,
      deadline,
      targetDate: opts.dates.targetDate ?? null,
      daysLate,
    },
    series,
    structuralErrors: now.structuralErrors,
    retroactive: buildRetroactiveWarning(events, opts.prev),
  };
}

/** a − b in whole days (UTC calendar arithmetic). */
function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/**
 * Deterministic filename for `moira report --save-dir` — sortable by date,
 * unique per (project, asOf). projectRoot is slugged so a path-hostile id can
 * never escape the target directory.
 */
export function reportFilename(projectRoot: NodeId, asOf: IsoDate, json = false): string {
  const slug = projectRoot.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';
  return `moira-report-${slug}-${asOf}.${json ? 'json' : 'md'}`;
}

// --- text (Markdown for the morning meeting) -----------------------------------

const sign = (n: number): string => (n >= 0 ? `+${trim(n)}` : trim(n));
const trim = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return String(r);
};
const pctSigned = (n: number): string => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}pt`;

export function formatReportText(
  r: ReportJson,
  labelOf: (id: string) => string,
  projectLabel?: string,
): string {
  const head = projectLabel === undefined ? '' : `   (${projectLabel})`;
  const name = (id: string): string => {
    const l = labelOf(id);
    return l === id ? id : `${l} (${id})`;
  };
  const lines: string[] = [
    `Moira — 朝会ダイジェスト @ ${r.asOf}   (前回 ${r.prev})${head}`,
    '',
    '## 現況（ペア読み）',
    `  EV%  ${pct(r.now.evPercent)} | estimate coverage ${pct(r.now.estimateCoverage)}   (pair-read R-S4)`,
    `  SPI  ${fmt(r.now.spi)} | schedule coverage ${pct(r.now.scheduleCoverage)}   (pair-read R-S6)`,
    `  EV_abs ${trim(r.now.evAbs)} | PV ${trim(r.now.pv)} | AC ${trim(r.now.ac)} | CPI ${fmt(r.now.cpi)} | exec coverage ${pct(r.now.executionCoverage)}`,
    '',
    `## 前回比 Δ（${r.prev} → ${r.asOf}）`,
    `  ΔEV_abs ${sign(r.delta.evAbs)} | ΔEV% ${pctSigned(r.delta.evPercent)} | ΔPV ${sign(r.delta.pv)} | ΔAC ${sign(r.delta.ac)}`,
    `  SPI ${fmt(r.prevMetrics.spi)} → ${fmt(r.now.spi)} | CPI ${fmt(r.prevMetrics.cpi)} → ${fmt(r.now.cpi)}`,
  ];

  if (r.retroactive !== null) {
    const shown = r.retroactive.nodes.map(name).join(', ');
    const more = r.retroactive.moreNodesCount > 0 ? ` (+他${r.retroactive.moreNodesCount}件)` : '';
    lines.push(
      `  ⚠ 遡及記録 ${r.retroactive.count} 件（前回営業日以前の日付への追記あり — Δ は書き換わった過去との比較）`,
      `    対象: ${shown === '' ? '(不明)' : shown}${more} | 最古の遡及日付: ${tsDay(r.retroactive.oldestTs)}`,
    );
  }

  lines.push('', `## 期間の出来事（${r.activity.length}件）`);
  if (r.activity.length === 0) {
    lines.push('  （この期間のイベントはありません）');
  } else {
    for (const a of r.activity) {
      const subject = a.node === null ? '' : ` ${name(a.node)}`;
      lines.push(`  - ${tsDay(a.ts)} ${a.actor.kind}:${a.actor.id} ${a.label}${subject}`);
    }
  }

  lines.push('', '## 今日のアクション（キュー）');
  lines.push(`  レビュー待ち（人間ゲート）: ${fmtIds(r.queues.humanReview, name)}`);
  lines.push(`  エージェント作業可: ${fmtIds(r.queues.agentWork, name)}`);
  lines.push(`  未割当（合意済み）: ${fmtIds(r.queues.unassigned, name)}`);

  if (r.features.length > 0) {
    lines.push('', '## feature 別（root 直下・価値は木に帰属）');
    lines.push('  | feature | ΔEV_abs | EV_abs | EV% | 完了葉/葉 |');
    lines.push('  |---|---|---|---|---|');
    for (const f of r.features) {
      lines.push(
        `  | ${name(f.feature)} | ${sign(f.deltaEvAbs)} | ${trim(f.evAbs)} | ${pct(f.evPercent)} | ${f.completedLeafCount}/${f.leafCount} |`,
      );
    }
  }

  if (r.milestones.length > 0) {
    lines.push('', '## マイルストーン別（名前 + 構成ノード束 — 期日/バッファは持たない）');
    lines.push('  | milestone | EV% | EV_abs | SPI | CPI | BAC | 予定終了(基準) | 予測終了 | ボトルネック葉 |');
    lines.push('  |---|---|---|---|---|---|---|---|---|');
    for (const m of r.milestones) {
      const bottleneck =
        m.bottleneckLeaf === null
          ? '-'
          : `${name(m.bottleneckLeaf)}${m.bottleneckOnCriticalPath ? ' ★critical path' : ''}`;
      lines.push(
        `  | ${m.milestone} | ${pct(m.evPercent)} | ${trim(m.evAbs)} | ${fmt(m.spi)} | ${fmt(m.cpi)} | ${trim(m.bac)} | ${m.plannedEnd ?? '(未定)'} | ${m.forecastEnd ?? '(予測不能)'} | ${bottleneck} |`,
      );
    }
  }

  lines.push('', '## 着地予測 vs 期日（判断は人間 — R-T4）');
  if (r.landing.landed) {
    lines.push('  着地済み（未完了の有効葉なし）');
  } else {
    const d = r.landing.landingDate ?? '(予測不能 — 見えるギャップ)';
    lines.push(
      `  着地予測（P7 生きた予測・D_pred）: ${d} | forecast coverage ${pct(r.landing.forecastCoverage)}`,
    );
  }
  if (r.landing.unforecastedCount > 0) {
    lines.push(`  ⚠ 予測に乗らない未完了葉 ${r.landing.unforecastedCount} 件（未合意/未割当 — 見えるギャップ）`);
  }
  lines.push(`  期日: ${r.landing.deadline ?? '(未設定)'} | 目標日: ${r.landing.targetDate ?? '(未設定)'}`);
  if (r.landing.daysLate !== null) {
    lines.push(
      r.landing.daysLate > 0
        ? `  期日超過見込み: +${r.landing.daysLate} 日`
        : `  期日まで余裕: ${-r.landing.daysLate} 日`,
    );
  }

  if (r.series.length > 0) {
    lines.push('', `## 推移（直近 ${r.series.length} 営業日・ペア読み）`);
    lines.push('  | 日付 | EV_abs | EV% | 見積cov | SPI | sched cov | CPI |');
    lines.push('  |---|---|---|---|---|---|---|');
    for (const m of r.series) {
      lines.push(
        `  | ${m.date} | ${trim(m.evAbs)} | ${pct(m.evPercent)} | ${pct(m.estimateCoverage)} | ${fmt(m.spi)} | ${pct(m.scheduleCoverage)} | ${fmt(m.cpi)} |`,
      );
    }
  }

  if (r.structuralErrors.length > 0) {
    lines.push('', `## 構造エラー（${r.structuralErrors.length}件）`);
    for (const e of r.structuralErrors) lines.push(`  ! ${e}`);
  }

  return lines.join('\n');
}

function fmtIds(ids: readonly string[], name: (id: string) => string): string {
  return ids.length === 0 ? '[]' : `[${ids.map(name).join(', ')}]`;
}
