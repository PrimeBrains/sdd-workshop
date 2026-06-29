// Scenario stages — each is ONE agreed unit's delta, transcribed faithfully from
// that unit's §5 event JSON. Fixtures (scenario-fixtures.ts) compose stages in
// backbone order, exactly as the units declare via precondition/§7:
//
//   discovery → estimate-proposed → estimate-agreed → review-work-estimated →
//   requirements-drafted → requirements-returned →⟿rework→ requirements-re-returned
//   →⟿rework→ requirements-accepted → design-completed → tasks-completed →
//   estimate-impl-agreed → impl-completed
//
// Discipline: NO invented events. Every push traces to a JSON event in
// .kiro/scenarios/units/*.md §5 (or, for the two ⟿ rework steps, to the flow's
// §5 seam table — flows/new-feature-happy-path.md seams #3/#4 "暗黙の Claude 再作業").
// The units' example ts/id values are illustrative ("実装が決める"); the builder's
// monotonic counter assigns the real (ts,id), so transcription = event CONTENT in
// order, not literal ids.
import { type LogBuilder, CLAUDE, TARO } from './builders';

// ── #1 units/discovery-spec-initialized §5 (e001/e002) ──────────────────────
// Two decomposes, both WITHOUT estimates: the feature is born under the project
// root, then the three phase children are born unestimated (P2 0%, all pending).
export function discoverFeature(log: LogBuilder): void {
  log.decompose('root', [{ node: 'F' }], 'kiro-discovery で新規 spec を立ち上げ', CLAUDE);
  log.decompose(
    'F',
    [{ node: 'F/req' }, { node: 'F/design' }, { node: 'F/tasks' }],
    '§2.6 ①: フィーチャー初期化でフェーズ子ノードを展開（見積なし）',
    CLAUDE,
  );
}

// ── #2 units/estimate-spec-proposed §5 (e010) ───────────────────────────────
// A second decompose of the SAME phase children that SETS proposed estimates
// (fold revises latestEstimate). estimateState stays `proposed` until agreed.
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

// ── #3 units/estimate-spec-agreed §5 (e020–e022) ────────────────────────────
export function agreePhaseEstimates(log: LogBuilder): void {
  log.agree('F/req', 3, TARO);
  log.agree('F/design', 5, TARO);
  log.agree('F/tasks', 2, TARO);
}

// ── support units/review-work-estimated §5 (e040–e043): AI adds 3 review-work
// leaves as children of F + dependency edges phase→review (policy=implemented).
// This support unit is the precondition of #4 (flow seam #2).
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

// ── support units/review-work-estimated §5 (e044–e046): human agrees reviews.
export function agreeReviewWorkEstimates(log: LogBuilder): void {
  log.agree('F/review-req', 1, TARO);
  log.agree('F/review-design', 1, TARO);
  log.agree('F/review-tasks', 0.5, TARO);
}

// ── #4 units/requirements-spec-drafted §5 (e060–e062): AI drafts req →
// implemented; a reviewer (太郎) is named via an attendant transition. EV% 0→24%.
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

// ── #5 units/requirements-spec-returned §5 (e073–e075): 太郎 reviews (review-req
// implementing→implemented, +EV 1), then returns req (implemented→implementing,
// −EV 3). EV% 24 → 32(mid) → 8.
export function returnRequirements(log: LogBuilder): void {
  log.life('F/review-req', 'implementing', TARO, {
    assignee: TARO,
    reason: '太郎が要件定義のレビューを開始（レビュー中）',
  });
  log.life('F/review-req', 'implemented', TARO, {
    reason: 'レビュー完了・指摘事項あり（レビュー作業の出来高を獲得）',
  });
  log.life('F/req', 'implementing', TARO, {
    assignee: CLAUDE,
    reason: 'レビュー指摘により差し戻し（再作業）。implemented→implementing の後退＝P5',
  });
}

// ── ⟿ flow seam #3/#4 (flows/new-feature-happy-path.md §5): the implicit Claude
// rework — req implementing→implemented (re-submit). EV% 8 → 32. Used after each
// return so the next unit's precondition (req implemented) holds.
export function resubmitRequirements(log: LogBuilder): void {
  log.life('F/req', 'implemented', CLAUDE, {
    reason: '指摘を反映した再作業を完了・再提出（flow 継ぎ目＝暗黙の Claude 再作業）',
  });
}

