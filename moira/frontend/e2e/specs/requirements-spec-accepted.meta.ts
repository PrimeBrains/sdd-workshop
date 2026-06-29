import { type SpecMeta } from '../spec-meta';

// units/requirements-spec-accepted — §6 has 10 EARS clauses. Approval moves req
// implemented→accepted WITHOUT changing EV (32% stays 32%), the review-work node is
// also accepted (EV unchanged), and design starts (implementing).
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/requirements-spec-accepted',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'green' }, // 要件定義 implemented→accepted（lifecycle accepted）
    { ears: 2, mode: 'green' }, // 承認で EV を増減しない（EV% 32.0%）
    { ears: 3, mode: 'green' }, // 承認で達成率を変えない（EV% 32.0% 据え置き）
    { ears: 4, mode: 'green' }, // レビュー作業の出来高を変えない（cov-row review-req = 1）
    { ears: 5, mode: 'green' }, // レビュー作業も accepted・出来高変えない（lifecycle accepted）
    {
      ears: 6,
      mode: 'xfail',
      note: '要件定義を人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。',
    },
    { ears: 7, mode: 'green' }, // 設計 pending→implementing・作業者 Claude（lifecycle implementing）
    { ears: 8, mode: 'green' }, // 設計着手で EV を増やさない（EV% 32.0% のまま）
    {
      ears: 9,
      mode: 'deferred',
      note: '達成率を変えず実行カバレッジ（R-S8）を増やすこと。execution coverage メトリクスの画面表示が当該スライス未描画（derive-golden で 1/6 を実証）。',
    },
    { ears: 10, mode: 'green' }, // 要件承認・設計着手を decision インボックスに出さない
  ],
};
