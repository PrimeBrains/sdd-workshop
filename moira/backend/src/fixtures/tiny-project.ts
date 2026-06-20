// Golden worked example — a tiny project exercising the full S4 derivation path.
//
// One feature F with the three spec-phase nodes (req/design/tasks) plus two
// implementation nodes, all agreed, assigned, scheduled, costed and (mostly)
// completed. Every expected number below is hand-computed and locked by
// golden.test.ts. Citations use `MODEL:NNN`.
//
// Shape (§2.6 MODEL:116 — phases and impl tasks are siblings, children of F):
//   F ─┬ req-F (4 MD)  ─dep→ design-F
//      ├ design-F (6)  ─dep→ tasks-F, impl-1, impl-2
//      ├ tasks-F (2)
//      ├ impl-1 (8)
//      └ impl-2 (6)
//
// Completion: req/design/tasks → accepted, impl-1 → implemented, impl-2 stays
// `ready` (not completed). Costs: req 4, design 7, tasks 2, impl-1 12, impl-2 0.
//
// Hand-computed at asOf = 2026-01-28 (startDate auto = earliest slot 2026-01-05):
//   EV_abs   = 4+6+2+8        = 20   (impl-2 not completed)
//   EV%      = 20 / 26        ≈ 0.7692   (denom = 4+6+2+8+6 latest of agreed leaves)
//   est cov  = 5 / 6          ≈ 0.8333   (F is an I1 rollup, not independently agreed)
//   sched cov= 5 / 5          = 1.0
//   PV(0128) = 4+6+2+8        = 20   (impl-2 slot 2026-01-31 > 0128 excluded)
//   AC       = 4+7+2+12+0     = 25
//   SPI      = 20 / 20        = 1.00 (raw)
//   CPI      = 20 / 25        = 0.80
//   review queue = [impl-1] ; agent queue = [] ; unassigned = []
//   forecast (live, c=1.0): req-F 0108, design-F 0114, tasks-F 0116,
//                           impl-1 0122, impl-2 0128  (differs from frozen slots
//                           — the PMB-vs-EAC separation, MODEL:203)

import type { Actor, Event } from '../types.js';

const ai: Actor = { kind: 'agent', id: 'ai' };
const alice: Actor = { kind: 'human', id: 'alice' };
const bob: Actor = { kind: 'human', id: 'bob' };

export const TINY_AS_OF = '2026-01-28';

const events: Event[] = [];
let seq = 0;

function stamp(): { id: string; ts: number } {
  seq += 1;
  return { id: `e${String(seq).padStart(3, '0')}`, ts: seq };
}

function decompose(
  parent: string,
  children: Array<{ node: string; estimate: number }>,
  reason: string,
): void {
  events.push({ kind: 'decompose', ...stamp(), actor: ai, parent, reason, children });
}

function agree(node: string, frozenBudget: number): void {
  events.push({
    kind: 'transition',
    ...stamp(),
    actor: alice, // a human agrees (R-U4 MODEL:221)
    node,
    machine: 'estimate-agreement',
    to: 'agreed',
    frozenBudget,
  });
}

function dependency(from: string, to: string, policy: 'accepted' | 'implemented'): void {
  events.push({
    kind: 'relate',
    ...stamp(),
    actor: ai,
    op: 'add',
    from,
    to,
    edgeKind: 'dependency',
    policy,
  });
}

function schedule(node: string, assignee: Actor, frozenSlot: string): void {
  events.push({
    kind: 'transition',
    ...stamp(),
    actor: assignee,
    node,
    machine: 'lifecycle',
    to: 'ready',
    assignee,
    frozenSlot,
  });
}

function life(node: string, to: 'implemented' | 'accepted', actor: Actor): void {
  events.push({ kind: 'transition', ...stamp(), actor, node, machine: 'lifecycle', to });
}

function cost(node: string, amount: number, actor: Actor): void {
  events.push({ kind: 'cost', ...stamp(), actor, node, amount });
}

// 1. Decompose F into its five children (born proposed, AI-proposed estimates).
decompose(
  'F',
  [
    { node: 'req-F', estimate: 4 },
    { node: 'design-F', estimate: 6 },
    { node: 'tasks-F', estimate: 2 },
    { node: 'impl-1', estimate: 8 },
    { node: 'impl-2', estimate: 6 },
  ],
  'initial decomposition',
);

// 2. Human agreement freezes each leaf's baseline budget (§3① MODEL:194).
agree('req-F', 4);
agree('design-F', 6);
agree('tasks-F', 2);
agree('impl-1', 8);
agree('impl-2', 6);

// 3. Dependency edges (spec-phase = accepted, impl = implemented; R-D2 MODEL:334).
dependency('req-F', 'design-F', 'accepted');
dependency('design-F', 'tasks-F', 'accepted');
dependency('design-F', 'impl-1', 'implemented');
dependency('design-F', 'impl-2', 'implemented');

// 4. Assignment + first-scheduling slot freeze (§3② MODEL:194).
schedule('req-F', alice, '2026-01-05');
schedule('design-F', alice, '2026-01-13');
schedule('tasks-F', alice, '2026-01-15');
schedule('impl-1', bob, '2026-01-27');
schedule('impl-2', bob, '2026-01-31');

// 5. Completions (impl-2 deliberately left at `ready`).
life('req-F', 'implemented', alice);
life('req-F', 'accepted', alice);
life('design-F', 'implemented', alice);
life('design-F', 'accepted', alice);
life('tasks-F', 'implemented', alice);
life('tasks-F', 'accepted', alice);
life('impl-1', 'implemented', bob);

// 6. Actual cost (attention-time MD; impl-1 overruns its 8 MD budget).
cost('req-F', 4, alice);
cost('design-F', 7, alice);
cost('tasks-F', 2, alice);
cost('impl-1', 12, bob);

export const tinyProjectEvents: readonly Event[] = events;