// ── #6 units/requirements-spec-re-returned §5 (e080–e081): a SECOND review is
// folded — its cost lands on F/req (no new node, no new EV) — then req is returned
// again. EV% 32 → 8, AC grows for zero EV gain (re-review isn't free).
export function reReturnRequirements(log: LogBuilder): void {
  log.cost('F/req', 0.5, TARO); // e080 — folded second-review cost
  log.life('F/req', 'implementing', TARO, {
    assignee: CLAUDE,
    reason:
      '二度目のレビュー指摘により差し戻し（再々作業）。implemented→implementing の後退＝P5（二度目）',
  });
}

// ── #7 units/requirements-spec-accepted §5 (e090–e093): a third review is folded
// (cost), then req is APPROVED (implemented→accepted, EV unchanged), review-req is
// accepted (fold floor), and design is started. EV% 32 (approval adds no EV).
export function acceptRequirements(log: LogBuilder): void {
  log.cost('F/req', 0.5, TARO); // e090 — folded third-review cost
  log.life('F/req', 'accepted', TARO, {
    reason: '要件定義の成果物を承認（品質確認）。implemented→accepted（出来高は不変）',
  });
  log.life('F/review-req', 'accepted', TARO, {
    reason: 'レビュー作業ノードの承認（fold で底打ち。ノード/EV=1 は不変）',
  });
  log.life('F/design', 'implementing', CLAUDE, {
    assignee: CLAUDE,
    reason: '開発者が設計を Claude に割当（P0）し kiro-spec-design を起動、Claude が着手',
  });
}

// ── #8 units/design-spec-completed §5 (e110–e117): design implemented (+EV 5),
// reviewer named, design review done (+EV 1), folded cost, design accepted, review
// accepted, tasks started. EV% 32 → 72(mid①) → 80(mid②=after).
export function completeDesign(log: LogBuilder): void {
  log.life('F/design', 'implemented', CLAUDE, {
    reason: '設計成果物（design.md）完成・仕様FIX判定（人間の承認待ち）',
  });
  log.life('F/design', 'implemented', TARO, {
    reviewer: TARO,
    reason: '設計のレビュー担当に spec オーナー（太郎）を確定（付帯記録）',
  });
  log.life('F/review-design', 'implementing', TARO, {
    assignee: TARO,
    reason: '太郎が設計レビュー作業に着手（ready→implementing）',
  });
  log.life('F/review-design', 'implemented', TARO, {
    reason: '太郎が設計レビュー作業を完了＝レビュー出来高 EV 1 を獲得',
  });
  log.cost('F/design', 0.5, TARO); // e114 — review labor folded onto design
  log.life('F/design', 'accepted', TARO, {
    reason: '設計の成果物を承認（品質確認）。implemented→accepted（出来高は不変）',
  });
  log.life('F/review-design', 'accepted', TARO, {
    reason: 'レビュー作業ノードの承認（fold で底打ち。ノード/EV=1 は不変）',
  });
  log.life('F/tasks', 'implementing', CLAUDE, {
    assignee: CLAUDE,
    reason: '開発者がタスク分解を Claude に割当（P0）し kiro-spec-tasks を起動、Claude が着手',
  });
}

// ── #9 units/tasks-spec-completed §5 (e120–e127): tasks implemented (+EV 2),
// reviewer named, tasks review done (+EV 0.5), folded cost, tasks accepted, review
// accepted, then impl-1/impl-2 are born UNESTIMATED (e127). EV% 80 → 96(mid①) →
// 100(mid②, apparent); P2 100 → 75 (discovery signal). Note e127 IS the same
// logical impl-birth as estimate-impl-agreed's e050 (flow seam #7) — emitted ONCE
// here, so #10 starts from e051.
export function completeTasks(log: LogBuilder): void {
  log.life('F/tasks', 'implemented', CLAUDE, {
    reason: 'タスク分解の成果物（tasks.md）完成・仕様FIX判定（人間の承認待ち）',
  });
  log.life('F/tasks', 'implemented', TARO, {
    reviewer: TARO,
    reason: 'タスクのレビュー担当に spec オーナー（太郎）を確定（付帯記録）',
  });
  log.life('F/review-tasks', 'implementing', TARO, {
    assignee: TARO,
    reason: '太郎がタスクレビュー作業に着手（ready→implementing）',
  });
  log.life('F/review-tasks', 'implemented', TARO, {
    reason: '太郎がタスクレビュー作業を完了＝レビュー出来高 EV 0.5 を獲得',
  });
  log.cost('F/tasks', 0.25, TARO); // e124 — review labor folded onto tasks
  log.life('F/tasks', 'accepted', TARO, {
    reason: 'タスク分解の成果物を承認（品質確認）。implemented→accepted（出来高は不変）',
  });
  log.life('F/review-tasks', 'accepted', TARO, {
    reason: 'レビュー作業ノードの承認（fold で底打ち。ノード/EV=0.5 は不変）',
  });
  log.decompose(
    'F',
    [{ node: 'F/impl-1' }, { node: 'F/impl-2' }],
    'タスクの accepted 到達を契機に実装ノードを未見積で誕生（§2.6/§2.3）。見積もり済み 100%→75%',
    CLAUDE,
  );
}

