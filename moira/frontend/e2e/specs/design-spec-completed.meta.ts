import { type SpecMeta } from '../spec-meta';

// units/design-spec-completed — §6 has 24 EARS clauses. Design completes (+EV 5),
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
    { ears: 9, mode: 'green' }, // 設計作成完了を decision インボックスに出さない
    { ears: 10, mode: 'deferred', note: '設計 implemented で設計レビューが ready になる（依存充足）導出は実在だが ready 遷移の専用表示は未描画。' },
    { ears: 11, mode: 'green' }, // 設計レビュー作業完了→出来高 +1（cov-row review-design = 1）
    { ears: 12, mode: 'green' }, // 設計承認 implemented→accepted（lifecycle accepted）
    { ears: 13, mode: 'green' }, // 設計承認で EV を増減しない（EV% 80.0%）
    { ears: 14, mode: 'green' }, // 設計承認で達成率を承認自体で変えない（EV% 80.0%）
    { ears: 15, mode: 'green' }, // 設計承認でレビュー作業出来高を変えない（cov-row review-design = 1）
    { ears: 16, mode: 'green' }, // レビュー作業も accepted（lifecycle accepted）
    { ears: 17, mode: 'xfail', note: '設計を人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。' },
    { ears: 18, mode: 'green' }, // タスク pending→implementing・作業者 Claude（lifecycle implementing）
    { ears: 19, mode: 'green' }, // タスク着手で EV を増やさない（EV% 80.0% のまま）
    { ears: 20, mode: 'deferred', note: '達成率を変えず実行カバレッジ（R-S8）を増やすこと。execution coverage メトリクス表示が未描画（derive-golden で実証）。' },
    { ears: 21, mode: 'xfail', note: '担当（assignee）とレビュー担当（reviewer）の併置表示が未描画（reviewer-badge tripwire）。' },
    { ears: 22, mode: 'xfail', note: '作業詳細の予定開始日・予定終了日が未描画（field:planned-start tripwire）。' },
    { ears: 23, mode: 'xfail', note: 'レビュー担当フィルタが未供給（queue-filter:reviewer tripwire）。' },
    { ears: 24, mode: 'green' }, // 設計承認・タスク着手を decision インボックスに出さない
  ],
};
