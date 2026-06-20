// Fluent builders for constructing event logs in tests. Auto-incrementing
// (ts, id) keeps logs deterministic; `raw()` accepts a fully-specified event for
// ordering tests.

import type { Actor, EdgePolicy, Event, IsoDate, LifecycleState } from './types.js';

export const human = (id: string): Actor => ({ kind: 'human', id });
export const agent = (id: string): Actor => ({ kind: 'agent', id });

export class Log {
  private events: Event[] = [];
  private seq = 0;

  private stamp(): { id: string; ts: number } {
    this.seq += 1;
    return { id: `t${String(this.seq).padStart(3, '0')}`, ts: this.seq };
  }

  raw(event: Event): this {
    this.events.push(event);
    return this;
  }

  decompose(
    parent: string,
    children: Array<{ node: string; estimate?: number }>,
    actor: Actor = agent('ai'),
    reason = 'reason',
  ): this {
    this.events.push({ kind: 'decompose', ...this.stamp(), actor, parent, reason, children });
    return this;
  }

  agree(node: string, frozenBudget: number, actor: Actor = human('h1')): this {
    this.events.push({
      kind: 'transition',
      ...this.stamp(),
      actor,
      node,
      machine: 'estimate-agreement',
      to: 'agreed',
      frozenBudget,
    });
    return this;
  }

  dep(from: string, to: string, policy: EdgePolicy = 'implemented', actor: Actor = agent('ai')): this {
    this.events.push({
      kind: 'relate',
      ...this.stamp(),
      actor,
      op: 'add',
      from,
      to,
      edgeKind: 'dependency',
      policy,
    });
    return this;
  }

  supersede(newNode: string, oldNode: string, actor: Actor = agent('ai')): this {
    this.events.push({
      kind: 'relate',
      ...this.stamp(),
      actor,
      op: 'add',
      from: newNode,
      to: oldNode,
      edgeKind: 'supersede',
    });
    return this;
  }

  schedule(node: string, assignee: Actor, frozenSlot: IsoDate): this {
    this.events.push({
      kind: 'transition',
      ...this.stamp(),
      actor: assignee,
      node,
      machine: 'lifecycle',
      to: 'ready',
      assignee,
      frozenSlot,
    });
    return this;
  }

  assign(node: string, assignee: Actor, to: LifecycleState = 'ready'): this {
    this.events.push({
      kind: 'transition',
      ...this.stamp(),
      actor: assignee,
      node,
      machine: 'lifecycle',
      to,
      assignee,
    });
    return this;
  }

  life(node: string, to: LifecycleState, actor: Actor = human('h1')): this {
    this.events.push({ kind: 'transition', ...this.stamp(), actor, node, machine: 'lifecycle', to });
    return this;
  }

  cost(node: string, amount: number, actor: Actor = human('h1')): this {
    this.events.push({ kind: 'cost', ...this.stamp(), actor, node, amount });
    return this;
  }

  all(): Event[] {
    return this.events;
  }
}
