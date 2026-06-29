// Pure event builders — the only place that constructs the four canonical events
// (a direct encoding of moira/backend/src/types.ts). Kept pure (stamp injected)
// so the golden test can drive them deterministically. Optional fields are OMITTED
// (not set to undefined) to satisfy the engine's exactOptionalPropertyTypes.

import type {
  Actor,
  CapacityEntry,
  CostEvent,
  DecomposeEvent,
  EdgeKind,
  EdgePolicy,
  IsoDate,
  LifecycleState,
  NodeId,
  RelateEvent,
  TransitionEvent,
} from 'moira-backend';
import type { Stamp } from './stamp.js';

export function decomposeEvent(
  stamp: Stamp,
  actor: Actor,
  parent: NodeId,
  children: ReadonlyArray<{ node: NodeId; estimate?: number }>,
  reason: string,
): DecomposeEvent {
  return {
    kind: 'decompose',
    id: stamp.id,
    ts: stamp.ts,
    actor,
    parent,
    reason,
    children: children.map((c) =>
      c.estimate === undefined ? { node: c.node } : { node: c.node, estimate: c.estimate },
    ),
  };
}

/** Estimate agreement (proposed→agreed). MUST be a human actor (fold rejects agents). */
export function agreeEvent(
  stamp: Stamp,
  actor: Actor,
  node: NodeId,
  budget?: number,
): TransitionEvent {
  const base: TransitionEvent = {
    kind: 'transition',
    id: stamp.id,
    ts: stamp.ts,
    actor,
    node,
    machine: 'estimate-agreement',
    to: 'agreed',
  };
  return budget === undefined ? base : { ...base, frozenBudget: budget };
}

/** Assignment + (first-)scheduling. Sets assignee/reviewer/frozenSlot on a lifecycle transition. */
export function assignEvent(
  stamp: Stamp,
  actor: Actor,
  node: NodeId,
  assignee: Actor,
  opts: { reviewer?: Actor; frozenSlot?: IsoDate; to?: LifecycleState } = {},
): TransitionEvent {
  let e: TransitionEvent = {
    kind: 'transition',
    id: stamp.id,
    ts: stamp.ts,
    actor,
    node,
    machine: 'lifecycle',
    to: opts.to ?? 'ready',
    assignee,
  };
  if (opts.reviewer !== undefined) e = { ...e, reviewer: opts.reviewer };
  if (opts.frozenSlot !== undefined) e = { ...e, frozenSlot: opts.frozenSlot };
  return e;
}

/** A plain lifecycle transition (start/done/accept/cancel). */
export function lifecycleEvent(
  stamp: Stamp,
  actor: Actor,
  node: NodeId,
  to: LifecycleState,
  reason?: string,
): TransitionEvent {
  const base: TransitionEvent = {
    kind: 'transition',
    id: stamp.id,
    ts: stamp.ts,
    actor,
    node,
    machine: 'lifecycle',
    to,
  };
  return reason === undefined ? base : { ...base, reason };
}

export function costEvent(stamp: Stamp, actor: Actor, node: NodeId, amount: number): CostEvent {
  return { kind: 'cost', id: stamp.id, ts: stamp.ts, actor, node, amount };
}

export function relateEvent(
  stamp: Stamp,
  actor: Actor,
  op: 'add' | 'remove',
  from: NodeId,
  to: NodeId,
  edgeKind: EdgeKind,
  policy?: EdgePolicy,
): RelateEvent {
  const base: RelateEvent = {
    kind: 'relate',
    id: stamp.id,
    ts: stamp.ts,
    actor,
    op,
    from,
    to,
    edgeKind,
  };
  return policy === undefined ? base : { ...base, policy };
}

export function capacityEntry(
  stamp: Stamp,
  humanId: string,
  date: IsoDate,
  capacity: number,
  reason: string,
): CapacityEntry {
  return { humanId, date, capacity, reason, ts: stamp.ts };
}
