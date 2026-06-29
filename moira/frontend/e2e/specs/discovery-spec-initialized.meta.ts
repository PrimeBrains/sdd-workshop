import { type SpecMeta } from '../spec-meta';

// units/discovery-spec-initialized — §6 has 6 EARS clauses. The genesis state:
// F + 3 phase rows born unestimated (P2 0%), no impl rows, nothing auto-assigned.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/discovery-spec-initialized',
  surfaces: ['spec-value', 'activity'],
  clauses: [
    { ears: 1, mode: 'green' }, // F + 要件定義/設計/タスクの3行を生成（spec-row 3本）
    { ears: 2, mode: 'green' }, // ライフサイクル状態管理を適用（lifecycle-badge = pending）
    { ears: 3, mode: 'green' }, // 全行未見積 → 見積カバレッジ 0%
    {
      ears: 4,
      mode: 'deferred',
      note: '未割当一覧は agreed ノード対象（unassignedBacklog）。誕生時の未見積ノードは agreed でないため当該一覧に出ず、未見積ノードの未割当一覧 UI はスライス未描画。',
    },
    { ears: 5, mode: 'green' }, // 実装の行を生成してはならない（spec-row:F/impl-1 が無い）
    {
      ears: 6,
      mode: 'deferred',
      note: '担当者を自動割当しないことは負の write 規律で、画面の観測対象でない（assignee 自動付与が起きないこと自体は非描画事象）。',
    },
  ],
};
