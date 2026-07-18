// DISPLAY-ONLY geometry & row model for the Gantt. No metric is computed here:
// dates come straight from derived.forecast (frozenSlot / predictedCompletion),
// per-node attributes from the projected fold, ac from derived.acByNode. The only
// arithmetic is calendar geometry (date → x) and effective-tree depth — both are
// the projections allowed by UI-DESIGN-BRIEF §0.

import { nominalDurationDays } from '../../moira/engine';
import type {
  Actor,
  ActorKind,
  DependencyEdge,
  DerivedState,
  EstimateState,
  IsoDate,
  LifecycleState,
  NodeId,
  PlannedCostResult,
  ProjectedState,
} from '../../moira/engine';
import { labelOf } from '../../moira/labels';

export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
export function addDaysIso(iso: IsoDate, n: number): IsoDate {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function minIso(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}
export function maxIso(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export type SlotState =
  | 'scheduled-complete' // A: completed ∧ frozenSlot set
  | 'incomplete' // B: not completed, has a live forecast
  | 'complete-unscheduled' // C: completed ∧ frozenSlot = null (PV-excluded, R-S6)
  | 'unscheduled-incomplete'; // not completed, no forecast either

export interface GanttRow {
  node: NodeId;
  depth: number;
  isLeaf: boolean;
  label: string;
  lifecycle: LifecycleState;
  estimateState: EstimateState;
  assignee: Actor | null;
  kind: ActorKind | null;
  latestEstimate: number | null;
  frozenBudget: number | null;
  ownCost: number;
  ac: number;
  frozenSlot: IsoDate | null;
  predicted: IsoDate | null;
  completed: boolean;
  slotState: SlotState;
  contextOnly: boolean; // kept only as ancestor scaffolding of a matched leaf (issue #8)
  /** leveler's nominal bar-length in days (issue #34) — computed ONCE here via
   *  the backend's nominalDurationDays (single source; no local re-derivation). */
  nominalDurationDays: number;
  /** planned (budget) cost — a projection of computePlannedCost's byNode map
   *  (issue #34a). Leaf and parent both read the SAME map entry: the backend
   *  already rolled the tree up (Σ children), so no frontend re-summing. null
   *  when no PlannedCostResult was supplied to buildGanttModel. */
  plannedCost: number | null;
  /** planned start (issue #34): leaf = predictedStart (first day the leveler
   *  actually consumed capacity) ?? an approximation (frozenSlot minus the
   *  nominal duration) ?? null. Parent = min over descendant plannedStart
   *  (dateSpanOf, display-only projection — no metric recomputation). */
  plannedStart: IsoDate | null;
  /** planned end (issue #34): leaf = predicted (live forecast completion) ??
   *  frozenSlot (frozen baseline). Parent = max over descendant plannedEnd. */
  plannedEnd: IsoDate | null;
}

export interface GanttModel {
  rows: GanttRow[];
  start: IsoDate;
  end: IsoDate;
  totalDays: number;
}

/** Nominal bar length in days — DISPLAY geometry only (the authoritative
 * signal is the completion date marker, not the bar length). A thin accessor
 * over the row's `nominalDurationDays` field, which buildGanttModel computes
 * ONCE via the backend's nominalDurationDays (issue #34: single source, no
 * local formula re-derivation — a prior local reimplementation used to live
 * here and could drift from the leveler's own duration function). */
export function nominalDays(row: GanttRow): number {
  return row.nominalDurationDays;
}

// ---- date-axis ticks (issue #28) --------------------------------------------
// The header previously showed month boundaries only, which is too coarse to
// read a week-scale plan. buildAxisTicks emits month labels (always), week
// boundaries (Monday-anchored, ISO week) and — opt-in — every day boundary.
// Pure display geometry (date → x); no metric. Kept here so it is unit-testable
// without a DOM.

export type AxisTickKind = 'month' | 'week' | 'day';

export interface AxisTick {
  x: number; // px offset from the track's left edge
  kind: AxisTickKind;
  label: string | null; // month: "N月"; week: "M/D"; day: null (gridline only)
}

export interface AxisTickOptions {
  weeks: boolean;
  days: boolean;
}

export function buildAxisTicks(
  start: IsoDate,
  totalDays: number,
  dayW: number,
  opts: AxisTickOptions,
): AxisTick[] {
  const trackW = totalDays * dayW;
  const ticks: AxisTick[] = [];

  // months — the 1st of each month inside the window (label + boundary)
  {
    const startD = new Date(`${start}T00:00:00Z`);
    const d = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
    for (let i = 0; i < 240; i += 1) {
      const iso = d.toISOString().slice(0, 10);
      const x = daysBetween(start, iso) * dayW;
      if (x > trackW) break;
      if (x >= 0) ticks.push({ x, kind: 'month', label: `${d.getUTCMonth() + 1}月` });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }

  // weeks — the first Monday on/after start, then every 7 days (ISO week start)
  if (opts.weeks) {
    const dow = new Date(`${start}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
    const toMonday = (8 - dow) % 7; // 0 when start is already a Monday
    let iso = addDaysIso(start, toMonday);
    for (let i = 0; i < 520; i += 1) {
      const x = daysBetween(start, iso) * dayW;
      if (x > trackW) break;
      if (x >= 0) {
        const wd = new Date(`${iso}T00:00:00Z`);
        ticks.push({ x, kind: 'week', label: `${wd.getUTCMonth() + 1}/${wd.getUTCDate()}` });
      }
      iso = addDaysIso(iso, 7);
    }
  }

  // days — every calendar-day boundary (opt-in; gridlines only, no labels)
  if (opts.days) {
    for (let n = 0; n <= totalDays; n += 1) {
      const x = n * dayW;
      if (x > trackW) break;
      ticks.push({ x, kind: 'day', label: null });
    }
  }

  return ticks;
}

function classify(completed: boolean, frozenSlot: IsoDate | null, predicted: IsoDate | null): SlotState {
  if (completed && frozenSlot !== null) return 'scheduled-complete';
  if (completed && frozenSlot === null) return 'complete-unscheduled';
  if (!completed && predicted !== null) return 'incomplete';
  return 'unscheduled-incomplete';
}

// ---- row filter (issue #8) ---------------------------------------------------
// Filtering is applied to LEAVES ONLY; a matched leaf's whole ancestor chain is
// kept as (dimmed) scaffolding so a row never floats without its phase context.
// Pure & display-only — no metric is (re)computed here.

export type DivTone = 'behind' | 'ahead' | 'none';

/** predicted vs frozenSlot divergence (R-S7) — display-only classification.
 * Moved here from ScheduleGantt so the row filter can share it (issue #8). */
export function divergence(row: GanttRow): DivTone {
  if (row.frozenSlot !== null && row.predicted !== null) {
    if (row.predicted > row.frozenSlot) return 'behind';
    if (row.predicted < row.frozenSlot) return 'ahead';
  }
  return 'none';
}

export type AssigneeFilter = 'all' | 'unassigned' | { id: string };

export interface RowFilter {
  kind: 'all' | 'human' | 'agent'; // subsumes the old queue filter
  assignee: AssigneeFilter;
  completion: 'all' | 'incomplete' | 'complete';
  completionStrict: boolean; // true: done = completed ∧ agreed (spec-value「本当に完了」)
  //                            false: done = completed (Gantt「進捗100%」)
  estimate: 'all' | 'unestimated' | 'proposed' | 'agreed';
  divergence: 'all' | 'behind' | 'on-track';
}

// All fields required (never optional) — exactOptionalPropertyTypes trap; the
// neutral value is always 'all'.
export const DEFAULT_ROW_FILTER: RowFilter = {
  kind: 'all',
  assignee: 'all',
  completion: 'all',
  completionStrict: false,
  estimate: 'all',
  divergence: 'all',
};

/** Leaf-only match predicate; every dimension AND'd. Pure. */
export function leafMatches(row: GanttRow, f: RowFilter): boolean {
  if (!(f.kind === 'all' || row.kind === f.kind)) return false;

  if (f.assignee === 'unassigned') {
    if (row.assignee !== null) return false;
  } else if (f.assignee !== 'all') {
    if (row.assignee?.id !== f.assignee.id) return false;
  }

  if (f.completion !== 'all') {
    const done = f.completionStrict ? row.completed && row.estimateState === 'agreed' : row.completed;
    if (f.completion === 'complete' && !done) return false;
    if (f.completion === 'incomplete' && done) return false;
  }

  if (f.estimate === 'unestimated') {
    if (row.latestEstimate !== null) return false;
  } else if (f.estimate === 'proposed') {
    if (!(row.latestEstimate !== null && row.estimateState === 'proposed')) return false;
  } else if (f.estimate === 'agreed') {
    if (row.estimateState !== 'agreed') return false;
  }

  if (f.divergence === 'behind') {
    if (divergence(row) !== 'behind') return false;
  } else if (f.divergence === 'on-track') {
    if (divergence(row) === 'behind') return false;
  }

  return true;
}

/** Distinct assignees across the projected nodes, first-occurrence (insertion)
 * order, deduped by kind:id. Reviewers / capacity-only humans are excluded —
 * the row filter keys on `assignee`. Pure. */
export function assigneeOptions(projected: ProjectedState): Actor[] {
  const seen = new Set<string>();
  const out: Actor[] = [];
  for (const n of projected.nodes.values()) {
    const a = n.assignee;
    if (a === null) continue;
    const key = `${a.kind}:${a.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** No active filtering across any dimension (completionStrict alone is inert
 * when completion === 'all'). Used to short-circuit to the unfiltered rows. */
function isNoFilter(f: RowFilter): boolean {
  return (
    f.kind === 'all' &&
    f.assignee === 'all' &&
    f.completion === 'all' &&
    f.estimate === 'all' &&
    f.divergence === 'all'
  );
}

/** rows(all) → matched leaves ∪ their ancestors; non-matched survivors marked
 * contextOnly. Row order (already topo/insertion sorted) is preserved. */
function applyFilter(rows: GanttRow[], f: RowFilter, projected: ProjectedState): GanttRow[] {
  if (isNoFilter(f)) return rows;
  const matched = new Set<NodeId>();
  for (const r of rows) if (r.isLeaf && leafMatches(r, f)) matched.add(r.node);
  const keep = new Set<NodeId>(matched);
  for (const id of matched) {
    let p = projected.nodes.get(id)?.parent ?? null;
    while (p !== null && !keep.has(p)) {
      keep.add(p);
      p = projected.nodes.get(p)?.parent ?? null;
    }
  }
  return rows
    .filter((r) => keep.has(r.node))
    .map((r) => (matched.has(r.node) ? r : { ...r, contextOnly: true }));
}

/** Order ONE sibling set by a stable topological sort over the dependency edges
 * whose BOTH ends lie inside the set (Kahn), breaking ties by insertion order
 * (the childrenOf / event order). Edges crossing to ancestors or other parents
 * are ignored — the adapter's standard chain (req→design→tasks→impl-i→review-impl)
 * is all direct siblings under one feature, so direct edges suffice. NO
 * process-name heuristic lives here (vocabulary containment, ADR-0002): with no
 * edges the insertion-order fallback stands, which is already the emit order the
 * adapter records. Pure & display-only — replaces the old lexicographic id sort
 * that scrambled phase order (design < impl-1 < req < review-impl < tasks). */
export function orderSiblings(
  siblings: readonly NodeId[], // insertion-order-preserving; caller filters to effective
  edges: readonly DependencyEdge[], // pass projected.dependencyEdges as-is
): NodeId[] {
  const inSet = new Set(siblings);
  const indeg = new Map<NodeId, number>(siblings.map((s) => [s, 0]));
  const succ = new Map<NodeId, NodeId[]>(siblings.map((s) => [s, []]));
  for (const e of edges) {
    if (!inSet.has(e.from) || !inSet.has(e.to)) continue; // only edges inside this set
    const succs = succ.get(e.from)!;
    if (succs.includes(e.to)) continue; // dedupe repeated edges (fold pushes, never dedupes)
    succs.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const done = new Set<NodeId>();
  const out: NodeId[] = [];
  while (out.length < siblings.length) {
    // first unprocessed indeg==0 node in insertion order — the source of stability
    let pick = siblings.find((s) => !done.has(s) && indeg.get(s) === 0);
    // defensive: unreachable (fold rejects cyclic relate) but degrade
    // deterministically instead of spinning — take the earliest unprocessed node
    pick = pick ?? siblings.find((s) => !done.has(s))!;
    done.add(pick);
    out.push(pick);
    for (const t of succ.get(pick) ?? []) indeg.set(t, indeg.get(t)! - 1);
  }
  return out;
}

// ---- dependency connectors & predecessors (issue #29) -----------------------
// The dependency edges already reach the surface (used for orderSiblings); here
// we turn them into (a) a per-node predecessor list for the Inspector and (b)
// finish-to-start connector geometry for the Gantt overlay. Both are pure and
// display-only: an edge is drawn ONLY when both ends are visible leaf rows that
// carry a bar (predicted ?? frozenSlot). Edges to filtered-out / non-leaf /
// unscheduled nodes are silently skipped — nothing to attach a line to.

export interface DepSegment {
  from: NodeId;
  to: NodeId;
  fromRow: number; // predecessor row index (y = fromRow*ROW_H + ROW_H/2)
  toRow: number; // successor row index
  fromX: number; // predecessor bar RIGHT edge (its completion x)
  toX: number; // successor bar LEFT edge (its start x)
  onCp: boolean; // both ends on the critical path (issue #16) → emphasise
}

/** Predecessors of `node` — the `from` end of every dependency edge whose `to`
 * is `node`, first-occurrence order, deduped. Returns the edges so the caller
 * keeps the policy (accepted/implemented). Pure. */
export function predecessorsOf(
  edges: readonly DependencyEdge[],
  node: NodeId,
): DependencyEdge[] {
  const seen = new Set<NodeId>();
  const out: DependencyEdge[] = [];
  for (const e of edges) {
    if (e.to !== node || seen.has(e.from)) continue;
    seen.add(e.from);
    out.push(e);
  }
  return out;
}

/** Finish-to-start connector geometry for the visible rows. Pure. */
export function depSegments(
  rows: readonly GanttRow[],
  edges: readonly DependencyEdge[],
  start: IsoDate,
  dayW: number,
  cpSet: ReadonlySet<NodeId> = new Set(),
): DepSegment[] {
  const index = new Map<NodeId, number>();
  rows.forEach((r, i) => index.set(r.node, i));
  const completionX = (r: GanttRow): number | null => {
    const ref = r.predicted ?? r.frozenSlot;
    return ref === null ? null : daysBetween(start, ref) * dayW;
  };
  const seen = new Set<string>();
  const out: DepSegment[] = [];
  for (const e of edges) {
    const key = `${e.from} ${e.to}`;
    if (seen.has(key)) continue; // dedupe (fold pushes, never dedupes)
    seen.add(key);
    const fi = index.get(e.from);
    const ti = index.get(e.to);
    if (fi === undefined || ti === undefined) continue; // an end is not visible
    const fr = rows[fi]!;
    const tr = rows[ti]!;
    if (!fr.isLeaf || !tr.isLeaf) continue; // bars live on leaves only
    const fx = completionX(fr);
    const tx = completionX(tr);
    if (fx === null || tx === null) continue; // an end has no bar to attach to
    out.push({
      from: e.from,
      to: e.to,
      fromRow: fi,
      toRow: ti,
      fromX: fx,
      toX: tx - nominalDays(tr) * dayW,
      onCp: cpSet.has(e.from) && cpSet.has(e.to),
    });
  }
  return out;
}

// ---- planned span rollup (issue #34) -----------------------------------------
// A parent row's plannedStart/plannedEnd is the min/max over its descendants'
// (already-resolved) plannedStart/plannedEnd — display-only min/max, not a sum,
// so this stays on the frontend side of the UI-DESIGN-BRIEF §0 line. Same
// contiguous-descendant-block shape as ScheduleGantt's local `spanOf` (rows are
// DFS-preorder, so a parent's whole subtree is the contiguous run of strictly
// greater depth that follows it) — kept here, pure & unit-testable without a DOM.

export function dateSpanOf(
  rows: readonly GanttRow[],
  i: number,
): { start: IsoDate | null; end: IsoDate | null } {
  const parent = rows[i]!;
  let start: IsoDate | null = null;
  let end: IsoDate | null = null;
  for (let j = i + 1; j < rows.length && rows[j]!.depth > parent.depth; j += 1) {
    const r = rows[j]!;
    if (r.plannedStart !== null) start = start === null ? r.plannedStart : minIso(start, r.plannedStart);
    if (r.plannedEnd !== null) end = end === null ? r.plannedEnd : maxIso(end, r.plannedEnd);
  }
  return { start, end };
}

export function buildGanttModel(
  projected: ProjectedState,
  derived: DerivedState,
  filter: RowFilter,
  plannedCost?: PlannedCostResult,
): GanttModel {
  const forecast = new Map(derived.forecast.map((f) => [f.node, f]));
  const acMap = new Map(derived.acByNode.map((a) => [a.node, a.ac]));
  // computePlannedCost's byNode is ALREADY a tree rollup (leaf = frozenBudget ??
  // latestEstimate ?? 0; parent = Σ children) — this is a pure Map projection,
  // used verbatim for both leaf and parent rows below (no re-summing here).
  const plannedCostMap = new Map((plannedCost?.byNode ?? []).map((r) => [r.node, r.plannedCost]));
  const supersededOld = new Set(projected.supersedeEdges.map((e) => e.to));
  const effective = (id: NodeId): boolean => {
    const n = projected.nodes.get(id);
    return n !== undefined && n.lifecycle !== 'cancelled' && !supersededOld.has(id);
  };

  const rows: GanttRow[] = [];
  const dates: IsoDate[] = [derived.asOf];

  const visit = (id: NodeId, depth: number): void => {
    const n = projected.nodes.get(id);
    if (n === undefined) return;
    const children = (projected.childrenOf.get(id) ?? []).filter(effective);
    const isLeaf = children.length === 0;
    const fc = forecast.get(id);
    const frozenSlot = fc?.frozenSlot ?? null;
    const predicted = fc?.predictedCompletion ?? null;
    const predictedStart = fc?.predictedStart ?? null;
    const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';
    const nomDays = nominalDurationDays(projected, id);

    // Planned start/end (issue #34) — leaf rows only here; forecast rows only
    // exist for effective LEAVES (computeForecast), so a non-leaf id never has
    // an `fc` and would resolve to null/null anyway. Parent plannedStart/End is
    // filled in the post-pass below (dateSpanOf over the already-emitted
    // descendant block), same reason ScheduleGantt's spanOf reads descendant
    // rows directly instead of a (nonexistent) parent forecast entry.
    // start fallback: no live predictedStart yet ⇒ approximate from the frozen
    // baseline completion minus the nominal duration (same offset the frozen
    // PMB bar's rendering already uses: xOf(frozenSlot) - nominalDays*dayW).
    const plannedStart = isLeaf
      ? (predictedStart ?? (frozenSlot !== null ? addDaysIso(frozenSlot, -nomDays) : null))
      : null;
    const plannedEnd = isLeaf ? (predicted ?? frozenSlot) : null;

    // Pass 1: emit EVERY effective node (contextOnly:false). Filtering happens
    // in a second pass so the date window below stays filter-independent.
    rows.push({
      node: id,
      depth,
      isLeaf,
      label: labelOf(id),
      lifecycle: n.lifecycle,
      estimateState: n.estimateState,
      assignee: n.assignee,
      kind: n.assignee?.kind ?? null,
      latestEstimate: n.latestEstimate,
      frozenBudget: n.frozenBudget,
      ownCost: n.ownCost,
      ac: acMap.get(id) ?? 0,
      frozenSlot,
      predicted,
      completed,
      slotState: classify(completed, frozenSlot, predicted),
      contextOnly: false,
      nominalDurationDays: nomDays,
      plannedCost: plannedCostMap.get(id) ?? null,
      plannedStart,
      plannedEnd,
    });
    if (frozenSlot !== null) dates.push(frozenSlot);
    if (predicted !== null) dates.push(predicted);

    for (const c of orderSiblings(children, projected.dependencyEdges)) visit(c, depth + 1);
  };

  const roots = [...projected.nodes.keys()]
    .filter((id) => projected.nodes.get(id)?.parent == null && effective(id))
    .filter((id) => (projected.childrenOf.get(id) ?? []).length > 0);
  for (const r of orderSiblings(roots, projected.dependencyEdges)) visit(r, 0);

  // Post-pass: fill non-leaf plannedStart/plannedEnd via dateSpanOf. rows[] is
  // DFS-preorder, so every descendant of row i sits at a HIGHER index than i —
  // walking backwards guarantees a parent's own descendants (leaf or nested
  // parent) are already resolved by the time we reach it.
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i]!;
    if (r.isLeaf) continue;
    const span = dateSpanOf(rows, i);
    rows[i] = { ...r, plannedStart: span.start, plannedEnd: span.end };
  }

  let start = dates[0]!;
  let end = dates[0]!;
  for (const d of dates) {
    start = minIso(start, d);
    end = maxIso(end, d);
  }
  start = addDaysIso(start, -3);
  end = addDaysIso(end, 4);

  // Pass 2: leaf filter + ancestor scaffolding (window already fixed above).
  const filtered = applyFilter(rows, filter, projected);
  return { rows: filtered, start, end, totalDays: Math.max(1, daysBetween(start, end)) };
}
