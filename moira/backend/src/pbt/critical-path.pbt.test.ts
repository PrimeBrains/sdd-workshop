// ============================================================================
// PR-CRITPATH-AGENT (R-T2·P7·P6) — PBT against the reference implementation.
// Oracle transcribed from moira/PROPERTIES.md (「人間がレビューする一文」, NOT
// reverse-engineered from the derivation code; property author ≠ implementation
// author):
//
//   「プロジェクトの着地予想（導出完了日）は、依存関係のうち最も長い経路＝
//    クリティカルパスで決まる。エージェント作業は容量平準化の対象外（人を増減
//    しても予定本数は削られない）だが、その所要時間は実際に経過する時間なので、
//    人間作業と同じく無条件にパス長へ算入される——後続が人間でも、後続が無い
//    末尾のエージェント作業でも、完了日を正しく後ろへ動かす」
//
//   固定する量: クリティカルパス＝依存辺のみの全依存連鎖の最長路（supersede 除外）
//              ・エージェントのリードタイムも後続種別を問わず無条件にパス長へ算入
//              ・対象は有効・割当済みの葉・容量平準化は人間のみ
//   意図的に FREE: 具体日数・どの経路が最長か
//
// Interpretation as falsifiable bounds (the FREE column keeps exact dates and
// path choice unpinned):
//   (1) the derived completion is bounded BELOW by the critical-path length —
//       the chain's tail can never complete before start + lengthDays - 1
//       (capacity can only delay, never compress past nominal durations);
//   (2) appending a TRAILING AGENT to the chain tail extends the path and moves
//       the derived completion by at least its lead time (unconditional
//       inclusion — no human successor required);
//   (3) the surfaced chain is a real dependency chain over the schedulable set
//       and its length is the sum of its nominal durations;
//   (4) physical event order never changes the result (I3 isomorphism).
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultCapacityLookup } from '../capacity-store.js';
import { addDays } from '../dates.js';
import { computeCriticalPath } from '../derivations/critical-path.js';
import { computeEffectiveSet } from '../derivations/effective-set.js';
import { fold } from '../fold.js';
import { level, nominalDurationDays, schedulableLeaves } from '../leveler.js';
import { agent, human, Log } from '../test-utils.js';
import type { Event, IsoDate, NodeId } from '../types.js';
import { permute } from './arbitraries.js';

const RUNS = 500;
const START: IsoDate = '2026-06-01';

// ---------------------------------------------------------------------------
// Generator: an acyclic dependency DAG of schedulable leaves (agreed, assigned,
// estimated — the scope the oracle fixes; scope EXCLUSIONS are unit-tested in
// derivations/critical-path.test.ts). Edges only run i → j with i < j, so
// acyclicity holds by construction (I2 keeps fold from ever seeing a cycle).
// ---------------------------------------------------------------------------
interface CpSpec {
  leaves: Array<{ est: number; kind: 'human' | 'agent' }>;
  edgePicks: boolean[];
}

const arbCpSpec: fc.Arbitrary<CpSpec> = fc.integer({ min: 2, max: 6 }).chain((n) =>
  fc.record({
    leaves: fc.array(
      fc.record({
        est: fc.constantFrom(0.5, 1, 2, 2.5, 3, 5),
        kind: fc.constantFrom<'human' | 'agent'>('human', 'human', 'agent'),
      }),
      { minLength: n, maxLength: n },
    ),
    edgePicks: fc.array(fc.boolean(), {
      minLength: (n * (n - 1)) / 2,
      maxLength: (n * (n - 1)) / 2,
    }),
  }),
);

const pairsOf = (n: number): Array<[number, number]> => {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) pairs.push([i, j]);
  return pairs;
};

function compile(spec: CpSpec): Event[] {
  const log = new Log().decompose(
    'F',
    spec.leaves.map((l, i) => ({ node: `L${i}`, estimate: l.est })),
  );
  spec.leaves.forEach((l, i) => {
    log.agree(`L${i}`, l.est);
    log.assign(`L${i}`, l.kind === 'human' ? human(`h${i % 2}`) : agent('bot'));
  });
  pairsOf(spec.leaves.length).forEach(([i, j], k) => {
    if (spec.edgePicks[k]) log.dep(`L${i}`, `L${j}`);
  });
  return log.all();
}

function predictAll(events: readonly Event[]): Map<NodeId, IsoDate | null> {
  const state = fold([...events]);
  const eff = computeEffectiveSet(state);
  return level(state, eff, defaultCapacityLookup, START).predicted;
}

