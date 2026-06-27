import { type SpecMeta } from '../spec-meta';

// units/review-work-estimated — §6 has 9 EARS clauses. Metric-rich sample
// (P2 100%→50%→100% across Before/During/After), all green except reviewer (deferred).
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/review-work-estimated',
  surfaces: ['spec-value'],
  clauses: [
    { ears: 1, mode: 'green' }, // レビュー作業ノードを feature の子として作成＋見積案 proposed
    { ears: 2, mode: 'green' }, // 依存辺 phase→review（traceability の ──implemented──▸）
    { ears: 3, mode: 'green' }, // 提示時「未承認」印（During で proposed*）
    { ears: 4, mode: 'green' }, // 分母に算入しカバレッジ低下（During 50%）
    { ears: 5, mode: 'green' }, // 承認 → agreed＋凍結（After で agreed）
    { ears: 6, mode: 'green' }, // 分子に算入しカバレッジ回復（After 100%）
    { ears: 7, mode: 'green' }, // WHILE 未承認 → agreed にしない（During の review は proposed*）
    { ears: 8, mode: 'green' }, // フェーズの見積状態・凍結値を変えない（During でフェーズは agreed のまま）
    {
      ears: 9,
      mode: 'deferred',
      note: 'reviewer 属性は未描画（reviewer は平準化/EV/PV/coverage に不参加の付帯属性）。見積と別物であることは負の観測対象。',
    },
  ],
};
