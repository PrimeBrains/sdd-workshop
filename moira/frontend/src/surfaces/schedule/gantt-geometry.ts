// DISPLAY-ONLY geometry & row model for the Gantt. No metric is computed here:
// dates come straight from derived.forecast (frozenSlot / predictedCompletion),
// per-node attributes from the projected fold, ac from derived.acByNode. The only
// arithmetic is calendar geometry (date → x) and effective-tree depth — both are
// the projections allowed by UI-DESIGN-BRIEF §0.

import type {
  Actor,
  ActorKind,
  DependencyEdge,
  DerivedState,
  EstimateState,
  IsoDate,
  LifecycleState,
  NodeId,
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
}

export interface GanttModel {
  rows: GanttRow[];
  start: IsoDate;
  end: IsoDate;
  totalDays: number;
}

/** Nominal bar length in days from the estimate — DISPLAY geometry only
 * (mirrors leveler.durationDays; the authoritative signal is the completion
 * date marker, not the bar length). */
export function nominalDays(row: GanttRow): number {
  const est = row.latestEstimate ?? row.frozenBudget ?? 1;
  return Math.max(1, Math.ceil(est));
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

export function buildGanttModel(
  projected: ProjectedState,
  derived: DerivedState,
  filter: RowFilter,
): GanttModel {
  const forecast = new Map(derived.forecast.map((f) => [f.node, f]));
  const acMap = new Map(derived.acByNode.map((a) => [a.node, a.ac]));
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
    const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';

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
    });
    if (frozenSlot !== null) dates.push(frozenSlot);
    if (predicted !== null) dates.push(predicted);

    for (const c of orderSiblings(children, projected.dependencyEdges)) visit(c, depth + 1);
  };

  const roots = [...projected.nodes.keys()]
    .filter((id) => projected.nodes.get(id)?.parent == null && effective(id))
    .filter((id) => (projected.childrenOf.get(id) ?? []).length > 0);
  for (const r of orderSiblings(roots, projected.dependencyEdges)) visit(r, 0);

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
