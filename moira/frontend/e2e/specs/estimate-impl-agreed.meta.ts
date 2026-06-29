import { type SpecMeta } from '../spec-meta';

// units/estimate-impl-agreed — §6 has 9 EARS clauses. Agreeing the impl estimates
// grows the agreed total 12.5→28.5, so the apparent 100% drops to the honest 43.9%
// (P5c non-monotonic) while estimate coverage recovers 75→100%.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/estimate-impl-agreed',
  surfaces: ['spec-value', 'activity'],
  clauses: [
    {
      ears: 1,
      mode: 'deferred',
      note: 'タスク完了に伴う未見積実装ノード誕生＋カバレッジ低下は前提（tasks-spec-completed の After）。本 After では既に見積合意済み。',
    },
    {
      ears: 2,
      mode: 'deferred',
      note: '「提案中（未承認）」は During の中間状態。本 spec の After fixture は合意後（agreed）。',
    },
    {
      ears: 3,
      mode: 'deferred',
      note: '実装レビューをノード化するかの確認は人間の判断ダイアログ（write 操作）で、受動描画の観測対象でない。',
    },
    { ears: 4, mode: 'green' }, // レビューをノード化→review-impl 作成＋依存（spec-row F/review-impl）
    {
      ears: 5,
      mode: 'deferred',
      note: '「軽微なら畳む」分岐は本 fixture では選ばれていない（ノード化を選択）。別フローの対象。',
    },
    { ears: 6, mode: 'green' }, // 見積承認→凍結・カバレッジ回復（P2 100%・estimate-badge agreed）
    { ears: 7, mode: 'green' }, // 全体量増→達成率を新全体量で更新＝下がる（EV% 43.9%）
    {
      ears: 8,
      mode: 'deferred',
      note: 'WHILE 未承認の間 値を固定しないことは During の内部状態で、画面の直接観測対象でない。',
    },
    { ears: 9, mode: 'green' }, // 既存 req/design/tasks の見積・凍結・完了状態を変更しない（accepted・EV寄与 不変）
  ],
};