// ---------------------------------------------------------------------------
// Self-coverage (到達 witness): the generator must actually reach the corners
// the oracle talks about, else green runs are vacuous.
// ---------------------------------------------------------------------------
describe('generator self-coverage (到達 witness)', () => {
  it('reaches agents on the surfaced path, fractional estimates, edged and edgeless DAGs', () => {
    const specs = fc.sample(arbCpSpec, { numRuns: 300, seed: 42 });
    const agg = { agentOnPath: false, fractionalEst: false, hasEdges: false, edgeless: false, multiNodePath: false };
    for (const s of specs) {
      const events = compile(s);
      const cp = computeCriticalPath(events);
      const state = fold(events);
      if (cp.path.some((id) => state.nodes.get(id)?.assignee?.kind === 'agent')) agg.agentOnPath = true;
      if (cp.path.some((id) => !Number.isInteger(state.nodes.get(id)?.latestEstimate ?? 0))) agg.fractionalEst = true;
      if (s.edgePicks.some(Boolean)) agg.hasEdges = true;
      else agg.edgeless = true;
      if (cp.path.length >= 2) agg.multiNodePath = true;
    }
    expect(agg).toEqual({
      agentOnPath: true,
      fractionalEst: true,
      hasEdges: true,
      edgeless: true,
      multiNodePath: true,
    });
  });
});

// ---------------------------------------------------------------------------
// (3) The surfaced chain is real: path ⊆ schedulable, consecutive nodes are
//     dependency edges, lengthDays = Σ nominal durations along the path.
// ---------------------------------------------------------------------------
describe('PR-CRITPATH-AGENT: the surfaced chain is a real dependency chain', () => {
  it('path is a schedulable dependency chain and lengthDays is its nominal sum', () => {
    fc.assert(
      fc.property(arbCpSpec, (spec) => {
        const events = compile(spec);
        const cp = computeCriticalPath(events);
        const state = fold(events);
        const eff = computeEffectiveSet(state);
        const sched = new Set(schedulableLeaves(state, eff));

        expect(cp.path.length).toBeGreaterThan(0); // everything here is schedulable
        for (const id of cp.path) expect(sched.has(id)).toBe(true);
        for (let k = 0; k + 1 < cp.path.length; k += 1) {
          const from = cp.path[k]!;
          const to = cp.path[k + 1]!;
          expect(state.dependencyEdges.some((e) => e.from === from && e.to === to)).toBe(true);
        }
        const sum = cp.path.reduce((acc, id) => acc + nominalDurationDays(state, id), 0);
        expect(cp.lengthDays).toBe(sum);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// (1) 着地予想はクリティカルパスで決まる（下限）: the chain tail never completes
//     before start + lengthDays - 1 — capacity only delays, never compresses.
// ---------------------------------------------------------------------------
describe('PR-CRITPATH-AGENT: the critical path lower-bounds the derived completion', () => {
  it('predicted(tail) ≥ start + lengthDays - 1', () => {
    fc.assert(
      fc.property(arbCpSpec, (spec) => {
        const events = compile(spec);
        const cp = computeCriticalPath(events);
        const predicted = predictAll(events);
        const tail = cp.path[cp.path.length - 1]!;
        const bound = addDays(START, cp.lengthDays - 1);
        const actual = predicted.get(tail);
        expect(actual).not.toBeNull();
        expect(actual! >= bound).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// (2) 末尾エージェントの無条件算入: appending a trailing agent to the chain tail
//     (no successor of its own) extends the path by its lead time and moves the
//     derived completion accordingly — a human successor is NOT a precondition.
// ---------------------------------------------------------------------------
describe('PR-CRITPATH-AGENT: a trailing agent extends the path unconditionally', () => {
  it('path gains the agent, lengthDays grows by ceil(est), completion moves past the new bound', () => {
    fc.assert(
      fc.property(arbCpSpec, fc.constantFrom(1, 2, 3), (spec, agentEst) => {
        const base = compile(spec);
        const before = computeCriticalPath(base);
        const tail = before.path[before.path.length - 1]!;

        const extended = new Log()
          .decompose('F', [{ node: 'zz-tail', estimate: agentEst }])
          .agree('zz-tail', agentEst)
          .assign('zz-tail', agent('bot'))
          .dep(tail, 'zz-tail');
        // Re-stamp the extension events after the base log (unique ids/ts).
        const maxTs = base.reduce((m, e) => Math.max(m, e.ts), 0);
        const extEvents = extended.all().map((e, k) => ({ ...e, id: `x${k}`, ts: maxTs + k + 1 }));
        const events = [...base, ...extEvents];

        const after = computeCriticalPath(events);
        expect(after.path[after.path.length - 1]).toBe('zz-tail');
        expect(after.lengthDays).toBe(before.lengthDays + Math.ceil(agentEst));

        const predicted = predictAll(events);
        const bound = addDays(START, after.lengthDays - 1);
        expect(predicted.get('zz-tail')! >= bound).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// (4) I3 isomorphism: physical event order never changes the surfaced chain.
// ---------------------------------------------------------------------------
describe('PR-CRITPATH-AGENT: order-invariant (I3)', () => {
  it('a permuted log derives the identical critical path', () => {
    fc.assert(
      fc.property(arbCpSpec, fc.nat(), (spec, seed) => {
        const events = compile(spec);
        const reference = computeCriticalPath(events);
        expect(computeCriticalPath(permute(events, seed))).toEqual(reference);
      }),
      { numRuns: RUNS },
    );
  });
});
