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
}

// --- as-of prefix (TE03) ------------------------------------------------------

/** UTC calendar day of an event ts — verbatim landing.ts discipline. */
function tsDay(ts: number): IsoDate {
  return new Date(ts).toISOString().slice(0, 10);
}

function prefixByDay(sorted: readonly Event[], day: IsoDate): Event[] {
  return sorted.filter((e) => tsDay(e.ts) <= day);
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
