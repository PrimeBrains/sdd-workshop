import { type SpecMeta } from '../spec-meta';

// units/tasks-spec-completed — §6 has 30 EARS clauses (issue #19 追いつきで旧 9 を
// 9/10 に、旧 27 を 28/29/30 に分割・2026-07-05)。Tasks complete/review/approve
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
    {
      ears: 9,
      mode: 'green',
      note: 'issue #19 追いつき（2026-07-05）で旧 9 を 9/10 に分割（姉妹 requirements-spec-drafted の 2026-07-04 裁定と同一構造への同期）。本節＝作成完了をコミット判断区画（見積合意・担当割当）に出さない（終端 fixture の inbox 不出現アサートで被覆）。',
    },
    {
      ears: 10,
      mode: 'deferred',
      note: '分割後節＝検収待ちを「受入判断する」区画に現し承認まで保つ。本 fixture は承認後の終端断面で中間断面（タスク=検収待ち）が無く未観測。同機構は requirements-spec-drafted EARS 9/10 が回帰固定済み。中間断面の追加アサートは spec 再生成の follow-up。',
    },
    { ears: 11, mode: 'deferred', note: 'タスク implemented でタスクレビューが ready になる導出は実在だが ready 専用表示は未描画。' },
    { ears: 12, mode: 'green' }, // タスクレビュー完了→出来高 +0.5（cov-row review-tasks = 0.5）
    { ears: 13, mode: 'green' }, // タスク承認 implemented→accepted（lifecycle accepted）
    { ears: 14, mode: 'green' }, // 承認で EV を増減しない（EV% 100.0%）
    { ears: 15, mode: 'green' }, // 承認で達成率を承認自体で変えない（EV% 100.0%）
    { ears: 16, mode: 'green' }, // 承認でレビュー作業出来高を変えない（cov-row review-tasks = 0.5）
    { ears: 17, mode: 'green' }, // レビュー作業も accepted（lifecycle accepted）
    { ears: 18, mode: 'xfail', note: 'タスクを人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。' },
    { ears: 19, mode: 'green' }, // 全フェーズ（と各レビュー）が accepted（全 spec 葉 accepted）
    { ears: 20, mode: 'green' }, // タスク accepted を契機に実装ノードが未見積で誕生（spec-row F/impl-1）
    { ears: 21, mode: 'green' }, // 未見積実装ノード → 見積カバレッジ 100→75%
    { ears: 22, mode: 'green' }, // 見かけ 100% を「未発見あり」として正直に（EV% 100% かつ P2 75% を同時表示）
    { ears: 23, mode: 'deferred', note: '後続の実装見積合意で達成率が下がることは前方参照（estimate-impl-agreed で実証）。本 fixture の後段ではない。' },
    { ears: 24, mode: 'deferred', note: '未見積実装ノードを実行カバレッジに含めない（R-S8=0）こと。execution coverage 表示が未描画（derive-golden で実証）。' },
    { ears: 25, mode: 'xfail', note: '担当とレビュー担当の併置表示が未描画（reviewer-badge tripwire）。' },
    { ears: 26, mode: 'xfail', note: '作業詳細の予定開始日・予定終了日が未描画（field:planned-start tripwire）。' },
    { ears: 27, mode: 'xfail', note: 'レビュー担当フィルタが未供給（queue-filter:reviewer tripwire）。' },
    {
      ears: 28,
      mode: 'green',
      note: 'issue #19 追いつきの分割節＝承認（受入）で「受入判断する」区画から当該項目が消える。承認後 fixture の inbox 不出現アサート（not contains F/tasks）で回帰固定。',
    },
    {
      ears: 29,
      mode: 'green',
      note: '分割後節＝タスク承認・実装ノード誕生の事象そのものを判断項目として出さない。EARS 28 と同一テストで被覆。',
    },
    {
      ears: 30,
      mode: 'deferred',
      note: '分割後節＝未見積で誕生した実装ノードを「見積に合意する」区画に「見積合意が必要」として現す。実装は描画済み（estimate 述語=proposed 有効葉）だが本 spec は未アサート——旧 EARS 27 の「仮 agreed・後で節と実装を調整」を issue #19 追いつきで解消（unit §4-5/§6 を実装へ同期）し、アサート追加は spec 再生成の follow-up。',
    },
  ],
};
