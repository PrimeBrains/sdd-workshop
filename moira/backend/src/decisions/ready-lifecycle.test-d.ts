// ============================================================================
// 計器②（型・スキーマ）サンプル — D-2「『もう着手してよい』を土台が判断するか・
// 別係に渡すか」のうち「ready は lifecycle 状態として保持」を型レベルで固定する
// 書き方の型。
//
// D-2 の決めたこと: (1)「着手したという記録」= ready は土台(core)が lifecycle 状態
// として保持する。(2)「着手してよいはずという資格」(ready-eligible) の計算は土台で
// は行わず別係に委ねる。よって core の射影 ProjectedNode に ready-eligibility の
// 算出フィールドが乗っていないこと（負の照合）が型で確かめられる。
//
// 計器① fitness（.dependency-cruiser.cjs の fold-no-downstream）が (2) の依存方向を
// 弱く代理し、本ファイルが (1) の構造と (2) の「算出フィールド不在」を型で示す。
//
// 実走の担保は events.test-d.ts のヘッダ参照（test:types + tsc の2系統）。
// ============================================================================

import { describe, expectTypeOf, it } from 'vitest';
import type { LifecycleState, ProjectedNode } from '../types.js';

describe('D-2 型: ready は lifecycle 状態として保持（資格計算は土台が持たない）', () => {
  it('正: "ready" は lifecycle 状態の一員', () => {
    expectTypeOf<'ready'>().toMatchTypeOf<LifecycleState>();
    // 記録上の状態として ProjectedNode.lifecycle に乗る（土台が保持する）。
    expectTypeOf<ProjectedNode['lifecycle']>().toEqualTypeOf<LifecycleState>();
  });

  it('負: ProjectedNode に ready-eligible 系の算出フィールドが無い（土台が資格評価しない）', () => {
    // 「着手してよいはず」の資格評価は別係(scope-deps)の仕事。core の射影に
    // readyEligible / eligible のような派生フラグが在ってはならない。
    expectTypeOf<ProjectedNode>().not.toHaveProperty('readyEligible');
    expectTypeOf<ProjectedNode>().not.toHaveProperty('eligible');
    expectTypeOf<ProjectedNode>().not.toHaveProperty('isReady');

    // 参照そのものも型エラーであること（@ts-expect-error が無ければビルドが赤＝
    // 「Unused directive」で偽 pass を検知できる）。
    // @ts-expect-error ProjectedNode has no `readyEligible` — ready is a recorded state, not a derived eligibility flag (D-2)
    type _Probe = ProjectedNode['readyEligible'];
  });
});
