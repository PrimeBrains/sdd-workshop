// orderSiblings is the fix for issue #7 (Part A): the Gantt / spec-value tree
// used to sort siblings by node id, which scrambled phase order
// (design < impl-1 < req < review-impl < tasks). These tests pin the two
// guarantees: a dependency edge decides order, and with no edge the insertion
// (emit) order stands — never a lexicographic id sort.

import { describe, expect, it } from 'vitest';
import { computePlannedCost, derive, fold } from '../../moira/engine';
import type { Actor, DependencyEdge, Event, IsoDate, NodeId } from '../../moira/engine';
import {
  assigneeOptions,
  buildAxisTicks,
  buildGanttModel,
  dateSpanOf,
  DEFAULT_ROW_FILTER,
  depSegments,
  type GanttRow,
  leafMatches,
  orderSiblings,
  predecessorsOf,
  type RowFilter,
} from './gantt-geometry';

const dep = (from: NodeId, to: NodeId): DependencyEdge => ({ from, to, policy: 'accepted' });

describe('orderSiblings', () => {
  it('(a) with no edges returns the input order verbatim', () => {
    expect(orderSiblings(['b', 'a', 'c'], [])).toEqual(['b', 'a', 'c']);
  });

  it('(b) a reverse-lexicographic dependency (b→a) makes topo order win over id order', () => {
    expect(orderSiblings(['a', 'b'], [dep('b', 'a')])).toEqual(['b', 'a']);
  });

  it('(c) with an edge on only a subset, unrelated nodes keep their insertion order', () => {
    // c→b orders that pair; x has no edge and stays where insertion order placed it
    expect(orderSiblings(['x', 'b', 'c'], [dep('c', 'b')])).toEqual(['x', 'c', 'b']);
  });

  it('(d) edges with an endpoint outside the sibling set are ignored', () => {
    // from outside the set must not inflate an in-set successor's in-degree
    expect(orderSiblings(['a', 'b'], [dep('z', 'a')])).toEqual(['a', 'b']);
    // to outside the set is harmless and dropped
    expect(orderSiblings(['a', 'b'], [dep('a', 'z')])).toEqual(['a', 'b']);
  });

  it('(e) duplicate edges do not double-count in-degree', () => {
    expect(orderSiblings(['a', 'b'], [dep('b', 'a'), dep('b', 'a'), dep('b', 'a')])).toEqual(['b', 'a']);
  });

  it('(f) an artificial cycle fed directly returns deterministically without hanging', () => {
    const out = orderSiblings(['a', 'b'], [dep('a', 'b'), dep('b', 'a')]);
    expect(out).toHaveLength(2);
    expect([...out].sort()).toEqual(['a', 'b']); // every node accounted for exactly once
    // deterministic: the same cyclic input yields the same output
    expect(orderSiblings(['a', 'b'], [dep('a', 'b'), dep('b', 'a')])).toEqual(out);
  });
});

// ---- buildGanttModel integration (through the real fold/derive engine) --------

const ai: Actor = { kind: 'agent', id: 'claude' };
const me: Actor = { kind: 'human', id: 'me' };
let seq = 0;
const stamp = (): { id: string; ts: number } => ({ id: `e${String(++seq).padStart(3, '0')}`, ts: seq });
const decompose = (parent: NodeId, children: readonly NodeId[]): Event => ({
  kind: 'decompose',
  ...stamp(),
  actor: ai,
  parent,
  reason: 'test',
  children: children.map((node) => ({ node })),
});
const relate = (from: NodeId, to: NodeId): Event => ({
  kind: 'relate',
  ...stamp(),
  actor: me,
  op: 'add',
  from,
  to,
  edgeKind: 'dependency',
  policy: 'accepted',
});
const rowNodes = (events: Event[]): NodeId[] =>
  buildGanttModel(fold(events), derive(events, { asOf: '2026-01-01' }), DEFAULT_ROW_FILTER).rows.map((r) => r.node);

const PROCESS = ['feat/req', 'feat/design', 'feat/tasks', 'feat/impl-1', 'feat/review-impl'];

