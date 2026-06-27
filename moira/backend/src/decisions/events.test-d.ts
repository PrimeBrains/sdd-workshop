// ============================================================================
// 計器②（型・スキーマ）サンプル — D-3「過去を書き換えない積み上げ式」のうち
// 「イベントは4種だけ（削除APIが無い）」を型レベルで固定する書き方の型。
//
// agreed な判断（D-3）にのみ書く。proposed（D-4〜）には本ステージでは書かない。
// 正（あるべき構造）＋負（禁じた構造を強制しない）の両方を示す。
//
// 実走の担保（偽 pass 防止 / testing-conventions「偽 pass を防ぐ」）:
//   (1) `vitest --typecheck.only`（npm run test:types）が *.test-d.ts を型検査
//   (2) `tsc`（npm run build）が src 全体を型検査（@ts-expect-error も対象）
// `vitest run` は型を検査しない（expectTypeOf は実行時 no-op）ため、この2系統で
// 実際に検査されることが必須。どちらも CI のステップに入っている。
// ============================================================================

import { describe, expectTypeOf, it } from 'vitest';
import type { Event } from '../types.js';

describe('D-3 型: イベントは4種だけ（削除APIが無い）', () => {
  it('正: 判別子 Event["kind"] はちょうど4種', () => {
    // The append-only log has exactly the four node-work events. No fifth kind,
    // and crucially NO delete/erase kind — past records are never rewritten.
    expectTypeOf<Event['kind']>().toEqualTypeOf<
      'transition' | 'decompose' | 'relate' | 'cost'
    >();
  });

  it('負: "delete" 等の削除イベント種別は存在しない（強制しない）', () => {
    // A delete API would let a record be erased — forbidden by append-only (D-3).
    // The assignment MUST be a type error; @ts-expect-error asserts that it is.
    // @ts-expect-error 'delete' is not a member of Event['kind'] — there is no delete API (D-3)
    const bad: Event['kind'] = 'delete';
    void bad;
  });

  it('負: relate の op は add/remove のみ（remove は辺の除去であって記録の削除ではない）', () => {
    // The only "remove" in the model removes a graph EDGE via a NEW appended
    // relate event; it does not delete the prior record. So a relate op outside
    // {add, remove} must not type-check.
    type RelateOp = Extract<Event, { kind: 'relate' }>['op'];
    expectTypeOf<RelateOp>().toEqualTypeOf<'add' | 'remove'>();
    // @ts-expect-error there is no 'delete' op on relate (edge removal is append-only, not record deletion)
    const badOp: RelateOp = 'delete';
    void badOp;
  });
});
