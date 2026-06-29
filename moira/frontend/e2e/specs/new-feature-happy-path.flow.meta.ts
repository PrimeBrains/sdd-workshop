import { type SpecMeta } from '../spec-meta';

// flows/new-feature-happy-path — the E2E flow doc has 7 §6 EARS clauses (the
// through-line: EV% honest at every seam from discovery to true completion). This is
// a FLOW meta (scenarioUnit = flows/…); the coverage gate validates it against the
// flow's §6 and requires every composed member unit to be agreed. The flow doc is
// being ratified in a separate session and is treated as agreed-equivalent here.
export const SPEC_META: SpecMeta = {
  scenarioUnit: 'flows/new-feature-happy-path',
  surfaces: ['spec-value', 'activity'],
  clauses: [
    { ears: 1, mode: 'green' }, // 完了で EV% を上げ、承認では動かさない（通しの弧で実証）
    { ears: 2, mode: 'green' }, // 差し戻しで出来高を失わせ EV% を後退（24→8）
    { ears: 3, mode: 'green' }, // spec フェーズ通しで「完了で上がり承認で動かず差し戻しで後退」一貫
    { ears: 4, mode: 'green' }, // 見かけ100% を絶対完了として提示しない（P2 75% 同時表示）
    { ears: 5, mode: 'green' }, // 実装見積合意で全体量増→達成率を非単調に更新（100→43.9）
    { ears: 6, mode: 'green' }, // 子9葉 accepted→人間が F を accepted へ進められる
    { ears: 7, mode: 'green' }, // F accepted で本物の100%（見積カバレッジも100%）
  ],
};