describe('buildGanttModel sibling ordering', () => {
  it('orders phase siblings by dependency edges even when decompose order is lexicographic', () => {
    // children injected in LEXICOGRAPHIC order — the exact order the old id sort produced
    const events: Event[] = [
      decompose('app', ['feat']),
      decompose('feat', ['feat/design', 'feat/impl-1', 'feat/req', 'feat/review-impl', 'feat/tasks']),
      relate('feat/req', 'feat/design'),
      relate('feat/design', 'feat/tasks'),
      relate('feat/tasks', 'feat/impl-1'),
      relate('feat/impl-1', 'feat/review-impl'),
    ];
    expect(rowNodes(events).filter((n) => n.startsWith('feat/'))).toEqual(PROCESS);
  });

  it('falls back to insertion (emit) order when there are no edges — not a lexicographic sort', () => {
    const events: Event[] = [
      decompose('app', ['feat']),
      decompose('feat', PROCESS), // emitted in process order, no dependency edges
    ];
    const siblings = rowNodes(events).filter((n) => n.startsWith('feat/'));
    expect(siblings).toEqual(PROCESS);
    expect(siblings[0]).toBe('feat/req'); // a lexicographic sort would have put design first
  });

  it('applies the same ordering to the root set (no id sort on roots)', () => {
    // two roots inserted in reverse-lexicographic order; no edges → insertion kept
    const events: Event[] = [
      decompose('z-root', ['z-root/x']),
      decompose('a-root', ['a-root/y']),
    ];
    const roots = rowNodes(events).filter((n) => !n.includes('/'));
    expect(roots).toEqual(['z-root', 'a-root']); // NOT ['a-root', 'z-root']
  });
});

// ---- row filter (issue #8) ---------------------------------------------------

const row = (o: Partial<GanttRow>): GanttRow => ({
  node: 'n',
  depth: 2,
  isLeaf: true,
  label: 'n',
  lifecycle: 'ready',
  estimateState: 'proposed',
  assignee: null,
  kind: null,
  latestEstimate: null,
  frozenBudget: null,
  ownCost: 0,
  ac: 0,
  frozenSlot: null,
  predicted: null,
  completed: false,
  slotState: 'unscheduled-incomplete',
  contextOnly: false,
  // mirrors nominalDurationDays' own formula (latestEstimate ?? 0, clamped ≥1)
  // so pre-existing depSegments-style tests that only set latestEstimate keep
  // their expected pixel widths without every call site restating it.
  nominalDurationDays: Math.max(1, Math.ceil(o.latestEstimate ?? 0)),
  plannedCost: null,
  plannedStart: null,
  plannedEnd: null,
  ...o,
});
const withF = (o: Partial<RowFilter>): RowFilter => ({ ...DEFAULT_ROW_FILTER, ...o });

