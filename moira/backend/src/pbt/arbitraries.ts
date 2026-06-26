// ============================================================================
// PBT generators — FIRST-CLASS REVIEW TARGET (moira-verification.md「生成器」節).
//
// Two generators, per the minimal pilot:
//   1. arbProjectSpec → compileLog()  — the append-only event-log generator.
//   2. arbCapacityEntries → buildCapacityLookup() — the c(i,d) generator.
//
// These are adversarial constructs. They emit WELL-FORMED logs (satisfying the
// shaping rules: I2 acyclic, R-U4 human agreement, R-D7 supersede new→old) BUT
// deliberately reach the hard corners — completion-without-agreement (R-U8),
// agent-agreement rejection (R-U4), agreed→proposed revert on INCOMPLETE nodes
// (R-E3), supersede over a live node, and unestimated-leaf birth (§2.3). The
// `witnessCorners()` helper lets a test assert each corner is actually reached
// (到達 witness) — corners never generated are untested invariants.
//
// NOTE the deliberate scoping: the agreed→proposed revert here is INCOMPLETE-only
// (R-E3). The completed-node revert that violates I4 / PR-DONE-LOCK is NOT a
// well-formed log; it lives in its own targeted generator (see done-lock test).
//
// Oracles live in the *.pbt.test.ts files and are written from PROPERTIES.md's
// plain sentences — NOT from the implementation (moira-verification.md: property
// author ≠ implementation author; this breaks correlated error).
// ============================================================================

import fc from 'fast-check';
import { agent, human } from '../test-utils.js';
import type {
  CapacityEntry,
  CapacityLookup,
  Event,
  IsoDate,
  LifecycleState,
} from '../types.js';

// ----------------------------------------------------------------------------
// Structured spec (what fast-check shrinks) → compiled to an Event[] log.
// ----------------------------------------------------------------------------

export type AgreeMode = 'none' | 'human' | 'agent';

export interface LeafSpec {
  /** undefined ⇒ unestimated leaf — the §2.3 discovery signal (coverage drop). */
  estimate: number | undefined;
  /** 'agent' ⇒ an R-U4 violation witness (fold rejects it, stays proposed). */
  agree: AgreeMode;
  /** Final lifecycle state for this leaf. */
  lifecycle: LifecycleState;
  /** >0 ⇒ a direct cost record on this leaf. */
  cost: number;
  /** Freeze a baseline slot (first-scheduling). */
  scheduled: boolean;
  /** After a successful (human) agree, revert estimate to proposed (R-E3). */
  revertAfterAgree: boolean;
  /** A live NEW node supersedes this leaf (R-D7 new→old). */
  supersededByNew: boolean;
}

export interface ProjectSpec {
  leaves: LeafSpec[];
}

const DATES: IsoDate[] = ['2026-01-05', '2026-01-12', '2026-02-02', '2026-03-09'];
const COMPLETED: ReadonlySet<LifecycleState> = new Set<LifecycleState>([
  'implemented',
  'accepted',
]);

const arbLifecycle: fc.Arbitrary<LifecycleState> = fc.constantFrom(
  'pending',
  'ready',
  'implementing',
  'implemented',
  'accepted',
  'cancelled',
);

const arbLeaf: fc.Arbitrary<LeafSpec> = fc.record({
  estimate: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
  agree: fc.constantFrom<AgreeMode>('none', 'human', 'agent'),
  lifecycle: arbLifecycle,
  cost: fc.integer({ min: 0, max: 15 }),
  scheduled: fc.boolean(),
  revertAfterAgree: fc.boolean(),
  supersededByNew: fc.boolean(),
});

export const arbProjectSpec: fc.Arbitrary<ProjectSpec> = fc.record({
  leaves: fc.array(arbLeaf, { minLength: 1, maxLength: 5 }),
});

// ----------------------------------------------------------------------------
// Compiler: ProjectSpec → well-formed Event[]. Deterministic (ts, id) stamping;
// no Math.random / Date.now (forbidden — would break replay determinism).
// ----------------------------------------------------------------------------

const ROOT = 'F';
const leafId = (i: number): string => `L${i}`;
const newId = (i: number): string => `L${i}_new`;

