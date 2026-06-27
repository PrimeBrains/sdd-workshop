// Scenario stages — each is ONE agreed unit's delta, transcribed faithfully from
// that unit's §5 event JSON. Fixtures compose stages in scenario order
// (estimate-proposed → estimate-agreed → review-work-estimated → requirements-drafted),
// exactly as the units declare via precondition/§7. No invented events: every push
// here traces to a JSON event in .kiro/scenarios/units/*.md.
import { type LogBuilder, CLAUDE, TARO } from './builders';

// units/estimate-spec-proposed §5 (e010): AI proposes the 3 phase estimates.
export function proposePhaseEstimates(log: LogBuilder): void {
  log.decompose(
    'F',
    [
      { node: 'F/req', estimate: 3 },
      { node: 'F/design', estimate: 5 },
      { node: 'F/tasks', estimate: 2 },
    ],
    '要件定義・設計・タスクの規模から初期見積を提案（未承認）',
  );
}

// units/estimate-spec-agreed §5 (e020–e022): human agrees the 3 phase estimates.
export function agreePhaseEstimates(log: LogBuilder): void {
  log.agree('F/req', 3, TARO);
  log.agree('F/design', 5, TARO);
  log.agree('F/tasks', 2, TARO);
}

// units/review-work-estimated §5 (e040–e043): AI adds 3 review-work leaves as
// children of F + dependency edges phase→review (policy=implemented, §7).
export function addReviewWorkNodes(log: LogBuilder): void {
  log.decompose(
    'F',
    [
      { node: 'F/review-req', estimate: 1 },
      { node: 'F/review-design', estimate: 1 },
      { node: 'F/review-tasks', estimate: 0.5 },
    ],
    '各フェーズのレビュー作業ノードを追加し、レビュー工数の見積を提案（未承認）',
    CLAUDE,
  );
  log.dep('F/req', 'F/review-req', 'implemented');
  log.dep('F/design', 'F/review-design', 'implemented');
  log.dep('F/tasks', 'F/review-tasks', 'implemented');
}

// units/review-work-estimated §5 (e044–e046): human agrees the 3 review estimates.
export function agreeReviewWorkEstimates(log: LogBuilder): void {
  log.agree('F/review-req', 1, TARO);
  log.agree('F/review-design', 1, TARO);
  log.agree('F/review-tasks', 0.5, TARO);
}

// units/requirements-spec-drafted §5 (e060–e062): AI drafts req → implemented; a
// reviewer (太郎) is named via an attendant transition that holds the state.
export function draftRequirements(log: LogBuilder): void {
  log.life('F/req', 'implementing', CLAUDE, {
    assignee: CLAUDE,
    reason: '要件定義の作成を開始（kiro-spec-requirements 打鍵）',
  });
  log.life('F/req', 'implemented', CLAUDE, {
    reason: '要件定義ドラフト完成・仕様FIX判定（人間の承認待ち）',
  });
  log.life('F/req', 'implemented', TARO, {
    reviewer: TARO,
    reason: 'レビュー担当に spec オーナー（太郎）を確定',
  });
}