describe('leafMatches', () => {
  it('kind: honours the actor-kind dimension, all passes through', () => {
    const agent = row({ kind: 'agent', assignee: { kind: 'agent', id: 'claude' } });
    expect(leafMatches(agent, withF({ kind: 'human' }))).toBe(false);
    expect(leafMatches(agent, withF({ kind: 'agent' }))).toBe(true);
    expect(leafMatches(agent, withF({ kind: 'all' }))).toBe(true);
  });

  it('assignee: unassigned vs a specific id', () => {
    const unassigned = row({ assignee: null });
    const mine = row({ assignee: { kind: 'human', id: 'me' }, kind: 'human' });
    expect(leafMatches(unassigned, withF({ assignee: 'unassigned' }))).toBe(true);
    expect(leafMatches(mine, withF({ assignee: 'unassigned' }))).toBe(false);
    expect(leafMatches(mine, withF({ assignee: { id: 'me' } }))).toBe(true);
    expect(leafMatches(mine, withF({ assignee: { id: 'someone-else' } }))).toBe(false);
    expect(leafMatches(unassigned, withF({ assignee: { id: 'me' } }))).toBe(false);
  });

  it('completion: strict (completed ∧ agreed) differs from loose (completed)', () => {
    const doneButUnagreed = row({ completed: true, estimateState: 'proposed' });
    // loose: it counts as complete
    expect(leafMatches(doneButUnagreed, withF({ completion: 'complete' }))).toBe(true);
    expect(leafMatches(doneButUnagreed, withF({ completion: 'incomplete' }))).toBe(false);
    // strict: unagreed ⇒ NOT really done
    expect(leafMatches(doneButUnagreed, withF({ completion: 'complete', completionStrict: true }))).toBe(false);
    expect(leafMatches(doneButUnagreed, withF({ completion: 'incomplete', completionStrict: true }))).toBe(true);
    // strict + agreed ⇒ done
    const doneAgreed = row({ completed: true, estimateState: 'agreed' });
    expect(leafMatches(doneAgreed, withF({ completion: 'complete', completionStrict: true }))).toBe(true);
  });

  it('estimate: unestimated / proposed / agreed', () => {
    const none = row({ latestEstimate: null, estimateState: 'proposed' });
    const proposed = row({ latestEstimate: 5, estimateState: 'proposed' });
    const agreed = row({ latestEstimate: 5, estimateState: 'agreed' });
    expect(leafMatches(none, withF({ estimate: 'unestimated' }))).toBe(true);
    expect(leafMatches(proposed, withF({ estimate: 'unestimated' }))).toBe(false);
    expect(leafMatches(proposed, withF({ estimate: 'proposed' }))).toBe(true);
    expect(leafMatches(none, withF({ estimate: 'proposed' }))).toBe(false); // no estimate ⇒ not "proposed"
    expect(leafMatches(agreed, withF({ estimate: 'agreed' }))).toBe(true);
    expect(leafMatches(proposed, withF({ estimate: 'agreed' }))).toBe(false);
  });

  it('divergence: behind vs on-track (ahead|none)', () => {
    const behind = row({ frozenSlot: '2026-01-10', predicted: '2026-01-12' });
    const ahead = row({ frozenSlot: '2026-01-10', predicted: '2026-01-08' });
    const none = row({ frozenSlot: null, predicted: null });
    expect(leafMatches(behind, withF({ divergence: 'behind' }))).toBe(true);
    expect(leafMatches(ahead, withF({ divergence: 'behind' }))).toBe(false);
    expect(leafMatches(ahead, withF({ divergence: 'on-track' }))).toBe(true);
    expect(leafMatches(none, withF({ divergence: 'on-track' }))).toBe(true); // 'none' is on-track
    expect(leafMatches(behind, withF({ divergence: 'on-track' }))).toBe(false);
  });

  it('AND composition: every dimension must pass', () => {
    const r = row({ kind: 'human', assignee: { kind: 'human', id: 'me' }, completed: true, estimateState: 'agreed' });
    expect(leafMatches(r, withF({ kind: 'human', assignee: { id: 'me' }, completion: 'complete', completionStrict: true }))).toBe(true);
    // flip one dimension → whole predicate fails
    expect(leafMatches(r, withF({ kind: 'human', assignee: { id: 'someone-else' } }))).toBe(false);
  });
});

// buildGanttModel + filter, through the real engine ---------------------------

const est = (parent: NodeId, children: Array<{ node: NodeId; estimate?: number }>): Event => ({
  kind: 'decompose',
  ...stamp(),
  actor: ai,
  parent,
  reason: 'test',
  children: children.map((c) => (c.estimate === undefined ? { node: c.node } : { node: c.node, estimate: c.estimate })),
});
const schedule = (node: NodeId, who: Actor, frozenSlot: IsoDate): Event => ({
  kind: 'transition',
  ...stamp(),
  actor: who,
  node,
  machine: 'lifecycle',
  to: 'ready',
  assignee: who,
  frozenSlot,
});
const life = (node: NodeId, to: 'implementing' | 'implemented' | 'accepted', who: Actor): Event => ({
  kind: 'transition',
  ...stamp(),
  actor: who,
  node,
  machine: 'lifecycle',
  to,
});

