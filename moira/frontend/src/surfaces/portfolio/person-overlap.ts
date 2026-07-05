// Cross-project person view (issue #23) — PURE presentation composition, no new
// derivation: it reads each project's already-derived queues/forecast/projected
// attributes and juxtaposes them per Actor.id.
//
// Honesty rules this module encodes:
// - Identity = Actor.id string equality ONLY. There is no global identity
//   registry: the same person under different ids does NOT merge; different
//   people sharing an id DO merge. The view discloses this.
// - Capacity sums count EXPLICIT c(i,d) declarations only — the engine's
//   "absence defaults to 1.0" is a per-project reading and summing defaults
//   across projects would fabricate declarations nobody made.
// - Nothing here enforces or levels anything (D-50): overlap dates are a
//   visibility marker, not a violation verdict.

import { latestEntry } from '../../moira/capacity';
import type {
  CapacityEntry,
  DerivedState,
  IsoDate,
  ProjectedState,
} from '../../moira/engine';
import type { RosterMember } from '../../moira/roster';

export interface PersonOverlapProjectInput {
  key: string;
  label: string;
  nodeLabels: Record<string, string>;
  actorLabels: Record<string, string>;
  members: readonly RosterMember[];
  capacityEntries: readonly CapacityEntry[];
  projected: ProjectedState;
  derived: Pick<DerivedState, 'forecast' | 'humanReviewQueue'>;
}

export interface PersonProjectSlice {
  projectKey: string;
  projectLabel: string;
  /** the display name THIS project's actorLabels gives the id (may differ per project). */
  displayName: string | null;
  /** node labels the person is actively working (assignee & lifecycle=implementing). */
  implementing: readonly string[];
  /** review-queue node labels where this person is the designated reviewer. */
  reviewWait: readonly string[];
  /** window-clipped scheduled dates (frozen slots ∪ predicted completions of the person's nodes). */
  scheduledDates: readonly IsoDate[];
  /** Σ of EXPLICIT c(i,d) declarations over the window (see module header). */
  declaredCapacitySum: number;
  /** how many window days have an explicit declaration. */
  declaredDays: number;
}

export interface PersonOverlapRow {
  actorId: string;
  /** kinds observed across projects (usually one; both if the id is mixed). */
  kinds: readonly ('human' | 'agent')[];
  /** display names across projects, deduped (one id may show several names). */
  displayNames: readonly string[];
  slices: readonly PersonProjectSlice[];
  /** dates scheduled in TWO OR MORE projects — the「取り合い」marker. */
  overlapDates: readonly IsoDate[];
}

const addDays = (d: IsoDate, n: number): IsoDate =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function windowDates(asOf: IsoDate, windowDays: number): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = 0; i < windowDays; i += 1) out.push(addDays(asOf, i));
  return out;
}

function buildSlice(
  proj: PersonOverlapProjectInput,
  id: string,
  win: readonly IsoDate[],
  winSet: ReadonlySet<IsoDate>,
): PersonProjectSlice {
  const implementing: string[] = [];
  for (const n of proj.projected.nodes.values()) {
    if (n.assignee?.id === id && n.lifecycle === 'implementing') {
      implementing.push(proj.nodeLabels[n.id] ?? n.id);
    }
  }
  const reviewWait: string[] = [];
  for (const nodeId of proj.derived.humanReviewQueue) {
    const n = proj.projected.nodes.get(nodeId);
    if (n?.reviewer?.id === id) reviewWait.push(proj.nodeLabels[nodeId] ?? nodeId);
  }
  const dates = new Set<IsoDate>();
  for (const f of proj.derived.forecast) {
    const n = proj.projected.nodes.get(f.node);
    if (n?.assignee?.id !== id) continue;
    if (f.frozenSlot !== null && winSet.has(f.frozenSlot)) dates.add(f.frozenSlot);
    if (f.predictedCompletion !== null && winSet.has(f.predictedCompletion)) {
      dates.add(f.predictedCompletion);
    }
  }
  let declaredCapacitySum = 0;
  let declaredDays = 0;
  for (const d of win) {
    const e = latestEntry(proj.capacityEntries, id, d);
    if (e !== undefined) {
      declaredCapacitySum += e.capacity;
      declaredDays += 1;
    }
  }
  return {
    projectKey: proj.key,
    projectLabel: proj.label,
    displayName: proj.actorLabels[id] ?? null,
    implementing,
    reviewWait,
    scheduledDates: [...dates].sort(),
    declaredCapacitySum,
    declaredDays,
  };
}

/** ids that EXIST in a project: assignees ∪ reviewers ∪ roster ∪ capacity humans. */
function actorIdsOf(proj: PersonOverlapProjectInput): Map<string, 'human' | 'agent'> {
  const ids = new Map<string, 'human' | 'agent'>();
  for (const n of proj.projected.nodes.values()) {
    if (n.assignee !== null && !ids.has(n.assignee.id)) ids.set(n.assignee.id, n.assignee.kind);
    if (n.reviewer !== null && !ids.has(n.reviewer.id)) ids.set(n.reviewer.id, n.reviewer.kind);
  }
  for (const m of proj.members) if (!ids.has(m.id)) ids.set(m.id, m.kind);
  for (const c of proj.capacityEntries) if (!ids.has(c.humanId)) ids.set(c.humanId, 'human');
  return ids;
}

export function computePersonOverlap(
  projects: readonly PersonOverlapProjectInput[],
  asOf: IsoDate,
  windowDays = 14,
): PersonOverlapRow[] {
  const win = windowDates(asOf, windowDays);
  const winSet = new Set(win);

  const acc = new Map<
    string,
    { kinds: Set<'human' | 'agent'>; names: Set<string>; slices: PersonProjectSlice[] }
  >();
  for (const proj of projects) {
    for (const [id, kind] of actorIdsOf(proj)) {
      let row = acc.get(id);
      if (row === undefined) {
        row = { kinds: new Set(), names: new Set(), slices: [] };
        acc.set(id, row);
      }
      row.kinds.add(kind);
      const slice = buildSlice(proj, id, win, winSet);
      if (slice.displayName !== null) row.names.add(slice.displayName);
      row.slices.push(slice);
    }
  }

  const rows: PersonOverlapRow[] = [...acc.entries()].map(([actorId, r]) => {
    const dateCount = new Map<IsoDate, number>();
    for (const s of r.slices) {
      for (const d of s.scheduledDates) dateCount.set(d, (dateCount.get(d) ?? 0) + 1);
    }
    const overlapDates = [...dateCount.entries()]
      .filter(([, c]) => c >= 2)
      .map(([d]) => d)
      .sort();
    return {
      actorId,
      kinds: [...r.kinds].sort(),
      displayNames: [...r.names].sort(),
      slices: r.slices,
      overlapDates,
    };
  });

  // The point of the view: people spread across projects float to the top —
  // multi-project first, then more overlap days, then stable id order.
  rows.sort(
    (a, b) =>
      b.slices.length - a.slices.length ||
      b.overlapDates.length - a.overlapDates.length ||
      a.actorId.localeCompare(b.actorId),
  );
  return rows;
}
