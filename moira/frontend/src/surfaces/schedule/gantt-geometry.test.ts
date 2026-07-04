// orderSiblings is the fix for issue #7 (Part A): the Gantt / spec-value tree
// used to sort siblings by node id, which scrambled phase order
// (design < impl-1 < req < review-impl < tasks). These tests pin the two
// guarantees: a dependency edge decides order, and with no edge the insertion
// (emit) order stands — never a lexicographic id sort.

import { describe, expect, it } from 'vitest';
import { derive, fold } from '../../moira/engine';
import type { Actor, DependencyEdge, Event, IsoDate, NodeId } from '../../moira/engine';
import {
  assigneeOptions,
  buildGanttModel,
  DEFAULT_ROW_FILTER,
  type GanttRow,
  leafMatches,
  orderSiblings,
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
