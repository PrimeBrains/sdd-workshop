---
type: impl
feature: sdd-workflow-ui
date: 2026-06-12
decision: GO
---

# Implementation Validation: sdd-workflow-ui

## Validation Report
- DECISION: GO
- MECHANICAL_RESULTS:
  - Tests: PASS — client 単体/結合 `npx vitest run` = 74 files / 471 passed (exit 0); E2E `npm run test:e2e` = 8 passed（readonly-local 1 + review 2 + workflow 5、実 sdd-core サーバー + chromium）; typecheck `tsc --noEmit` clean; lint `eslint .` clean
  - TBD/TODO grep: CLEAN（workflow/** に新規 TBD/TODO/FIXME なし。各タスクのレビューで確認済み）
  - Secrets grep: CLEAN（ハードコード秘匿情報なし。外部 URL/CDN なし）
  - Smoke boot: PASS — `npm run build` 成功（board ルートは `React.lazy` で独立チャンク・xyflow 分離）、`check:dist` OK（外部取得参照 0・未許可外部 URL 文字列 0、8.2）、`selftest:dist` OK（検出ガード健全）。E2E がフルブート（ボード描画→レビュー遷移→承認/手戻りのディスク書込→ナレッジ/ヘルプ閲覧）を通過しランタイム生存性を実証
- INTEGRATION:
  - Cross-task contracts: OK — Contracts→Model→Api→Features→Integration の一方向データフローが成立。`writeClient`(1.2)→`useApprovalMutation`/`useRollbackMutation`→`ApproveDialog`/`RollbackDialog`(4.2/4.3)、`phaseModel`(2.1)→`buildBoardGraph`(3.1)/`SpecWorkflowActions`(4.1)、`rollbackImpact`(2.2)→`RollbackDialog`、`nextCommand`(2.3)→`NextActionGuide`(4.4)/`HelpPage`(5.1)、`grouping`(2.4)→board/skills/adr、knowledge hooks(1.3)→各ビューア(6.1/6.2/6.3) がすべて実結線。型不整合・契約衝突なし
  - Shared state consistency: OK — サーバーデータは TanStack Query キャッシュに封じ込め。mutation 成功時の即時反映と SSE 由来 invalidate が同一キー集合（`['specs']`/`['spec',f]`/`['trace',f]`/`['steering']`/`['skills']`/`['adr']`）へ収束し冪等（8.2）。E2E でボード自動更新を実証
  - Boundary audit: OK — 本スペックは `client/src/workflow/**` のみを所有し全実装が内包。`/specs/**` 画面・GET フック・`evm-studio/` は無改変（reuse のみ）。書込は `writeClient.ts` の 2 メソッド（approvals/rollback）に構造的限定（ESLint + 「2 メソッドのみ export」テスト + E2E write-surface アサートで三重担保、9.4）。review-ui 連結点（router 連結・AppShell ナビ/registrar/map 注入・eslint 許可・check:dist 許可リスト）と再検証（AppShell.test.tsx・readonly-local.spec.ts）はすべて design の宣言済み拡張点 / Revalidation Triggers の範囲内
- COVERAGE:
  - Requirements mapped: 9/9 — Req1(ボード)→2.1/2.4/3.1/3.2、Req2(承認)→1.2/4.1/4.2/4.4、Req3(手戻り)→2.2/4.1/4.3/4.4、Req4(ヘルプ)→2.3/5.1、Req5(steering)→1.3/6.1、Req6(スキル)→1.3/2.4/6.2、Req7(ADR)→1.3/2.4/6.3、Req8(自動反映)→1.2/1.4、Req9(SPA統合/誤操作防止/ローカル完結)→1.1/1.2/3.2/4.1 + E2E 7.1/7.2
  - Coverage gaps: なし
- DESIGN:
  - Architecture drift: なし — 機能スライス + 拡張点接続パターンを踏襲。File Structure Plan（model/api/board/actions/help/knowledge/{steering,skills,adr}）が実ファイル構成と一致
  - Dependency direction: 違反なし — Model 層は純粋関数（FS/HTTP/DOM なし）、上位への逆 import なし。review-ui→workflow の逆 import なし
  - File Structure Plan vs actual: match。連結点の差分は 2 点を Implementation Notes 化: (1) `registerWorkflow`/SSE 写像注入は React hooks 制約により main.tsx ではなく AppShell（宣言済み Modified File）の既存 `useChangeEvents` 呼び出し 1 箇所へ注入、(2) `@xyflow/react` は型インポート前提で 3.1 のコミットへ前倒し追加
- OWNERSHIP: LOCAL
- UPSTREAM_SPEC: N/A
- BLOCKED_TASKS: なし（全 14 サブタスク `[x]`、`_Blocked:_` 注記なし）
- REMEDIATION: N/A

### 補足: 横断的 Implementation Notes（追従済み）
- SSE 写像は `useChangeEvents(map)` が「置換」セマンティクスのため `{ ...DEFAULT_INVALIDATION_MAP, ...workflowInvalidationMap }` で spread し spec カテゴリを保持（board の `['specs']` 無効化を壊さない）。merge-not-replace 回帰テストで固定
- ボードは one-node-per-lane モデル（1 スペック=1 `specPipeline` ノード、フェーズ進行は SpecPipelineNode のノード内ビジュアル、edges=[]）
- `check:dist` 許可リストに xyflow 由来の非フェッチ文字列（reactflow.dev / pro.reactflow.dev / `${e}flow.dev`）を追加（fetched-reference 検査・self-test は不変更、`proOptions.hideAttribution` で実 DOM 外部リンクも抑止）
- E2E 承認シナリオは generated 未承認フェーズを持つ `fixture-approvable` を temp repo コピーへ beforeAll で注入（committed fixture・sdd-core 単体テストへ非干渉）