// app ─ feat ─ {feat/a (human), feat/b (agent)} ; gfeat ─ gfeat/x (agent)
const treeEvents = (): Event[] => [
  est('app', [{ node: 'feat' }, { node: 'gfeat' }]),
  est('feat', [{ node: 'feat/a', estimate: 4 }, { node: 'feat/b', estimate: 3 }]),
  est('gfeat', [{ node: 'gfeat/x', estimate: 2 }]),
  schedule('feat/a', me, '2026-01-10'),
  schedule('feat/b', ai, '2026-01-11'),
  schedule('gfeat/x', ai, '2026-01-12'),
];
const build = (events: Event[], f: RowFilter) =>
  buildGanttModel(fold(events), derive(events, { asOf: '2026-01-01' }), f);

describe('buildGanttModel row filter', () => {
  it('a matched depth-2 leaf keeps its ancestors as contextOnly scaffolding (no orphan)', () => {
    const model = build(treeEvents(), withF({ assignee: { id: 'me' } }));
    const byId = new Map(model.rows.map((r) => [r.node, r]));
    // matched leaf + its whole chain survive
    expect([...byId.keys()].sort()).toEqual(['app', 'feat', 'feat/a']);
    expect(byId.get('feat/a')!.contextOnly).toBe(false); // the match itself is live
    expect(byId.get('feat')!.contextOnly).toBe(true); // ancestors are scaffolding
    expect(byId.get('app')!.contextOnly).toBe(true);
    // the unrelated subtree (gfeat) is gone entirely
    expect(byId.has('gfeat')).toBe(false);
  });

  it('a filter matching nothing yields zero rows', () => {
    const model = build(treeEvents(), withF({ assignee: { id: 'nobody' } }));
    expect(model.rows).toEqual([]);
  });

  it('DEFAULT filter is a pass-through: all rows, every contextOnly false', () => {
    const model = build(treeEvents(), DEFAULT_ROW_FILTER);
    expect(model.rows.map((r) => r.node)).toEqual(['app', 'feat', 'feat/a', 'feat/b', 'gfeat', 'gfeat/x']);
    expect(model.rows.every((r) => r.contextOnly === false)).toBe(true);
  });

  it("kind='human' drops a parent whose only leaves are agents (intentional change from the old behaviour)", () => {
    const model = build(treeEvents(), withF({ kind: 'human' }));
    const ids = model.rows.map((r) => r.node);
    // only feat/a (human) matches → app, feat kept as context; feat/b, gfeat, gfeat/x gone
    expect(ids).toEqual(['app', 'feat', 'feat/a']);
    expect(ids).not.toContain('gfeat'); // the all-agent subtree vanishes
  });

  it('the date window is identical before and after filtering (axis does not move)', () => {
    const events = treeEvents();
    const unfiltered = build(events, DEFAULT_ROW_FILTER);
    const filtered = build(events, withF({ assignee: { id: 'me' } }));
    expect(filtered.start).toBe(unfiltered.start);
    expect(filtered.end).toBe(unfiltered.end);
    expect(filtered.totalDays).toBe(unfiltered.totalDays);
  });

  it('completion filter respects loose vs strict done through the engine', () => {
    // feat/a: agreed + implemented ⇒ done under both senses; feat/b: implemented but NOT agreed
    const events: Event[] = [
      ...treeEvents(),
      { kind: 'transition', ...stamp(), actor: me, node: 'feat/a', machine: 'estimate-agreement', to: 'agreed', frozenBudget: 4 },
      life('feat/a', 'implementing', me),
      life('feat/a', 'implemented', me),
      life('feat/b', 'implementing', ai),
      life('feat/b', 'implemented', ai),
    ];
    // loose complete: both a and b count
    const loose = build(events, withF({ completion: 'complete' }));
    expect(loose.rows.filter((r) => r.isLeaf).map((r) => r.node).sort()).toEqual(['feat/a', 'feat/b']);
    // strict complete: only the agreed one (feat/a) counts
    const strict = build(events, withF({ completion: 'complete', completionStrict: true }));
    expect(strict.rows.filter((r) => r.isLeaf).map((r) => r.node)).toEqual(['feat/a']);
  });
});

