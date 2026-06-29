import { type SpecMeta } from '../spec-meta';

// units/estimate-spec-proposed — §6 has 5 EARS clauses. Estimates proposed (not
// agreed): spec-value shows the value with the 未承認 mark (proposed*), P2 stays 0%,
// and the activity surface logs 「見積案を提示」.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/estimate-spec-proposed',
  surfaces: ['spec-value', 'activity'],
  clauses: [
    { ears: 1, mode: 'green' }, // 見積案を「未承認の提案」として提示（値が出る・proposed*）
    { ears: 2, mode: 'green' }, // spec-value に「未承認」の印（estimate-badge = proposed*）
    { ears: 3, mode: 'green' }, // 記録に1件追記＋履歴画面に1行（activity「見積案を提示」）
    {
      ears: 4,
      mode: 'deferred',
      note: 'WHILE 未承認の間 見積値を固定しないこと（frozenBudget=null のまま）は内部状態で、画面の直接観測対象でない。P2 0%（未 agreed）として間接的に現れる。',
    },
    {
      ears: 5,
      mode: 'deferred',
      note: 'この段階で実装ノードは未存在ゆえ「実装の見積状態を変更しない」は観測不能（負の事象）。',
    },
  ],
};