export interface CompileOptions {
  /**
   * If ≥2 (and ≤ leaf count), wrap the first N leaves under an intermediate node
   * 'G' (F→[G,…rest]; G→[…first N]) instead of decomposing them directly under
   * the root. The leaf SET is unchanged — only the tree shape differs. Used by
   * PR-I1-ROLLUP's regrouping-invariance check (intermediate nodes don't count;
   * value rolls up from leaves).
   */
  groupFirst?: number;
}

export function compileLog(spec: ProjectSpec, opts: CompileOptions = {}): Event[] {
  const events: Event[] = [];
  let seq = 0;
  const next = (): { id: string; ts: number } => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: seq };
  };

  const child = (leaf: LeafSpec, i: number): { node: string; estimate?: number } => ({
    node: leafId(i),
    ...(leaf.estimate !== undefined ? { estimate: leaf.estimate } : {}),
  });

  // 1. Decompose the root into all leaves — flat, or with the first N grouped
  //    under an intermediate node 'G' (same leaf set, different shape).
  const g = opts.groupFirst ?? 0;
  if (g >= 2 && g <= spec.leaves.length) {
    const ungrouped = spec.leaves.slice(g).map((leaf, j) => child(leaf, g + j));
    events.push({ kind: 'decompose', ...next(), actor: agent('ai'), parent: ROOT, reason: 'init', children: [{ node: 'G' }, ...ungrouped] });
    const grouped = spec.leaves.slice(0, g).map((leaf, j) => child(leaf, j));
    events.push({ kind: 'decompose', ...next(), actor: agent('ai'), parent: 'G', reason: 'group', children: grouped });
  } else {
    const children = spec.leaves.map((leaf, i) => child(leaf, i));
    events.push({ kind: 'decompose', ...next(), actor: agent('ai'), parent: ROOT, reason: 'init', children });
  }

  // 2. Per-leaf events, in a fixed emission order. (fold re-sorts by (ts,id);
  //    physical order here is irrelevant to derivation — exploited by PM-ORDER-INV.)
  spec.leaves.forEach((leaf, i) => {
    const id = leafId(i);
    const completed = COMPLETED.has(leaf.lifecycle);

    if (leaf.scheduled) {
      events.push({
        kind: 'transition', ...next(), actor: human('h1'), node: id,
        machine: 'lifecycle', to: 'ready', assignee: human('h1'),
        frozenSlot: DATES[i % DATES.length] as IsoDate,
      });
    }

    if (leaf.agree !== 'none' && leaf.estimate !== undefined) {
      // 'agent' is the R-U4 violation witness — fold rejects it, node stays proposed.
      const actor = leaf.agree === 'human' ? human('h1') : agent('ai');
      events.push({
        kind: 'transition', ...next(), actor, node: id,
        machine: 'estimate-agreement', to: 'agreed', frozenBudget: leaf.estimate,
      });
      // R-E3 revert is INCOMPLETE-only here (keeps the log well-formed).
      if (leaf.revertAfterAgree && leaf.agree === 'human' && !completed) {
        events.push({
          kind: 'transition', ...next(), actor: human('h1'), node: id,
          machine: 'estimate-agreement', to: 'proposed', reason: 're-estimate',
        });
      }
    }

    // Drive the lifecycle to its target (pending is the fold default, skip).
    if (leaf.lifecycle !== 'pending') {
      events.push({
        kind: 'transition', ...next(), actor: human('h1'), node: id,
        machine: 'lifecycle', to: leaf.lifecycle,
      });
    }

    if (leaf.cost > 0) {
      events.push({ kind: 'cost', ...next(), actor: human('h1'), node: id, amount: leaf.cost });
    }

    if (leaf.supersededByNew) {
      // Make the NEW node real (decomposed under root) so it is a live effective
      // leaf, then add the supersede edge new→old (R-D7).
      const nid = newId(i);
      events.push({ kind: 'decompose', ...next(), actor: agent('ai'), parent: ROOT, reason: 'supersede', children: [{ node: nid, estimate: leaf.estimate ?? 1 }] });
      events.push({ kind: 'relate', ...next(), actor: agent('ai'), op: 'add', from: nid, to: id, edgeKind: 'supersede' });
    }
  });

  return events;
}