describe('assigneeOptions', () => {
  it('returns distinct assignees in first-occurrence order, excluding unassigned', () => {
    const events: Event[] = [
      ...treeEvents(),
      // re-assign feat/a again to me (duplicate) and add a second human on gfeat/x later
      schedule('feat/a', me, '2026-01-13'),
    ];
    const opts = assigneeOptions(fold(events));
    // me (feat/a) appears before claude (feat/b) by first occurrence; deduped
    expect(opts).toEqual([
      { kind: 'human', id: 'me' },
      { kind: 'agent', id: 'claude' },
    ]);
  });

  it('excludes nodes with no assignee', () => {
    // no schedule events ⇒ no assignees at all
    const events: Event[] = [est('app', [{ node: 'solo', estimate: 1 }])];
    expect(assigneeOptions(fold(events))).toEqual([]);
  });
});

// ---- date-axis ticks (issue #28) --------------------------------------------

describe('buildAxisTicks', () => {
  it('emits month labels (1st of each month) inside the window, weeks/days off', () => {
    // 2026-01-01 .. +60d at 10px/day → track 600px. Months: Jan(0), Feb(310), Mar(590)
    const ticks = buildAxisTicks('2026-01-01', 60, 10, { weeks: false, days: false });
    expect(ticks).toEqual([
      { x: 0, kind: 'month', label: '1月' },
      { x: 310, kind: 'month', label: '2月' }, // 31 days → 310px
      { x: 590, kind: 'month', label: '3月' }, // 31+28 days → 590px (≤ 600)
    ]);
  });

  it('anchors week ticks on the first Monday on/after start, every 7 days', () => {
    // 2026-01-01 is a Thursday → first Monday is 2026-01-05 (+4 days = x40 at 10px/day)
    const weeks = buildAxisTicks('2026-01-01', 20, 10, { weeks: true, days: false }).filter(
      (t) => t.kind === 'week',
    );
    expect(weeks).toEqual([
      { x: 40, kind: 'week', label: '1/5' },
      { x: 110, kind: 'week', label: '1/12' },
      { x: 180, kind: 'week', label: '1/19' },
    ]);
  });

  it('emits a boundary for start itself when start is a Monday', () => {
    // 2026-01-05 is a Monday → week tick at x0
    const first = buildAxisTicks('2026-01-05', 7, 10, { weeks: true, days: false }).find(
      (t) => t.kind === 'week',
    );
    expect(first).toEqual({ x: 0, kind: 'week', label: '1/5' });
  });

  it('emits a labelless day gridline per calendar day only when days is on', () => {
    const off = buildAxisTicks('2026-01-01', 3, 10, { weeks: false, days: false });
    expect(off.some((t) => t.kind === 'day')).toBe(false);
    const on = buildAxisTicks('2026-01-01', 3, 10, { weeks: false, days: true }).filter(
      (t) => t.kind === 'day',
    );
    expect(on).toEqual([
      { x: 0, kind: 'day', label: null },
      { x: 10, kind: 'day', label: null },
      { x: 20, kind: 'day', label: null },
      { x: 30, kind: 'day', label: null },
    ]);
  });
});

// ---- predecessors & dependency connectors (issue #29) -----------------------

describe('predecessorsOf', () => {
  it('returns the `from` edges into a node, first-occurrence order', () => {
    const edges = [dep('a', 'c'), dep('b', 'c'), dep('a', 'd')];
    expect(predecessorsOf(edges, 'c').map((e) => e.from)).toEqual(['a', 'b']);
    expect(predecessorsOf(edges, 'd').map((e) => e.from)).toEqual(['a']);
    expect(predecessorsOf(edges, 'x')).toEqual([]);
  });

  it('dedupes repeated edges', () => {
    expect(predecessorsOf([dep('a', 'c'), dep('a', 'c')], 'c').map((e) => e.from)).toEqual(['a']);
  });
});

