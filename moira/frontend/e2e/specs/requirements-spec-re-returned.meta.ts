import { type SpecMeta } from '../spec-meta';

// units/requirements-spec-re-returned — §6 has 11 EARS clauses. Second return is
// FOLDED: no new review node, review-work EV/lifecycle unchanged, the re-review cost
// lands as AC only (CPI worsens) and the requirement reverts again (EV% 32→8).
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/requirements-spec-re-returned',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'green' }, // レビュー作業行の出来高を変えない（cov-row review-req = 1 のまま）
    { ears: 2, mode: 'green' }, // 新しい作業行を追加しない（葉数 6 のまま＝畳む）
    {
      ears: 3,
      mode: 'deferred',
      note: '二度目の工数を AC のみ計上・EV を動かさず CPI を悪化させること。AC=0.5 への加算は derive-golden で実証（return reverts EV; AC↑）。CPI メトリクスの画面表示は当該スライス未描画。',
    },
    { ears: 4, mode: 'green' }, // レビュー作業の lifecycle を変えない（review-req は implemented のまま）
    { ears: 5, mode: 'green' }, // 要件定義を再作業中へ（lifecycle implementing）
    { ears: 6, mode: 'green' }, // 出来高を失わせる（EV% 8.0%・二値）
    {
      ears: 7,
      mode: 'deferred',
      note: '実コスト（初回＋再作業＋二度目レビュー）の保持は AC 内部値。AC 表示自体が当該スライス未描画。',
    },
    {
      ears: 8,
      mode: 'deferred',
      note: '同一 EV% でも CPI で区別する併置表示が未描画（CPI 導出は実在・derive-golden で AC 差を実証）。',
    },
    {
      ears: 9,
      mode: 'deferred',
      note: '畳んだ工数単独でスラッシュ警告を出さないこと（負の警告事象）は health の非描画で観測対象外。',
    },
    {
      ears: 10,
      mode: 'green',
      note: '【裁定 2026-07-04】requirements-spec-returned EARS 10 と同裁定（実装が正）。コミット判断3セクションへの不出現＋P5「差し戻しリスク」警告の出現を回帰固定。unit 文言改訂は kiro-scenario 所管 follow-up。',
    },
    {
      ears: 11,
      mode: 'xfail',
      note: '人間レビュー待ち一覧からの除外・玉=AI 表示が未描画（queue:human-review tripwire）。',
    },
  ],
};
