import { type SpecMeta } from '../spec-meta';

// units/impl-completed — §6 has 20 EARS clauses. The spine's terminal: both impls
// complete (+8,+6) and the impl review (+2) → EV% 43.9→72→93→100 REAL; all 9 leaves
// accepted; the human signs off F (accepted) — the only feature completion. The real
// 100% has P2 100% (vs the apparent 100% at P2 75%).
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/impl-completed',
  surfaces: ['spec-value', 'activity', 'decision-inbox'],
  clauses: [
    { ears: 1, mode: 'deferred', note: '実装着手（implementing）は During の中間状態。本 After fixture は accepted 後。' },
    { ears: 2, mode: 'deferred', note: 'WHILE 実装中の達成率・実行カバレッジ（22%）は During 中間（derive-golden で実証）。' },
    { ears: 3, mode: 'green' }, // 各実装作成完了→出来高 +8/+6（EV% に内包・cov-row）
    { ears: 4, mode: 'green' }, // 部分割合で計上しない＝二値（cov-row impl-1 = 8 満額）
    { ears: 5, mode: 'deferred', note: 'エージェント作業者としての提示は assignee 表示で spec-value ツリーに未描画。' },
    { ears: 6, mode: 'green' }, // 実装作成完了を decision インボックスに出さない
    { ears: 7, mode: 'deferred', note: '両実装 implemented で実装レビューが ready になる導出は実在だが ready 専用表示は未描画。' },
    { ears: 8, mode: 'deferred', note: 'いずれか未完了の間レビューを ready にしない（負の条件）は非描画で観測対象外。' },
    { ears: 9, mode: 'green' }, // 実装レビュー完了→出来高 +2（cov-row review-impl = 2）
    { ears: 10, mode: 'green' }, // 各実装承認 implemented→accepted（lifecycle accepted）
    { ears: 11, mode: 'green' }, // 実装承認で出来高を増やさない（EV% 100.0%）
    { ears: 12, mode: 'green' }, // 実装レビュー作業の行も accepted（lifecycle accepted）
    { ears: 13, mode: 'xfail', note: '実装・レビューを人間レビュー待ち一覧から外す表示が未描画（queue:human-review tripwire）。' },
    { ears: 14, mode: 'green' }, // F の子が全 accepted（9葉 accepted）→ F 完了可能
    { ears: 15, mode: 'green' }, // 人間が F を完了へ（F lifecycle accepted）＝背骨唯一の feature 完了
    { ears: 16, mode: 'green' }, // F 完了で達成率を F 完了自体では変えない（EV% 100.0% 本物）
    { ears: 17, mode: 'deferred', note: 'F を自動で完了しないこと（人間の最終サインオフ）は負の write 規律で観測対象外。' },
    { ears: 18, mode: 'green' }, // F 完了を decision インボックスに出さない
    { ears: 19, mode: 'xfail', note: '担当とレビュー担当の併置表示が未描画（reviewer-badge tripwire）。' },
    { ears: 20, mode: 'xfail', note: 'レビュー担当フィルタが未供給（queue-filter:reviewer tripwire）。' },
  ],
};