describe('depSegments', () => {
  const leaf = (node: NodeId, o: Partial<GanttRow>): GanttRow =>
    row({ node, isLeaf: true, latestEstimate: 3, ...o });

  it('maps an edge to finish→start geometry (pred right edge → succ left edge)', () => {
    const rows = [
      leaf('a', { predicted: '2026-01-05', latestEstimate: 2 }),
      leaf('b', { predicted: '2026-01-10', latestEstimate: 3 }),
    ];
    const segs = depSegments(rows, [dep('a', 'b')], '2026-01-01', 10);
    expect(segs).toEqual([
      {
        from: 'a',
        to: 'b',
        fromRow: 0,
        toRow: 1,
        fromX: 40, // a completes 2026-01-05 → 4d*10
        toX: 60, // b completes 2026-01-10 → 90; minus nominal 3d*10 = 60 (bar left edge)
        onCp: false,
      },
    ]);
  });

  it('flags onCp when both ends are on the critical path', () => {
    const rows = [
      leaf('a', { predicted: '2026-01-05' }),
      leaf('b', { predicted: '2026-01-10' }),
    ];
    const segs = depSegments(rows, [dep('a', 'b')], '2026-01-01', 10, new Set(['a', 'b']));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.onCp).toBe(true);
  });

  it('skips edges whose endpoint is not a visible row', () => {
    const rows = [leaf('a', { predicted: '2026-01-05' })];
    expect(depSegments(rows, [dep('a', 'z')], '2026-01-01', 10)).toEqual([]);
  });

  it('skips non-leaf endpoints (no bar to attach to)', () => {
    const rows = [
      leaf('a', { predicted: '2026-01-05' }),
      row({ node: 'b', isLeaf: false, predicted: '2026-01-10' }),
    ];
    expect(depSegments(rows, [dep('a', 'b')], '2026-01-01', 10)).toEqual([]);
  });

  it('skips endpoints with neither predicted nor frozenSlot', () => {
    const rows = [
      leaf('a', { predicted: null, frozenSlot: null }),
      leaf('b', { predicted: '2026-01-10' }),
    ];
    expect(depSegments(rows, [dep('a', 'b')], '2026-01-01', 10)).toEqual([]);
  });

  it('falls back to frozenSlot when predicted is absent', () => {
    const rows = [
      leaf('a', { predicted: null, frozenSlot: '2026-01-05', latestEstimate: 2 }),
      leaf('b', { predicted: '2026-01-10', latestEstimate: 3 }),
    ];
    const segs = depSegments(rows, [dep('a', 'b')], '2026-01-01', 10);
    expect(segs[0]!.fromX).toBe(40); // uses frozenSlot 2026-01-05
  });

  it('dedupes repeated edges', () => {
    const rows = [
      leaf('a', { predicted: '2026-01-05' }),
      leaf('b', { predicted: '2026-01-10' }),
    ];
    expect(depSegments(rows, [dep('a', 'b'), dep('a', 'b')], '2026-01-01', 10)).toHaveLength(1);
  });
});

// ---- planned metrics (issue #34) --------------------------------------------
// 予定工数（plannedCost）・予定開始（plannedStart）・予定終了（plannedEnd）.
// plannedCost is a pure Map projection of computePlannedCost's byNode (already a
// backend tree rollup — no frontend re-summing). plannedStart/plannedEnd are a
// leaf-level fallback chain plus a parent-level dateSpanOf min/max rollup.

