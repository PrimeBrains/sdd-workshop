import { type SpecMeta } from '../spec-meta';

// units/design-spec-completed — §6 has 26 EARS clauses (issue #19 追いつきで旧 9 を
// 9/10 に、旧 24 を 25/26 に分割・2026-07-05)。Design completes (+EV 5),
// is reviewed (+EV 1) and approved (no EV change), then tasks start → EV% 32→72→80.
// Green locks the EV arc + terminal lifecycles + inbox-absence; reviewer column /
// review queues / schedule dates / reviewer filter ride as xfail tripwires.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/design-spec-completed',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'green' }, // 設計作成完了→出来高が上がる（EV% に design 分が内包）
    { ears: 2, mode: 'green' }, // 出来高を合意済み見積分（5）上げる（EV% 72→80 に内包）
    { ears: 3, mode: 'green' }, // 部分割合で計上しない＝二値（cov-row design = 5 満額）
    { ears: 4, mode: 'deferred', note: 'WHILE 作成中の担当（作業者）表示は中間状態かつ assignee 列が当該スライス未描画。' },
    { ears: 5, mode: 'deferred', note: 'エージェント作業者としての提示は assignee 表示で、spec-value ツリーに未描画（schedule 側の担当表示も別軸）。' },
    { ears: 6, mode: 'xfail', note: '人間レビュー待ち一覧への移動表示が未描画（queue:human-review tripwire）。' },
    { ears: 7, mode: 'xfail', note: 'レビュー担当の指名表示（reviewer 列）が未描画（reviewer-badge tripwire）。' },
    { ears: 8, mode: 'deferred', note: 'レビュー担当の決定が人間のコミット判断であることは write 規律で、画面の観測対象でない。' },
    {
      ears: 9,
      mode: 'green',
      note: 'issue #19 追いつき（2026-07-05）で旧 9 を 9/10 に分割（姉妹 requirements-spec-drafted の 2026-07-04 裁定と同一構造への同期）。本節＝作成完了をコミット判断区画（見積合意・担当割当）に出さない（終端 fixture の inbox 不出現アサートで被覆）。',
    },
    {
      ears: 10,
      mode: 'deferred',
      note: '分割後節＝検収待ちを「受入判断する」区画に現し承認まで保つ。本 fixture は承認後の終端断面で中間断面（設計=検収待ち）が無く未観測。同機構は requirements-spec-drafted EARS 9/10 が回帰固定済み。中間断面の追加アサートは spec 再生成の follow-up。',
    },
    { ears: 11, mode: 'deferred', note: '設計 implemented で設計レビューが ready になる（依存充足）導出は実在だが ready 遷移の専用表示は未描画。' },
    { ears: 12, mode: 'green' }, // 設計レビュー作業完了→出来高 +1（cov-row review-design = 1）
    { ears: 13, mode: 'green' }, // 設計承認 implemented→accepted（lifecycle accepted）
    { ears: 14, mode: 'green' }, // 設計承認で EV を増減しない（EV% 80.0%）
    { ears: 15, mode: 'green' }, // 設計承認で達成率を承認自体で変えない（EV% 80.0%）
    { ears: 16, mode: 'green' }, // 設計承認でレビュー作業出来高を変えない（cov-row review-design = 1）
    { ears: 17, mode: 'green' }, // レビュー作業も accepted（lifecycle accepted）
    { ears: 18, mode: 'xfail', note: '設計を人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。' },
    { ears: 19, mode: 'green' }, // タスク pending→implementing・作業者 Claude（lifecycle implementing）
    { ears: 20, mode: 'green' }, // タスク着手で EV を増やさない（EV% 80.0% のまま）
    { ears: 21, mode: 'deferred', note: '達成率を変えず実行カバレッジ（R-S8）を増やすこと。execution coverage メトリクス表示が未描画（derive-golden で実証）。' },
    { ears: 22, mode: 'xfail', note: '担当（assignee）とレビュー担当（reviewer）の併置表示が未描画（reviewer-badge tripwire）。' },
    { ears: 23, mode: 'xfail', note: '作業詳細の予定開始日・予定終了日が未描画（field:planned-start tripwire）。' },
    { ears: 24, mode: 'xfail', note: 'レビュー担当フィルタが未供給（queue-filter:reviewer tripwire）。' },
    {
      ears: 25,
      mode: 'green',
      note: 'issue #19 追いつきの分割節＝承認（受入）で「受入判断する」区画から当該項目が消える。承認後 fixture の inbox 不出現アサートで回帰固定（項目消滅の観測）。',
    },
    {
      ears: 26,
      mode: 'green',
      note: '分割後節＝設計承認・タスク着手の事象そのものを判断項目として出さない。EARS 25 と同一テストで被覆。',
    },
  ],
};