// ── #10 units/estimate-impl-agreed §5 (e051–e059; e050 birth done at #9): propose
// impl-1=8/impl-2=6, add review-impl=2 (proposed), wire deps, then AGREE all three.
// Denominator 12.5 → 28.5 → EV% 100(apparent) → 43.9 (honest, P5c); P2 75 → 100.
export function agreeImplEstimates(log: LogBuilder): void {
  log.decompose(
    'F',
    [
      { node: 'F/impl-1', estimate: 8 },
      { node: 'F/impl-2', estimate: 6 },
    ],
    '作業分解の成果物を入力に、誕生済み実装ノードの規模を見積もり提案（est(impl)・未承認）',
    CLAUDE,
  );
  log.decompose(
    'F',
    [{ node: 'F/review-impl', estimate: 2 }],
    '実装全体のレビュー作業ノードを追加し見積を提案（未承認）',
    CLAUDE,
  );
  log.dep('F/design', 'F/impl-1', 'implemented');
  log.dep('F/design', 'F/impl-2', 'implemented');
  log.dep('F/impl-1', 'F/review-impl', 'implemented');
  log.dep('F/impl-2', 'F/review-impl', 'implemented');
  log.agree('F/impl-1', 8, TARO);
  log.agree('F/impl-2', 6, TARO);
  log.agree('F/review-impl', 2, TARO);
}

// ── #11 units/impl-completed §5 (e060–e072): assignment (pending attendant attrs),
// both impls implementing (exec 22%) → implemented (+8 → 72, +6 → 93), impl review
// done (+2 → 100 real), all accepted, then F accepted (the spine's only feature
// completion — terminal). EV% 43.9 → 71.9 → 93.0 → 100.0 (real).
export function completeImpl(log: LogBuilder): void {
  // e060–e062: assign-spec-provisional (flow seam #8) — assignee/reviewer set while
  // lifecycle stays pending (attendant attribute record).
  log.life('F/impl-1', 'pending', TARO, {
    assignee: CLAUDE,
    reviewer: TARO,
    reason: '実装-1 の作業者を Claude に・レビュー担当を太郎に割当（付帯記録）',
  });
  log.life('F/impl-2', 'pending', TARO, {
    assignee: CLAUDE,
    reviewer: TARO,
    reason: '実装-2 の作業者を Claude に・レビュー担当を太郎に割当（付帯記録）',
  });
  log.life('F/review-impl', 'pending', TARO, {
    assignee: TARO,
    reason: '実装レビュー作業の作業者を太郎に割当（付帯記録）',
  });
  // e063–e068: execution.
  log.life('F/impl-1', 'implementing', CLAUDE, {
    reason: 'kiro-impl 起動。Claude が実装-1 に着手',
  });
  log.life('F/impl-2', 'implementing', CLAUDE, {
    reason: 'Claude が実装-2 に並行着手',
  });
  log.life('F/impl-1', 'implemented', CLAUDE, {
    reason: '実装-1 の成果物完成＝EV 8 を獲得（EV% 44%→72%）',
  });
  log.life('F/impl-2', 'implemented', CLAUDE, {
    reason: '実装-2 の成果物完成＝EV 6 を獲得（EV% 72%→93%）',
  });
  log.life('F/review-impl', 'implementing', TARO, {
    assignee: TARO,
    reason: '太郎が実装レビュー作業に着手＝両実装の内容をレビュー',
  });
  log.life('F/review-impl', 'implemented', TARO, {
    reason: '太郎が実装レビュー作業を完了＝レビュー出来高 EV 2（EV% 93%→100% 本物）',
  });
  // e069–e072: approvals + feature sign-off.
  log.life('F/impl-1', 'accepted', TARO, {
    reason: '実装-1 の成果物を承認。implemented→accepted（出来高は不変）',
  });
  log.life('F/impl-2', 'accepted', TARO, {
    reason: '実装-2 の成果物を承認。implemented→accepted（出来高は不変）',
  });
  log.life('F/review-impl', 'accepted', TARO, {
    reason: '実装レビュー作業ノードの承認（fold で底打ち。ノード/EV=2 は不変）',
  });
  log.life('F', 'accepted', TARO, {
    reason: '子9葉が全て accepted になったのを見て人間が F を完了へ＝最終サインオフ（終端）',
  });
}
