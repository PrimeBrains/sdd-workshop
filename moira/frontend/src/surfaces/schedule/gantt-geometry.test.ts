// orderSiblings is the fix for issue #7 (Part A): the Gantt / spec-value tree
// used to sort siblings by node id, which scrambled phase order
// (design < impl-1 < req < review-impl < tasks). These tests pin the two
// guarantees: a dependency edge decides order, and with no edge the insertion
// (emit) order stands — never a lexicographic id sort.

import { describe, expect, it } from 'vitest';
import { derive, fold } from '../../moira/engine';
import type { Actor, DependencyEdge, Event, NodeId } from '../../moira/engine';
import { buildGanttModel, orderSiblings } from './gantt-geometry';

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
  buildGanttModel(fold(events), derive(events, { asOf: '2026-01-01' }), 'all').rows.map((r) => r.node);

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