// ----------------------------------------------------------------------------
// Capacity generator — the second tier c(i,d) (A4/R-U14). A separate
// append-only, reason-stamped input, NOT one of the four events.
// ----------------------------------------------------------------------------

const arbCapacityEntry: fc.Arbitrary<CapacityEntry> = fc
  .record({
    humanId: fc.constantFrom('h1', 'h2'),
    date: fc.constantFrom(...DATES),
    capacity: fc.constantFrom(0, 0.25, 0.5, 0.75, 1.0), // c ∈ [0,1.0] (A4)
    reason: fc.constantFrom('holiday', 'leave', 'temporary-reduction', 'contract'),
  })
  .map((r) => ({ ...r, ts: 0 }));

export const arbCapacityEntries: fc.Arbitrary<CapacityEntry[]> = fc
  .array(arbCapacityEntry, { minLength: 0, maxLength: 4 })
  .map((entries) => entries.map((e, i) => ({ ...e, ts: i + 1 }))); // unique append-order ts

/** Build a c(i,d) lookup with latest-ts-wins per (human,date); default 1.0 (A4). */
export function buildCapacityLookup(entries: readonly CapacityEntry[]): CapacityLookup {
  const latest = new Map<string, CapacityEntry>();
  for (const e of entries) {
    const key = `${e.humanId}@${e.date}`;
    const prev = latest.get(key);
    if (prev === undefined || e.ts >= prev.ts) latest.set(key, e);
  }
  return (humanId: string, date: IsoDate): number => latest.get(`${humanId}@${date}`)?.capacity ?? 1.0;
}

// ----------------------------------------------------------------------------
// Deterministic permutation — for PM-ORDER-INV physical-order shuffling without
// Math.random. Stable sort of (event, originalIndex) by an LCG-derived key.
// ----------------------------------------------------------------------------

export function permute<T>(items: readonly T[], seed: number): T[] {
  // Assign each item a pseudo-random key from an LCG seeded by (seed, index).
  const keyed = items.map((item, i) => {
    let x = (seed ^ ((i + 1) * 2654435761)) >>> 0;
    x = (1103515245 * x + 12345) >>> 0; // glibc LCG step
    return { item, key: x, i };
  });
  keyed.sort((a, b) => (a.key - b.key) || (a.i - b.i));
  return keyed.map((k) => k.item);
}

// ----------------------------------------------------------------------------
// Self-coverage (到達 witness): classify which adversarial corners a spec hits.
// A test asserts every corner appears ≥1 across a sample — corners never
// generated are untested invariants (moira-verification.md「自己被覆」).
// ----------------------------------------------------------------------------

export interface CornerHits {
  unestimatedLeaf: boolean;        // §2.3 discovery
  completionWithoutAgreement: boolean; // R-U8 (completed but not human-agreed)
  agentAgreeRejected: boolean;     // R-U4 violation reached
  agreedThenReverted: boolean;     // R-E3 revert (incomplete)
  supersede: boolean;              // R-D7 live supersede
  cancelled: boolean;              // R-C2 cancel
}

export function cornersOf(spec: ProjectSpec): CornerHits {
  const hits: CornerHits = {
    unestimatedLeaf: false,
    completionWithoutAgreement: false,
    agentAgreeRejected: false,
    agreedThenReverted: false,
    supersede: false,
    cancelled: false,
  };
  for (const leaf of spec.leaves) {
    const completed = COMPLETED.has(leaf.lifecycle);
    const humanAgreed = leaf.agree === 'human' && leaf.estimate !== undefined;
    if (leaf.estimate === undefined) hits.unestimatedLeaf = true;
    if (completed && !humanAgreed) hits.completionWithoutAgreement = true;
    if (leaf.agree === 'agent' && leaf.estimate !== undefined) hits.agentAgreeRejected = true;
    if (leaf.revertAfterAgree && humanAgreed && !completed) hits.agreedThenReverted = true;
    if (leaf.supersededByNew) hits.supersede = true;
    if (leaf.lifecycle === 'cancelled') hits.cancelled = true;
  }
  return hits;
}
