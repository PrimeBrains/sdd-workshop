import { describe, expect, it } from 'vitest';
import { derive } from 'moira-backend';
import type { Actor, Event } from 'moira-backend';
import { agreeEvent, assignEvent, costEvent, decomposeEvent, lifecycleEvent } from './emit.js';
import { seqStamper } from './stamp.js';

// The CLI golden: a tiny TODO project driven through the same command sequence a
// developer would run (add → agree → assign → done/accept → cost) must fold+derive
// to the snapshot verified by hand AND via the real CLI in this repo:
//   EV_abs 5 | EV% 5/7 | PV 7 | AC 6 | CPI 5/6 | review queue [list-tasks]
// (asOf 2026-06-29, startDate 2026-06-22)

const me: Actor = { kind: 'human', id: 'me' };

function buildTodoLog(): Event[] {
  const s = seqStamper();
  const ev: Event[] = [];
  // `moira add` ×3 (each one decompose under the same parent — fold accumulates)
  ev.push(decomposeEvent(s(), me, 'todo-app', [{ node: 'add-task', estimate: 3 }], 'add'));
  ev.push(decomposeEvent(s(), me, 'todo-app', [{ node: 'list-tasks', estimate: 2 }], 'add'));
  ev.push(decomposeEvent(s(), me, 'todo-app', [{ node: 'complete-task', estimate: 2 }], 'add'));
  // `moira agree` ×3 (human commit)
  ev.push(agreeEvent(s(), me, 'add-task'));
  ev.push(agreeEvent(s(), me, 'list-tasks'));
  ev.push(agreeEvent(s(), me, 'complete-task'));
  // `moira assign` ×3 (assignee + first-scheduling slot)
  ev.push(assignEvent(s(), me, 'add-task', me, { frozenSlot: '2026-06-22' }));
  ev.push(assignEvent(s(), me, 'list-tasks', me, { frozenSlot: '2026-06-25' }));
  ev.push(assignEvent(s(), me, 'complete-task', me, { frozenSlot: '2026-06-29' }));
  // progress: add-task accepted, list-tasks left at implemented (review queue)
  ev.push(lifecycleEvent(s(), me, 'add-task', 'implemented'));
  ev.push(lifecycleEvent(s(), me, 'add-task', 'accepted'));
  ev.push(lifecycleEvent(s(), me, 'list-tasks', 'implemented'));
  // actual cost (add-task overran its 3 MD budget)
  ev.push(costEvent(s(), me, 'add-task', 4));
  ev.push(costEvent(s(), me, 'list-tasks', 2));
  return ev;
}

describe('CLI golden — TODO app end-to-end derives to the verified EVM snapshot', () => {
  const d = derive(buildTodoLog(), { asOf: '2026-06-29', startDate: '2026-06-22' });

  it('earned value, plan, cost and indices', () => {
    expect(d.evAbs).toBe(5);
    expect(d.evPercent).toBeCloseTo(5 / 7, 6);
    expect(d.pv).toBe(7);
    expect(d.ac).toBe(6);
    expect(d.cpi).toBeCloseTo(5 / 6, 6);
  });

  it('coverage is full and the queue holds the un-accepted, completed leaf', () => {
    expect(d.estimateCoverage).toBe(1);
    expect(d.scheduleCoverage).toBe(1);
    expect(d.humanReviewQueue).toEqual(['list-tasks']);
    expect(d.structuralErrors).toEqual([]);
  });
});
