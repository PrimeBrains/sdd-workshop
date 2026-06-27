import { type SpecMeta } from '../spec-meta';

// units/requirements-spec-drafted — §6 has 14 EARS clauses. The xfail showcase:
// the slice renders state + EV%, but reviewer column / review queues / 3-of-4 dates /
// reviewer filter are defined-but-未描画 → test.fail() tripwires.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/requirements-spec-drafted',
  surfaces: ['spec-value', 'schedule-time', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'green' }, // 作成中→作成完了（lifecycle implemented。JP「レビュー待ち」は英語ラベル差）
    { ears: 2, mode: 'green' }, // 出来高を合意済み見積分だけ上げる（EV% 24.0%）
    { ears: 3, mode: 'green' }, // 部分EV を計上しない＝二値（EV寄与 満額 3・EV% ちょうど 24.0%）
    {
      ears: 4,
      mode: 'xfail',
      note: '作成中の assignee 表示＋エージェント作業キューの一覧 UI が未描画（requirements-spec-drafted.md:224-239,:408）。',
    },
    {
      ears: 5,
      mode: 'xfail',
      note: '人間レビュー待ちキューへの移動表示が未描画（humanReviewQueue 導出は実在・一覧 UI 未描画 :241-259,:400）。queue:human-review tripwire。',
    },
    {
      ears: 6,
      mode: 'xfail',
      note: '人間レビュー待ち「一覧」描画が未実装（:259,:400）。',
    },
    {
      ears: 7,
      mode: 'xfail',
      note: 'reviewer 列（担当とは別）が spec-value/schedule に未描画（:171-172,:217,:400,:408）。reviewer-badge tripwire。',
    },
    {
      ears: 8,
      mode: 'deferred',
      note: 'reviewer 指名は人間のコミット write 規律で、画面の観測対象でない（自動指名しないことは負の運用規律）。',
    },
    { ears: 9, mode: 'green' }, // decision インボックスに出さない（横断インボックスに req が無い）
    { ears: 10, mode: 'green' }, // 承認前に出来高を増減しない（accept イベント無しで EV% は 24.0% のまま）
    {
      ears: 11,
      mode: 'xfail',
      note: 'assignee と reviewer を spec-value/schedule の両画面に併置表示する要件が未描画（:171-172,:255,:408）。',
    },
    {
      ears: 12,
      mode: 'xfail',
      note: 'Inspector は基準完了日・予測完了日のみ描画。予定開始日・実績開始日・実績終了日が未描画（:286-302,:403）。EV/PV/frozen-slot/predicted は green 部分被覆として別途アサート。',
    },
    {
      ears: 13,
      mode: 'xfail',
      note: 'レビュー担当フィルタ（per-node reviewer 突き合わせ）が未供給（:261-284,:402）。queue-filter:reviewer tripwire。',
    },
    { ears: 14, mode: 'green' }, // 人間の承認を自動で行わない（lifecycle は implemented で accepted でない）
  ],
};
