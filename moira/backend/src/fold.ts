// The fold (replay) engine: an append-only event log → ProjectedState.
//
// MVP strategy: recompute-from-scratch on every call (MODEL:187 justifies
// non-optimal *scheduling*, not incremental fold; at S4 scale a full replay is
// correct-by-construction). The reduction is deterministic by (ts, id) (I3
// MODEL:146) and never mutates its input.

import { sortEvents } from './event-store.js';
import type {
  Event,
  LifecycleState,
  NodeId,
  ProjectedNode,
  ProjectedState,
} from './types.js';

function emptyNode(id: NodeId): ProjectedNode {
  return {
    id,
    lifecycle: 'pending',
    reachedImplemented: false,
    estimateState: 'proposed',
    latestEstimate: null,
    frozenBudget: null,
    frozenSlot: null,
    assignee: null,
    reviewer: null,
    ownCost: 0,
    parent: null,
    agreedActorValues: new Map(),
  };
}

/**
 * Would adding edge `from → to` create a cycle in the combined graph?
 * I2/R-D3 (MODEL:145, MODEL:337) reject cycles across ALL edge kinds, so we
 * walk both dependency and supersede edges. A cycle appears iff `from` is
 * already reachable from `to`.
 */
function wouldCycle(state: ProjectedState, from: NodeId, to: NodeId): boolean {
  if (from === to) return true;
  const adj = new Map<NodeId, NodeId[]>();
  const add = (a: NodeId, b: NodeId): void => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const e of state.dependencyEdges) add(e.from, e.to);
  for (const e of state.supersedeEdges) add(e.from, e.to);

  const stack: NodeId[] = [to];
  const seen = new Set<NodeId>();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined) break;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

export function fold(events: readonly Event[]): ProjectedState {
  const state: ProjectedState = {
    nodes: new Map(),
    childrenOf: new Map(),
    dependencyEdges: [],
    supersedeEdges: [],
    seenCostIds: new Set(),
    structuralErrors: [],
    appliedAt: 0,
  };

  const ensure = (id: NodeId): ProjectedNode => {
    let node = state.nodes.get(id);
    if (node === undefined) {
      node = emptyNode(id);
      state.nodes.set(id, node);
    }
    return node;
  };

  for (const ev of sortEvents(events)) {
    state.appliedAt = ev.ts;
    switch (ev.kind) {
      case 'decompose': {
        ensure(ev.parent);
        const kids = state.childrenOf.get(ev.parent) ?? [];
        for (const child of ev.children) {
          const cn = ensure(child.node);
          cn.parent = ev.parent;
          // A child born without an estimate stays null until est(impl) agrees —
          // surfaced as a coverage drop (§2.3 MODEL:96).
          if (child.estimate !== undefined) cn.latestEstimate = child.estimate;
          if (!kids.includes(child.node)) kids.push(child.node);
        }
        state.childrenOf.set(ev.parent, kids);
        break;
      }

      case 'transition': {
        const n = ensure(ev.node);
        if (ev.machine === 'lifecycle') {
          n.lifecycle = ev.to as LifecycleState;
          if (ev.to === 'implemented') n.reachedImplemented = true;
          // Assignee: latest-wins (§2.4 MODEL:102).
          if (ev.assignee !== undefined) n.assignee = ev.assignee;
          // Reviewer: latest-wins attendant attr (§2.4/R-T5, v19) — distinct from
          // assignee, not consumed by leveling/EV/PV/coverage. Human-only is a
          // MODEL/write-layer constraint (not re-checked here, mirroring assignee).
          if (ev.reviewer !== undefined) n.reviewer = ev.reviewer;
          // First-scheduling slot freeze: only the FIRST scheduling freezes the
          // baseline slot (§3② MODEL:194-195); later changes are a reason-stamped
          // re-baseline, which the engine treats as the immutable first value.
          if (ev.frozenSlot !== undefined && n.frozenSlot === null) {
            n.frozenSlot = ev.frozenSlot;
          }
        } else {
          // estimate-agreement machine
          if (ev.to === 'agreed') {
            // Only a human may agree (R-U4 MODEL:221 / I6 MODEL:149).
            if (ev.actor.kind !== 'human') {
              state.structuralErrors.push(
                `R-U4: non-human actor '${ev.actor.id}' attempted to agree node '${ev.node}' — rejected`,
              );
              break;
            }
            n.estimateState = 'agreed';
            // Budget frozen at agreement: event attribute, else current latest
            // (§3① MODEL:194). I4 retroactive lock (MODEL:147) is automatic
            // because EV_abs reads frozenBudget after the full ordered fold.
            const budget = ev.frozenBudget ?? n.latestEstimate;
            if (budget !== null) {
              n.frozenBudget = budget;
              n.agreedActorValues.set(ev.actor.id, budget);
            }
          } else {
            // Re-estimation returns to proposed until re-agreed (R-E3 MODEL:272).
            n.estimateState = 'proposed';
          }
        }
        break;
      }

      case 'relate': {
        if (ev.op === 'add') {
          if (wouldCycle(state, ev.from, ev.to)) {
            state.structuralErrors.push(
              `I2/R-D3: cyclic ${ev.edgeKind} edge '${ev.from}'→'${ev.to}' — rejected`,
            );
            break;
          }
          if (ev.edgeKind === 'supersede') {
            state.supersedeEdges.push({ from: ev.from, to: ev.to });
          } else {
            // Default policy by edge type when unspecified (R-D2 MODEL:334). The
            // minimal slice cannot infer spec-vs-impl from ids, so it defaults to
            // `implemented`; fixtures set `accepted` explicitly on spec-phase edges.
            state.dependencyEdges.push({
              from: ev.from,
              to: ev.to,
              policy: ev.policy ?? 'implemented',
            });
          }
        } else {
          if (ev.edgeKind === 'supersede') {
            state.supersedeEdges = state.supersedeEdges.filter(
              (e) => !(e.from === ev.from && e.to === ev.to),
            );
          } else {
            state.dependencyEdges = state.dependencyEdges.filter(
              (e) => !(e.from === ev.from && e.to === ev.to),
            );
          }
        }
        break;
      }

      case 'cost': {
        // Accumulative, deduped by id (§2.8 MODEL:141).
        if (state.seenCostIds.has(ev.id)) break;
        state.seenCostIds.add(ev.id);
        ensure(ev.node).ownCost += ev.amount;
        break;
      }
    }
  }

  return state;
}