describe('dateSpanOf', () => {
  it('returns the min plannedStart / max plannedEnd over the contiguous descendant block', () => {
    const rows: GanttRow[] = [
      row({ node: 'p', depth: 0, isLeaf: false }),
      row({ node: 'c1', depth: 1, isLeaf: true, plannedStart: '2026-01-05', plannedEnd: '2026-01-08' }),
      row({ node: 'c2', depth: 1, isLeaf: true, plannedStart: '2026-01-02', plannedEnd: '2026-01-06' }),
    ];
    expect(dateSpanOf(rows, 0)).toEqual({ start: '2026-01-02', end: '2026-01-08' });
  });

  it('ignores descendants whose plannedStart/plannedEnd is null', () => {
    const rows: GanttRow[] = [
      row({ node: 'p', depth: 0, isLeaf: false }),
      row({ node: 'c1', depth: 1, isLeaf: true, plannedStart: null, plannedEnd: null }),
      row({ node: 'c2', depth: 1, isLeaf: true, plannedStart: '2026-01-03', plannedEnd: '2026-01-04' }),
    ];
    expect(dateSpanOf(rows, 0)).toEqual({ start: '2026-01-03', end: '2026-01-04' });
  });

  it('returns null/null when every descendant is null', () => {
    const rows: GanttRow[] = [
      row({ node: 'p', depth: 0, isLeaf: false }),
      row({ node: 'c1', depth: 1, isLeaf: true, plannedStart: null, plannedEnd: null }),
    ];
    expect(dateSpanOf(rows, 0)).toEqual({ start: null, end: null });
  });

  it('stops at the first row whose depth returns to the parent depth — a following sibling subtree is excluded', () => {
    const rows: GanttRow[] = [
      row({ node: 'p', depth: 0, isLeaf: false }),
      row({ node: 'c1', depth: 1, isLeaf: true, plannedStart: '2026-01-05', plannedEnd: '2026-01-05' }),
      row({ node: 'sibling', depth: 0, isLeaf: false }), // back to depth 0 — p's subtree ends here
      row({ node: 'other', depth: 1, isLeaf: true, plannedStart: '2099-01-01', plannedEnd: '2099-01-01' }),
    ];
    expect(dateSpanOf(rows, 0)).toEqual({ start: '2026-01-05', end: '2026-01-05' });
  });
});

