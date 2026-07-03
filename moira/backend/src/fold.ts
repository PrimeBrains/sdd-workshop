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

/**
 * Would setting `child`'s effective parent to `parent` create a containment
 * cycle? True iff `parent` is `child` itself or currently sits in `child`'s
 * subtree — i.e. walking parent pointers up from `parent` reaches `child`.
 * (§2.8 v20 tree-ness guard; the containment counterpart of I2.)
 */
function wouldContainmentCycle(state: ProjectedState, parent: NodeId, child: NodeId): boolean {
  let cur: NodeId | null = parent;
  const seen = new Set<NodeId>(); // safety bound against pre-existing corruption
  while (cur !== null && !seen.has(cur)) {
    if (cur === child) return true;
    seen.add(cur);
    cur = state.nodes.get(cur)?.parent ?? null;
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
        for (const child of ev.children) {
          // Tree-ness guard (§2.8 v20 / A3): naming a child's own descendant
          // (or itself) as the new parent would create a containment cycle —
          // single-effective-parent alone guarantees single parents, not a
          // tree. Rejected visibly, same shape as the I2 relate rejection.
          if (wouldContainmentCycle(state, ev.parent, child.node)) {
            state.structuralErrors.push(
              `A3/§2.8: containment cycle — decompose '${ev.parent}' → '${child.node}' would make the child its own ancestor — rejected`,
            );
            continue;
          }
          const cn = ensure(child.node);
          // Containment is latest-wins (§2.8, v20): a re-decompose REPLACES the
          // effective parent — never adds a coexisting edge. childrenOf is kept
          // as the exact inverse image of the parent pointers (the tree, A3), so
          // the child leaves its previous parent's list here. This also heals
          // multi-parent states in pre-v20 logs retroactively (issue #5).
          if (cn.parent !== null && cn.parent !== ev.parent) {
            const prev = state.childrenOf.get(cn.parent);
            if (prev !== undefined) {
              const idx = prev.indexOf(child.node);
              if (idx >= 0) prev.splice(idx, 1);
              if (prev.length === 0) state.childrenOf.delete(cn.parent);
            }
          }
          cn.parent = ev.parent;
          const kids = state.childrenOf.get(ev.parent) ?? [];
          // A child born without an estimate stays null until est(impl) agrees —
          // surfaced as a coverage drop (§2.3 MODEL:96).
          if (child.estimate !== undefined) cn.latestEstimate = child.estimate;
          if (!kids.includes(child.node)) kids.push(child.node);
          state.childrenOf.set(ev.parent, kids);
        }
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
            // I4/R-E3 (D-1 done-lock): a completed node's agreed estimate is
            // locked — re-estimation applies to incomplete nodes only; a
            // post-completion change of understanding is a supersede (§2.7).
            // The event stays in the log (append-only); the fold refuses to
            // apply it — same shape as the R-U4/I2 rejections.
            const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';
            if (completed && n.estimateState === 'agreed') {
              state.structuralErrors.push(
                `I4/R-E3: re-estimation (agreed→proposed) on completed node '${ev.node}' — rejected (D-1 done-lock)`,
              );
              break;
            }
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
        // Amounts are non-negative (§2.8 v20 / A6: negative spent attention-time
        // does not exist; there deliberately is NO correction event — §7#19).
        if (ev.amount < 0) {
          state.structuralErrors.push(
            `A6/§2.8: negative cost ${ev.amount} on '${ev.node}' — rejected (amounts are non-negative; no correction event exists)`,
          );
          break;
        }
        state.seenCostIds.add(ev.id);
        ensure(ev.node).ownCost += ev.amount;
        break;
      }
    }
  }

  return state;
}
