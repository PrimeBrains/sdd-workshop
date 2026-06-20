// DISPLAY-ONLY geometry & row model for the Gantt. No metric is computed here:
// dates come straight from derived.forecast (frozenSlot / predictedCompletion),
// per-node attributes from the projected fold, ac from derived.acByNode. The only
// arithmetic is calendar geometry (date → x) and effective-tree depth — both are
// the projections allowed by UI-DESIGN-BRIEF §0.

import type {
  Actor,
  ActorKind,
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

export function buildGanttModel(
  projected: ProjectedState,
  derived: DerivedState,
  filterKind: 'all' | 'human' | 'agent',
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

    const kindMatch =
      filterKind === 'all' ||
      (n.assignee !== null && n.assignee.kind === filterKind) ||
      !isLeaf; // keep parents as scaffolding regardless of filter

    if (kindMatch) {
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
      });
    }
    if (frozenSlot !== null) dates.push(frozenSlot);
    if (predicted !== null) dates.push(predicted);

    for (const c of [...children].sort((a, b) => (a < b ? -1 : 1))) visit(c, depth + 1);
  };

  const roots = [...projected.nodes.keys()]
    .filter((id) => projected.nodes.get(id)?.parent == null && effective(id))
    .filter((id) => (projected.childrenOf.get(id) ?? []).length > 0)
    .sort((a, b) => (a < b ? -1 : 1));
  for (const r of roots) visit(r, 0);

  let start = dates[0]!;
  let end = dates[0]!;
  for (const d of dates) {
    start = minIso(start, d);
    end = maxIso(end, d);
  }
  start = addDaysIso(start, -3);
  end = addDaysIso(end, 4);
  return { rows, start, end, totalDays: Math.max(1, daysBetween(start, end)) };
}
