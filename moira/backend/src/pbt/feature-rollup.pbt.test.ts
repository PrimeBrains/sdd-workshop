// ============================================================================
// Feature-rollup partition law (TE03 tree/value axis, issue #25) — PBT.
// Oracle written from the plain sentences, NOT from the derivation code
// (property author ≠ implementation author):
//
//   「feature 別の EV は、有効葉を root 直下の祖先ごとに『分割』した上で
//    エンジンの EV をそのまま読む。分割は全有効葉をちょうど一度ずつ覆う——
//    ゆえに feature 別 EV の総和は全体 EV_abs に一致し、葉数の総和は有効葉数に
//    一致する。物理的なイベント順は結果を変えない(I3)。中間ノードでの再グルーピングは
//    帰属先を変えても総和を変えない(価値は葉から立ち上がる)」
//
//   固定する量: Σ rows.evAbs == computeEvAbs 全体 ・ Σ rows.leafCount == |有効葉|
//              ・順序透過性 ・ 再グルーピング下の総和保存
//   意図的に FREE: どの葉がどの feature に帰属するか(木の形が決める)
// ============================================================================

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeEffectiveSet } from '../derivations/effective-set.js';
import { computeEvAbs } from '../derivations/ev.js';
import { computeFeatureRollup } from '../derivations/feature-rollup.js';
import { fold } from '../fold.js';
import { arbProjectSpec, compileLog, permute } from './arbitraries.js';

const RUNS = 500;
const ROOT = 'F'; // compileLog's root

describe('PR-FEATURE-PARTITION — feature rollup is a partition of the effective leaves', () => {
  it('Σ evAbs equals the global engine EV_abs and Σ leafCount covers every effective leaf', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        const events = compileLog(spec);
        const state = fold(events);
        const eff = computeEffectiveSet(state);
        const rows = computeFeatureRollup(events, ROOT);

        const sumEv = rows.reduce((s, r) => s + r.evAbs, 0);
        expect(sumEv).toBeCloseTo(computeEvAbs(state, eff), 9);

        const sumLeaves = rows.reduce((s, r) => s + r.leafCount, 0);
        const nonRootLeaves = eff.effectiveLeaves.filter((id) => id !== ROOT);
        expect(sumLeaves).toBe(nonRootLeaves.length);
      }),
      { numRuns: RUNS },
    );
  });

  it('physical event order never changes the rollup (I3 isomorphism)', () => {
    fc.assert(
      fc.property(arbProjectSpec, fc.integer(), (spec, seed) => {
        const events = compileLog(spec);
        expect(computeFeatureRollup(permute(events, seed), ROOT)).toEqual(
          computeFeatureRollup(events, ROOT),
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('regrouping under an intermediate node moves attribution but preserves the sums', () => {
    fc.assert(
      fc.property(arbProjectSpec, (spec) => {
        fc.pre(spec.leaves.length >= 2);
        const flat = computeFeatureRollup(compileLog(spec), ROOT);
        const grouped = computeFeatureRollup(compileLog(spec, { groupFirst: 2 }), ROOT);
        const sum = (rows: typeof flat): number => rows.reduce((s, r) => s + r.evAbs, 0);
        expect(sum(grouped)).toBeCloseTo(sum(flat), 9);
        const count = (rows: typeof flat): number => rows.reduce((s, r) => s + r.leafCount, 0);
        // groupFirst adds node 'G'; if all first-2 leaves stay effective the leaf
        // set is unchanged; if they all left the basis, G itself becomes a leaf.
        // Either way the PARTITION law (each effective leaf counted once) holds:
        const eff = computeEffectiveSet(fold(compileLog(spec, { groupFirst: 2 })));
        expect(count(grouped)).toBe(eff.effectiveLeaves.filter((id) => id !== ROOT).length);
      }),
      { numRuns: RUNS },
    );
  });
});
