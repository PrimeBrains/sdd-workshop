// useRoster's three regimes (issue #11): demo / fixture+members / fixture+observed.
// useRoster is a hook, so we drive it through a probe component rendered inside a
// real MoiraProvider (the observed-derivation path reads projected + capacity).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { MoiraProvider } from './store';
import { useRoster, type RosterView } from './hooks';
import { resetRosterForTests, setRoster } from './roster';
import type { CapacityEntry, Event, IsoDate } from './engine';

function capture(events: readonly Event[], capacity: readonly CapacityEntry[], asOf: IsoDate): RosterView {
  let out: RosterView | null = null;
  function Probe() {
    out = useRoster();
    return null;
  }
  renderToStaticMarkup(
    createElement(MoiraProvider, {
      initialEvents: events,
      initialCapacity: capacity,
      initialAsOf: asOf,
      children: createElement(Probe),
    }),
  );
  return out!;
}

const decompose: Event = {
  kind: 'decompose', id: 'e1', ts: 1, actor: { kind: 'human', id: 'you' },
  parent: 'root', reason: 'r', children: [{ node: 'A', estimate: 1 }],
};
const assignZoe: Event = {
  kind: 'transition', id: 'e2', ts: 2, actor: { kind: 'human', id: 'zoe' },
  node: 'A', machine: 'lifecycle', to: 'ready', assignee: { kind: 'human', id: 'zoe' },
};

afterEach(() => resetRosterForTests());

describe('useRoster', () => {
  it('demo (no fixture) → the DEMO roster, me = alice', () => {
    const r = capture([decompose], [], '2026-07-01');
    expect(r.all.map((a) => a.id)).toContain('alice');
    expect(r.all.map((a) => a.id)).toContain('ai');
    expect(r.me.id).toBe('alice');
  });

  it('fixture + members → exactly those members, humans filtered, me from fixture', () => {
    setRoster(
      [
        { id: 'nakao', kind: 'human', label: '中尾' },
        { id: 'claude', kind: 'agent', label: 'Claude' },
      ],
      'nakao',
    );
    const r = capture([decompose], [], '2026-07-01');
    expect(r.all.map((a) => a.id)).toEqual(['nakao', 'claude']);
    expect(r.humans.map((a) => a.id)).toEqual(['nakao']); // agent excluded
    expect(r.me.id).toBe('nakao');
    // crucially: NO demo name leaks in.
    expect(r.all.map((a) => a.id)).not.toContain('alice');
  });

  it('fixture + empty members → derived from observed data (assignees ∪ capacity ∪ me), id asc', () => {
    setRoster([], 'you');
    const cap: CapacityEntry[] = [{ humanId: 'yan', date: '2026-07-01', capacity: 0.5, reason: 'x', ts: 1 }];
    const r = capture([decompose, assignZoe], cap, '2026-07-01');
    // zoe (assignee) ∪ yan (capacity) ∪ you (me) → sorted asc
    expect(r.all.map((a) => a.id)).toEqual(['yan', 'you', 'zoe']);
    expect(r.me.id).toBe('you');
    expect(r.all.map((a) => a.id)).not.toContain('alice'); // still no demo leak
  });
});
