// decision-inbox predicate tests (issue #12). Builds small event logs through the
// SAME engine the app runs (fold/derive), so the inbox is exercised end-to-end —
// no hand-mocked DerivedState. Proves the acceptance commit appears/vanishes by
// PREDICATE (an appended event falsifies it, §2.1 — never a stored dismiss flag).
//
// Events are constructed inline (typed against the real Event union) rather than
// via the backend test-utils Log: the frontend deliberately keeps a NARROW set of
// ambient @backend/* module declarations (backend-runtime.d.ts) and does not
// expose the test helpers to tsc.

import { describe, expect, it } from 'vitest';
import { derive, fold } from './engine';
import type { Actor, Event } from './engine';
import { assigneeOptions, computeInbox, itemMatchesActor } from './warnings';
import type { InboxItem } from './warnings';

const ASOF = '2026-07-01';
const H = (id: string): Actor => ({ kind: 'human', id });
const A = (id: string): Actor => ({ kind: 'agent', id });

// leaf that reached `implemented` and awaits human acceptance (never agreed → proposed).
const implementedLeaf = (): Event[] => [
  { kind: 'decompose', id: 't1', ts: 1, actor: A('ai'), parent: 'F', reason: 'r', children: [{ node: 'leaf' }] },
  { kind: 'transition', id: 't2', ts: 2, actor: A('bot'), node: 'leaf', machine: 'lifecycle', to: 'implementing', assignee: A('bot') },
  { kind: 'transition', id: 't3', ts: 3, actor: H('h1'), node: 'leaf', machine: 'lifecycle', to: 'implemented' },
];

describe('computeInbox — acceptance commit (issue #12)', () => {
  it('(a) an implemented effective leaf surfaces a commit-accept item typed "accept"', () => {
    const events = implementedLeaf();
    const items = computeInbox(derive(events, { asOf: ASOF }), fold(events));
    const accept = items.find((i) => i.key === 'commit-accept:leaf');
    expect(accept).toBeDefined();
    expect(accept?.decisionType).toBe('accept');
    expect(accept?.rid).toBe('commit·受入');
  });

  it('(b) appending the accepted transition falsifies the predicate → item vanishes', () => {
    const events: Event[] = [
      ...implementedLeaf(),
      { kind: 'transition', id: 't4', ts: 4, actor: H('h1'), node: 'leaf', machine: 'lifecycle', to: 'accepted' },
    ];
    const items = computeInbox(derive(events, { asOf: ASOF }), fold(events));
    expect(items.find((i) => i.key === 'commit-accept:leaf')).toBeUndefined();
  });

  it('(c) an implemented-but-proposed leaf shows R-U13 (warning) and 受入 (commit) at once', () => {
    const events = implementedLeaf(); // never agreed → estimateState stays proposed
    const items = computeInbox(derive(events, { asOf: ASOF }), fold(events));
    expect(items.find((i) => i.key === 'R-U13:leaf')?.decisionType).toBe('warning');
    expect(items.find((i) => i.key === 'commit-accept:leaf')?.decisionType).toBe('accept');
  });

  it('(d) every item carries a decisionType and all keys are unique', () => {
    const events = implementedLeaf();
    const items = computeInbox(derive(events, { asOf: ASOF }), fold(events));
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(['estimate', 'assign', 'accept', 'warning']).toContain(it.decisionType);
    }
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('itemMatchesActor / assigneeOptions (issue #12)', () => {
  // leaf with assignee=alice (worker) and reviewer=bob (designated reviewer).
  const events: Event[] = [
    { kind: 'decompose', id: 't1', ts: 1, actor: A('ai'), parent: 'F', reason: 'r', children: [{ node: 'leaf' }] },
    { kind: 'transition', id: 't2', ts: 2, actor: H('alice'), node: 'leaf', machine: 'lifecycle', to: 'implementing', assignee: H('alice') },
    { kind: 'transition', id: 't3', ts: 3, actor: H('alice'), node: 'leaf', machine: 'lifecycle', to: 'implemented', reviewer: H('bob') },
  ];
  const projected = fold(events);
  const item: InboxItem = {
    key: 'commit-accept:leaf',
    rid: 'commit·受入',
    kind: 'commit',
    decisionType: 'accept',
    title: 't',
    node: 'leaf',
    surface: 'schedule-time',
    actions: [],
    clearWhen: 'c',
  };

  it('(e) matches on assignee AND reviewer, but not an unrelated actor', () => {
    expect(itemMatchesActor(item, projected, 'alice')).toBe(true); // assignee
    expect(itemMatchesActor(item, projected, 'bob')).toBe(true); // reviewer (受入 is the reviewer's job)
    expect(itemMatchesActor(item, projected, 'carol')).toBe(false);
  });

  it('a node-less item never matches any actor', () => {
    const nodeless: InboxItem = { ...item, node: undefined };
    expect(itemMatchesActor(nodeless, projected, 'alice')).toBe(false);
  });

  it('assigneeOptions returns the distinct actors (assignee + reviewer), id-sorted', () => {
    expect(assigneeOptions(projected).map((a) => a.id)).toEqual(['alice', 'bob']);
  });
});
