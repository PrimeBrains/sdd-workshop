import { type SpecMeta } from '../spec-meta';

// units/requirements-spec-accepted — §6 has 11 EARS clauses (issue #19 追いつきで
// 旧 10 を 10/11 に分割: 承認で受入項目が消える＋事象は項目にならない・2026-07-05)。
// Approval moves req implemented→accepted WITHOUT changing EV (32% stays 32%), the
// review-work node is also accepted (EV unchanged), and design starts (implementing).
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
    {
      ears: 10,
      mode: 'green',
      note: 'issue #19 追いつき（2026-07-05）の分割節＝承認（受入）で「受入判断する」区画から当該項目が消える。承認後 fixture での inbox 不出現アサートが回帰固定（項目消滅の観測）。',
    },
    {
      ears: 11,
      mode: 'green',
      note: '分割後節＝承認・設計着手の事象そのものを判断項目として出さない。EARS 10 と同一テストで被覆。',
    },
  ],
};
