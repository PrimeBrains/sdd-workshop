import { type SpecMeta } from '../spec-meta';

// units/requirements-spec-returned — §6 has 12 EARS clauses. First return: review
// work earns +EV, then the requirement is sent back (implemented→implementing) and
// loses its EV → EV% 24→32→8. Reviewer column / review-queue lists are 未描画 → xfail.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/requirements-spec-returned',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    {
      ears: 1,
      mode: 'deferred',
      note: 'レビュー「中」（review-req implementing）は During の中間状態。本 spec の After fixture は review 完了（implemented）後ゆえ当該瞬間は現れない。',
    },
    { ears: 2, mode: 'green' }, // レビュー作業の出来高を合意済み見積分上げる（cov-row review-req EV寄与 1）
    { ears: 3, mode: 'green' }, // 部分割合で計上しない＝二値（満額 1）
    { ears: 4, mode: 'green' }, // 差し戻し→要件定義を再作業中へ（lifecycle implementing）
    { ears: 5, mode: 'green' }, // 差し戻し→要件定義の出来高を失わせる（EV% 8.0%）
    {
      ears: 6,
      mode: 'deferred',
      note: '実コスト（AC）保持は本 fixture では §5 にコスト事象が無く AC=0 ゆえ非観測。AC 表示自体も当該スライス未描画。',
    },
    {
      ears: 7,
      mode: 'xfail',
      note: '人間レビュー待ち一覧からの除外・玉=AI 表示が未描画（queue:human-review tripwire）。humanReviewQueue 導出は実在・一覧 UI 未描画。',
    },
    { ears: 8, mode: 'green' }, // レビュー出来高と要件定義出来高を別行で区別（cov-row 別行）
    {
      ears: 9,
      mode: 'deferred',
      note: 'レビュー担当の指名が出来高/スケジュール/カバレッジを動かさないことは非消費属性で、画面の観測対象でない（reviewer 列自体も未描画）。',
    },
    { ears: 10, mode: 'green' }, // 差し戻しを decision の判断項目に出さない（「差し戻し」行なし。P5 at-risk 警告は別信号で許容）
    {
      ears: 11,
      mode: 'deferred',
      note: 'Inspector は EV(0)・状態を出すが、実コスト残を併記する「正直な詳細」UI は未整備。EV/状態は別途 schedule Inspector で部分被覆。',
    },
    {
      ears: 12,
      mode: 'deferred',
      note: '実行カバレッジ（R-S8）と達成率（EV%）の併置表示メトリクス UI が当該スライス未描画（導出は実在）。',
    },
  ],
};
