import { type SpecMeta } from '../spec-meta';

// units/tasks-spec-completed — §6 has 27 EARS clauses. Tasks complete/review/approve
// (EV% 80→96→100 apparent), then impl-1/impl-2 are born UNESTIMATED → estimate
// coverage drops 100→75% (the honest discovery signal: apparent 100% ≠ done).
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/tasks-spec-completed',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'green' }, // タスク作成完了→出来高が上がる（EV% に内包）
    { ears: 2, mode: 'green' }, // 出来高を見積分（2）上げる（EV% 96→100 に内包）
    { ears: 3, mode: 'green' }, // 部分割合で計上しない＝二値（cov-row tasks = 2）
    { ears: 4, mode: 'deferred', note: 'WHILE 作成中の担当表示は中間状態かつ assignee 列が未描画。' },
    { ears: 5, mode: 'deferred', note: 'エージェント作業者としての提示は assignee 表示で spec-value ツリーに未描画。' },
    { ears: 6, mode: 'xfail', note: '人間レビュー待ち一覧への移動表示が未描画（queue:human-review tripwire）。' },
    { ears: 7, mode: 'xfail', note: 'レビュー担当の指名表示（reviewer 列）が未描画（reviewer-badge tripwire）。' },
    { ears: 8, mode: 'deferred', note: 'レビュー担当の決定が人間のコミット判断であることは write 規律で観測対象外。' },
    { ears: 9, mode: 'green' }, // タスク作成完了を decision インボックスに出さない
    { ears: 10, mode: 'deferred', note: 'タスク implemented でタスクレビューが ready になる導出は実在だが ready 専用表示は未描画。' },
    { ears: 11, mode: 'green' }, // タスクレビュー完了→出来高 +0.5（cov-row review-tasks = 0.5）
    { ears: 12, mode: 'green' }, // タスク承認 implemented→accepted（lifecycle accepted）
    { ears: 13, mode: 'green' }, // 承認で EV を増減しない（EV% 100.0%）
    { ears: 14, mode: 'green' }, // 承認で達成率を承認自体で変えない（EV% 100.0%）
    { ears: 15, mode: 'green' }, // 承認でレビュー作業出来高を変えない（cov-row review-tasks = 0.5）
    { ears: 16, mode: 'green' }, // レビュー作業も accepted（lifecycle accepted）
    { ears: 17, mode: 'xfail', note: 'タスクを人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。' },
    { ears: 18, mode: 'green' }, // 全フェーズ（と各レビュー）が accepted（全 spec 葉 accepted）
    { ears: 19, mode: 'green' }, // タスク accepted を契機に実装ノードが未見積で誕生（spec-row F/impl-1）
    { ears: 20, mode: 'green' }, // 未見積実装ノード → 見積カバレッジ 100→75%
    { ears: 21, mode: 'green' }, // 見かけ 100% を「未発見あり」として正直に（EV% 100% かつ P2 75% を同時表示）
    { ears: 22, mode: 'deferred', note: '後続の実装見積合意で達成率が下がることは前方参照（estimate-impl-agreed で実証）。本 fixture の後段ではない。' },
    { ears: 23, mode: 'deferred', note: '未見積実装ノードを実行カバレッジに含めない（R-S8=0）こと。execution coverage 表示が未描画（derive-golden で実証）。' },
    { ears: 24, mode: 'xfail', note: '担当とレビュー担当の併置表示が未描画（reviewer-badge tripwire）。' },
    { ears: 25, mode: 'xfail', note: '作業詳細の予定開始日・予定終了日が未描画（field:planned-start tripwire）。' },
    { ears: 26, mode: 'xfail', note: 'レビュー担当フィルタが未供給（queue-filter:reviewer tripwire）。' },
    {
      ears: 27,
      mode: 'deferred',
      note: 'タスク承認は inbox に出ない（EARS 9 で green 被覆）。ただし未見積実装ノードの誕生は正当な「合意が必要」commit として inbox に現れる（estimate-impl-agreed の次手）ため、impl 誕生の絶対非表示は主張できない（仮 agreed・後で節と実装を調整）。',
    },
  ],
};