describe('buildGanttModel planned metrics', () => {
  // feat/a: assigned + scheduled + AGREED with an explicit frozenBudget=10 that
  //   deliberately DIFFERS from its latestEstimate=4 — the plannedCost assertion
  //   below only passes if the row reads the byNode PROJECTION (backend rollup),
  //   not a frontend re-sum of latestEstimate. Agreed ⇒ schedulable, so the
  //   leveler gives it a live predictedStart/predicted.
  // feat/b: assigned + scheduled but NEVER agreed (latestEstimate=3, no
  //   frozenBudget) ⇒ unschedulable (estimateState stays 'proposed'), so
  //   predictedStart/predicted stay null and the leaf must fall back to its
  //   frozenSlot.
  const plannedEvents = (): Event[] => [
    est('app', [{ node: 'feat' }]),
    est('feat', [{ node: 'feat/a', estimate: 4 }, { node: 'feat/b', estimate: 3 }]),
    schedule('feat/a', me, '2026-01-10'),
    schedule('feat/b', ai, '2026-01-11'),
    {
      kind: 'transition',
      ...stamp(),
      actor: me,
      node: 'feat/a',
      machine: 'estimate-agreement',
      to: 'agreed',
      frozenBudget: 10,
    },
  ];
  const buildPlanned = (events: Event[]) => {
    const projected = fold(events);
    const derived = derive(events, { asOf: '2026-01-01' });
    const pc = computePlannedCost(projected);
    return { projected, derived, pc, model: buildGanttModel(projected, derived, DEFAULT_ROW_FILTER, pc) };
  };

  it('plannedCost projects computePlannedCost byNode verbatim: leaf uses frozenBudget over latestEstimate, parent is the backend rollup', () => {
    const { model } = buildPlanned(plannedEvents());
    const byId = new Map(model.rows.map((r) => [r.node, r]));
    expect(byId.get('feat/a')!.plannedCost).toBe(10); // frozenBudget (10) wins over latestEstimate (4)
    expect(byId.get('feat/b')!.plannedCost).toBe(3); // unagreed leaf falls back to latestEstimate
    // feat's rollup is 10+3=13 — NOT 4+3=7, the value a buggy Σ(latestEstimate)
    // frontend re-implementation would produce.
    expect(byId.get('feat')!.plannedCost).toBe(13);
  });

  it('plannedCost is null on every row when no PlannedCostResult is supplied (no silent frontend fallback sum)', () => {
    const events = plannedEvents();
    const projected = fold(events);
    const derived = derive(events, { asOf: '2026-01-01' });
    const model = buildGanttModel(projected, derived, DEFAULT_ROW_FILTER); // no 4th arg
    expect(model.rows.length).toBeGreaterThan(0);
    expect(model.rows.every((r) => r.plannedCost === null)).toBe(true);
  });

  it('leaf plannedStart: predictedStart (live forecast) wins over the frozenSlot fallback when both exist', () => {
    const { model, derived } = buildPlanned(plannedEvents());
    const a = model.rows.find((r) => r.node === 'feat/a')!;
    const fc = derived.forecast.find((f) => f.node === 'feat/a')!;
    expect(fc.predictedStart).not.toBeNull();
    expect(a.plannedStart).toBe(fc.predictedStart);
  });

  it('leaf plannedStart falls back to (frozenSlot − nominalDurationDays) when predictedStart is null (unagreed ⇒ unschedulable)', () => {
    const { model, derived } = buildPlanned(plannedEvents());
    const b = model.rows.find((r) => r.node === 'feat/b')!;
    const fc = derived.forecast.find((f) => f.node === 'feat/b')!;
    expect(fc.predictedStart).toBeNull();
    expect(fc.frozenSlot).toBe('2026-01-11');
    expect(b.nominalDurationDays).toBe(3); // ceil(latestEstimate=3)
    expect(b.plannedStart).toBe('2026-01-08'); // 01-11 minus 3 days
  });

  it('leaf plannedStart/plannedEnd are both null with no predictedStart/predicted/frozenSlot at all', () => {
    const events: Event[] = [est('app3', [{ node: 'solo', estimate: 2 }])];
    const { model } = buildPlanned(events);
    const solo = model.rows.find((r) => r.node === 'solo')!;
    expect(solo.plannedStart).toBeNull();
    expect(solo.plannedEnd).toBeNull();
  });

  it('leaf plannedEnd: predicted (live forecast completion) wins over frozenSlot; falls back to frozenSlot when predicted is null', () => {
    const { model } = buildPlanned(plannedEvents());
    const byId = new Map(model.rows.map((r) => [r.node, r]));
    expect(byId.get('feat/a')!.plannedEnd).toBe('2026-01-13'); // predicted, not frozenSlot 01-10
    expect(byId.get('feat/b')!.plannedEnd).toBe('2026-01-11'); // predicted null → frozenSlot
  });

  it('parent plannedStart/plannedEnd is the min/max over descendants (dateSpanOf), reaching through a genuinely divergent predictedStart', () => {
    // feat4/a and feat4/b share ONE human with a finish-to-start dependency, so
    // the live leveler pushes feat4/b's predictedStart (01-14) well past its own
    // frozenSlot (01-10, identical to feat4/a's) — this is the scenario that
    // actually exercises the rollup pulling a value that is NOT just an echo of
    // frozenSlot.
    const events: Event[] = [
      est('app4', [{ node: 'feat4' }]),
      est('feat4', [{ node: 'feat4/a', estimate: 4 }, { node: 'feat4/b', estimate: 3 }]),
      relate('feat4/a', 'feat4/b'),
      schedule('feat4/a', me, '2026-01-10'),
      schedule('feat4/b', me, '2026-01-10'),
      {
        kind: 'transition',
        ...stamp(),
        actor: me,
        node: 'feat4/a',
        machine: 'estimate-agreement',
        to: 'agreed',
        frozenBudget: 4,
      },
      {
        kind: 'transition',
        ...stamp(),
        actor: me,
        node: 'feat4/b',
        machine: 'estimate-agreement',
        to: 'agreed',
        frozenBudget: 3,
      },
    ];
    const { model, derived } = buildPlanned(events);
    const fcB = derived.forecast.find((f) => f.node === 'feat4/b')!;
    expect(fcB.predictedStart).toBe('2026-01-14'); // pinned: pushed past frozenSlot 01-10
    const b = model.rows.find((r) => r.node === 'feat4/b')!;
    expect(b.plannedStart).toBe('2026-01-14');
    const parent = model.rows.find((r) => r.node === 'feat4')!;
    expect(parent.plannedStart).toBe('2026-01-10'); // min(a=01-10, b=01-14)
    expect(parent.plannedEnd).toBe('2026-01-16'); // max(a=01-13, b=01-16)
  });
});
