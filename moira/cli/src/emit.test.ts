import { describe, expect, it } from 'vitest';
import { derive } from 'moira-backend';
import type { Actor } from 'moira-backend';
import {
  agreeEvent,
  assignEvent,
  costEvent,
  decomposeEvent,
  lifecycleEvent,
  relateEvent,
} from './emit.js';
import type { Stamp } from './stamp.js';

const me: Actor = { kind: 'human', id: 'me' };
const ai: Actor = { kind: 'agent', id: 'claude' };
const s = (id: string, ts: number): Stamp => ({ id, ts });

describe('emit builders produce faithful event shapes', () => {
  it('decompose omits estimate when undefined (exactOptionalPropertyTypes)', () => {
    const e = decomposeEvent(s('e1', 1), me, 'P', [{ node: 'a' }, { node: 'b', estimate: 3 }], 'r');
    expect(e).toEqual({
      kind: 'decompose',
      id: 'e1',
      ts: 1,
      actor: me,
      parent: 'P',
      reason: 'r',
      children: [{ node: 'a' }, { node: 'b', estimate: 3 }],
    });
    expect('estimate' in e.children[0]!).toBe(false);
  });

  it('agree is a human estimate-agreement→agreed with optional frozen budget', () => {
    expect(agreeEvent(s('e1', 1), me, 'a')).toMatchObject({
      kind: 'transition',
      machine: 'estimate-agreement',
      to: 'agreed',
      actor: me,
    });
    expect(agreeEvent(s('e1', 1), me, 'a', 5)).toMatchObject({ frozenBudget: 5 });
  });

  it('assign sets assignee + optional reviewer/slot on a ready transition', () => {
    const e = assignEvent(s('e1', 1), me, 'a', ai, { reviewer: me, frozenSlot: '2026-06-22' });
    expect(e).toMatchObject({
      machine: 'lifecycle',
      to: 'ready',
      assignee: ai,
      reviewer: me,
      frozenSlot: '2026-06-22',
    });
  });

  it('lifecycle / cost / relate builders', () => {
    expect(lifecycleEvent(s('e1', 1), me, 'a', 'implementing')).toMatchObject({
      machine: 'lifecycle',
      to: 'implementing',
    });
    expect(costEvent(s('e1', 1), me, 'a', 4)).toMatchObject({ kind: 'cost', amount: 4 });
    expect(relateEvent(s('e1', 1), me, 'add', 'a', 'b', 'dependency', 'accepted')).toMatchObject({
      kind: 'relate',
      op: 'add',
      edgeKind: 'dependency',
      policy: 'accepted',
    });
  });

  it('the engine rejects an agent-issued agreement (human-commit guard is preserved)', () => {
    const d = derive(
      [
        decomposeEvent(s('e1', 1), me, 'P', [{ node: 'a', estimate: 3 }], 'r'),
        agreeEvent(s('e2', 2), ai, 'a', 3), // agent cannot agree → structural error
      ],
      { asOf: '2026-06-29' },
    );
    expect(d.structuralErrors.length).toBeGreaterThan(0);
  });
});
