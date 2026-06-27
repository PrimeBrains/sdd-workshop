import { type SpecMeta } from '../spec-meta';

// units/estimate-spec-agreed — §6 has 8 EARS clauses. Mostly-green structural sample.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'units/estimate-spec-agreed',
  surfaces: ['spec-value'],
  clauses: [
    { ears: 1, mode: 'green' }, // 承認 → 「合意済み」として記録（estimate badge = agreed）
    {
      ears: 2,
      mode: 'deferred',
      note: 'frozenBudget は独立列として未描画（estimate-spec-agreed §7「frozenBudget を独立列として表示せず」）。完了時のみ EV寄与として現れる。',
    },
    { ears: 3, mode: 'green' }, // 印を「提案中」→「承認済み」（before-fixture との対比で非空虚）
    { ears: 4, mode: 'green' }, // 見積カバレッジ表示を更新（0%→100%）
    {
      ears: 5,
      mode: 'xfail',
      note: '履歴/activity サーフェス（§4「履歴画面（新規）」・frontmatter surfaces: activity(新規)）は未実装。nav:activity tripwire。',
    },
    { ears: 6, mode: 'green' }, // WHILE 未承認 → agreed にしない（before-fixture が proposed*）
    {
      ears: 7,
      mode: 'deferred',
      note: 'assignee は spec-value に描画されない（担当は schedule 側・別サーフェス）。assign-spec-provisional が被覆。',
    },
    {
      ears: 8,
      mode: 'deferred',
      note: '本 fixture に実装ノードが無く（フェーズ 3 葉のみ）、実装見積状態の不変は観測対象が存在しない。',
    },
  ],
};
