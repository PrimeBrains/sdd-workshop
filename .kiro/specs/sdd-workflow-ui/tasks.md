# Implementation Plan

- [ ] 1. 基盤: workflow 名前空間とシェル統合
- [x] 1.1 workflow ルート群とシェル連結を実装する
  - `workflow/routes.tsx` に `/board` `/help` `/steering` `/steering/:name` `/skills` `/skills/:name` `/adr` `/adr/:id` の `RouteObject[]` をプレースホルダページ付きで定義し、`app/router.tsx` の連結点（予約名前空間）へ合成する
  - `AppShell.tsx` の共通ナビゲーションへ Board / Help / Steering / Skills / ADR のリンクを追加する（既存リンク・レイアウト構造・`/specs/**` ルートには触れない）
  - 完了条件: `/board` を直接開く・リロードすると同じビューが復元され、共通ナビから各 workflow ルートへ遷移でき、既存の `/specs/**` 画面が変わらず表示される
  - _Requirements: 1.5, 4.3, 9.1, 9.2_

- [x] 1.2 書込専用クライアントと承認・巻き戻し mutation を実装する
  - `workflow/api/writeClient.ts` に `updateApproval`（`PUT /api/specs/:feature/approvals`）と `rollback`（`POST /api/specs/:feature/rollback`）の 2 メソッドのみを実装し、非 2xx の `ApiError` とネットワーク断を `NormalizedApiError`（code / message / status / fieldErrors）へ正規化する。汎用 `post` / `put` は export しない
  - ESLint 設定の fetch 直接使用の許可ファイルに `workflow/api/writeClient.ts` を追加する（既存ルールの緩和ではなく許可対象の追加）
  - `useApprovalMutation` / `useRollbackMutation` を実装し、成功時に返却 `SpecSummary` をキャッシュへ反映して `['specs']` / `['spec', feature]` / `['trace', feature]` を invalidate する
  - 完了条件: msw の結合テストで、成功時に PUT/POST が 1 件発行されキャッシュが更新後状態になること、409 `ApiError` がコード・メッセージの厳密値で `NormalizedApiError` に正規化されることが通る
  - _Requirements: 2.4, 3.4, 8.2, 9.4_

- [x] 1.3 ナレッジ読取フックとクエリキーを実装する
  - `workflowQueryKeys.ts` に steering / skills / adr のクエリキーを集約し、`useSteeringList` / `useSteeringDoc` / `useSkillList` / `useSkillDoc` / `useAdrList` / `useAdrDoc` を review-ui の `ApiClient.get` 再利用 + `useQuery` 薄ラッパとして実装する
  - エラーは `NormalizedApiError` のまま透過し、`ErrorPanel`（review-ui 再利用）で code / message / 再試行を表示できる形にする
  - 完了条件: msw でモックした 404 / 500 応答に対し、各フックの error にエラーコードの厳密値が入り、ErrorPanel 表示 + 再試行ボタンで再取得が発火するテストが通る
  - _Requirements: 9.6_

- [x] 1.4 SSE 無効化写像の拡張と registerWorkflow 組込を実装する
  - `workflow/api/invalidationMap.ts` に `steering → [['steering']]` / `skill → [['skills']]` / `adr → [['adr']]` の `InvalidationMap` エントリを定義する（`spec` カテゴリは review-ui 所有のまま変更せず、`other` は写像なし）
  - `workflow/integration.tsx` の `registerWorkflow()` で SpecActionSlot 登録（4.1 実装までは何も描画しないレンダラ）と `useChangeEvents` への写像注入を組み立て、`main.tsx` から 1 行で呼び出す
  - 完了条件: フェイク EventSource の結合テストで「イベントなしでは再取得ゼロ」を先に確認した上で、category=steering イベントで `['steering']` の再取得が発生し、category=other では再取得が起きないことが通る
  - _Requirements: 8.1, 8.3_

- [ ] 2. フェーズモデル純粋関数群
- [x] 2.1 (P) パイプライン段階モデルと承認可能判定を実装する
  - `buildPipelineView` を実装する: `SpecSummary` から 4 段階（requirements / design / tasks / implementation）の状態（not-generated / generated / approved / unknown）・現在フェーズ・ready を導出する。approvals が null のスペックは全段階 unknown を返す
  - `approvablePhase` を実装する: generated かつ未承認かつ先行フェーズすべて承認済みのフェーズのみを返す（sdd-core の承認バリデーションと同条件）
  - 完了条件: approvals の全組合せ（未生成 / 生成済み未承認 / 承認済み / null、先行フェーズ未承認ケース含む）に対する厳密値の単体テストが通る
  - _Requirements: 1.1, 1.2, 2.1_
  - _Boundary: PhaseModel_

- [ ] 2.2 (P) 巻き戻し影響予測を実装する
  - `computeRollbackImpact` を実装する: 対象フェーズの承認解除・後続フェーズの両フラグクリア・ready_for_implementation 喪失を、sdd-core RollbackWriter のセマンティクスどおりに列挙する（表示専用。実行結果は常にサーバー返却値で上書き）
  - 完了条件: 全承認済みスペックに対する target = requirements / design / tasks の各ケースで、revokedApproval / clearedPhases / losesReady が sdd-core design.md 記載のセマンティクスと厳密一致する単体テストが通る
  - _Requirements: 3.2_
  - _Boundary: RollbackImpact_

- [ ] 2.3 (P) 次 CLI コマンド対応表を実装する
  - `nextCommand.ts` に承認後（requirements → `/kiro-spec-design`、design → `/kiro-spec-tasks`、tasks → `/kiro-impl`）と手戻り後（巻き戻し先フェーズの再生成コマンド）の対応、およびヘルプ用 `PHASE_COMMANDS`（フェーズ・成果物・コマンドの固定記述）を定義する
  - 完了条件: フェーズ × feature 名の全対応が `"/kiro-spec-design sdd-workflow-ui"` 等の厳密値で一致する単体テストが通る
  - _Requirements: 2.5, 3.5, 4.2_
  - _Boundary: NextCommand_

- [ ] 2.4 (P) app / origin グルーピング関数を実装する
  - `model/grouping.ts` に `groupByApp` を実装する: `app: string | null` を持つ要素列を app 名昇順のグループ列に分割し、`app === null` のグループを末尾に置く（board の「未分類」/ ADR の「リポジトリ横断」が共用する純粋関数）
  - `summarizeSpecGroup` を実装する: app セクションのスペック数・READY 数（`readyForImplementation === true`）・実装完了数（`phase === "implementation-complete"`）を集計する
  - `groupSkillsByOrigin` を実装する: `SkillSummary.origin` で「`"cc-sdd"` → `"custom"` → `null`（未分類）」の固定順 3 グループ（空グループも省略しない）に分割し、各グループの件数を返す
  - 完了条件: 複数 app + null 混在のスペック・ADR フィクスチャでグループ順序・所属・サマリー件数が、origin 混在スキルフィクスチャで 3 グループの固定順・件数が、それぞれ厳密値の単体テストで通る
  - _Requirements: 1.6, 1.7, 1.8, 6.4, 6.5, 7.4, 7.5_
  - _Boundary: GroupingModel_

- [ ] 3. パイプライン俯瞰ボード
- [ ] 3.1 ボードグラフ構築関数を実装する
  - `buildBoardGraph` を実装する: `SpecSummary[]` からスペックごとに 1 レーン（4 フェーズノード + 進行エッジ）と決定論的な格子座標を生成し、ノードデータに `PipelineView` と診断有無を埋め込む。spec.json 不正のスペックも省略せずレーンを生成する
  - 完了条件: 正常 / 一部未生成 / spec.json 破損の 3 スペックフィクスチャで、レーン数 = 入力数・ノード状態・診断フラグ・座標の決定性が厳密値で一致する単体テストが通る
  - _Requirements: 1.1, 1.3_
  - _Depends: 2.1_

- [ ] 3.2 ボード画面を @xyflow/react で実装する
  - `@xyflow/react` ^12.11 を dependencies に追加し（CSS はローカル import・Pro 機能不使用）、`PipelineFlow` を読取専用設定（nodesDraggable / nodesConnectable 無効・fitView）でラップする。board ルートは `React.lazy` で遅延ロードする
  - `SpecPipelineNode` カスタムノードでフェーズ状態の色分け・現在フェーズ強調・ready バッジ・診断警告バッジを描画し、スペックラベルのクリックで `/specs/:feature` へ遷移させる。`BoardPage` は `useSpecs` でデータを取得し、エラー時は ErrorPanel を表示する
  - `BoardPage` は `groupByApp` でスペックを app セクションに分割し、セクションごとに `AppSectionHeader`（app 名 + `summarizeSpecGroup` のスペック数・READY 数・実装完了数サマリー）とレーン群を app 名昇順で描画する。`app` が null のスペックは末尾の「未分類」セクションに表示する
  - 完了条件: フィクスチャスペックのレーンが全件描画されて各フェーズ状態・ready・診断バッジが厳密に表示される結合テストと、ノードクリックでレビュー画面へ遷移するテストが通る。app 混在（null 含む）フィクスチャで app セクションが app 名順 + 未分類末尾で表示され、各セクションヘッダのサマリー件数が厳密値で表示される。バンドルに外部 URL 参照が含まれない
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 9.5, 9.6_
  - _Depends: 2.4, 3.1_

- [ ] 4. 承認・手戻り操作
- [ ] 4.1 確認ダイアログ基盤と SpecActionSlot 登録を実装する
  - `ConfirmDialog` を実装する: 確定 / キャンセルの 2 操作、実行中（pending）の確定無効化、エラー表示領域を持ち、書込が確定コールバック経由でのみ起こる構造にする。Esc / 背景クリックはキャンセル扱い
  - `SpecWorkflowActions` を実装して `registerWorkflow` から SpecActionSlot へ登録する: `approvablePhase` が非 null のとき承認ボタンを、承認済みまたは生成済みフェーズが 1 つ以上あるとき手戻りボタンを表示する。レビュー画面の既存表示は変更しない
  - 完了条件: 全承認済みスペックでは承認ボタンが出ず、生成済み未承認フェーズを持つスペックのレビュー画面ヘッダに承認・手戻りボタンが表示される結合テストが通る
  - _Requirements: 2.1, 3.1, 9.2, 9.3_
  - _Depends: 1.4, 2.1_

- [ ] 4.2 承認ダイアログと承認実行を実装する
  - `ApproveDialog` を実装する: 対象の feature / phase / ドキュメント名を表示する確認ステップを挟み、確定で `useApprovalMutation` を実行して更新後の承認状態を反映する
  - データソース拒否時（409 / 404 / 422）はダイアログを閉じず、code + message（422 は fieldErrors も）を表示して再試行・キャンセルを選べるようにする。キャンセル時はリクエストを発行しない
  - 完了条件: msw 結合テストで「キャンセル時に PUT が 0 件」を先に確認（偽 pass 防止）した上で、確定で PUT 1 件 + 承認バッジ更新、409 応答でエラーコード厳密値表示 + バッジ不変、が通る
  - _Requirements: 2.2, 2.3, 2.4, 2.6_
  - _Depends: 1.2_

- [ ] 4.3 手戻りダイアログと巻き戻し実行を実装する
  - `RollbackDialog` を実装する: requirements / design / tasks から巻き戻し先を選択させ（生成済み・承認済みフェーズのみ選択可）、選択に応じて `computeRollbackImpact` の結果（承認解除されるフェーズ・再生成が必要な後続フェーズ・実装準備フラグ解除）を実行前に可視化する
  - 確定で `useRollbackMutation` を実行して更新後のフェーズ・承認状態を反映する。キャンセル時はリクエストを発行せず、拒否時（404 / 422）は code + message を表示して状態表示を変えない
  - 完了条件: msw 結合テストで target = requirements 選択時に影響表示へ「design / tasks の承認解除」「実装準備解除」が列挙され、キャンセルで POST 0 件・確定で POST 1 件 + 状態更新が通る
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_
  - _Depends: 1.2, 2.2_

- [ ] 4.4 実行後の次アクション案内を実装する
  - `NextActionGuide` を実装する: 承認・手戻りの mutation 成功後にダイアログを成功表示へ切り替え、更新後の状態サマリと次に実行すべき CLI コマンド（コピー操作付き）を提示する
  - 完了条件: requirements 承認成功後に `/kiro-spec-design {feature}`、requirements への手戻り成功後に `/kiro-spec-requirements {feature}` が厳密値で表示される結合テストが通る
  - _Requirements: 2.5, 3.5_
  - _Depends: 2.3_

- [ ] 5. ヘルプ/オンボーディング
- [ ] 5.1 ヘルプ画面と cc-sdd フロー解説コンテンツを実装する
  - `helpContent.tsx` に Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装 の順序を示すフロー図と、フェーズ別カード（成果物・承認の意味・CLI コマンド = `PHASE_COMMANDS` 参照）をローカル静的コンテンツとして実装し、`HelpPage` で描画する。外部リンク・外部画像を含めない
  - 完了条件: `/help` で 8 ステップが定義順に表示され、各フェーズカードに成果物名と CLI コマンドの厳密値が表示されるテストが通る。共通ナビからヘルプへ到達できる
  - _Requirements: 4.1, 4.2, 4.3_
  - _Depends: 2.3_

- [ ] 6. ナレッジビューア
- [ ] 6.1 (P) steering ビューアを実装する
  - `SteeringListPage` で `useSteeringList` の全 steering 文書を一覧表示し、選択で `/steering/:name` へ遷移する。`SteeringDocPage` は `SteeringDoc` を review-ui の `MarkdownDoc` で全文描画する（情報無欠落は markdown 基盤の不変則に乗る）
  - 完了条件: フィクスチャ steering 文書が一覧に全件表示され、本文表示の描画テキストに元文書の全セクション見出しが含まれるテストが通る
  - _Requirements: 5.1, 5.2_
  - _Boundary: SteeringListPage, SteeringDocPage_
  - _Depends: 1.1, 1.3_

- [ ] 6.2 (P) スキルビューア（英日タブ・origin グループ）を実装する
  - `SkillListPage` で `useSkillList` の全スキルを EN / JA 有無バッジ付きで一覧表示する。`SkillDocPage` は `SkillDoc.en` / `SkillDoc.ja` を URL クエリ `?lang=` で復元可能なタブとして切替表示する
  - `ja` が null のスキルは JA タブを無効化し「日本語版は未作成」の非エラー表示とともに英語版を表示する
  - 一覧は `groupSkillsByOrigin` で「cc-sdd 標準」→「独自スキル」→「未分類」の固定順 3 グループに分け、各グループ見出しに件数を併記する。`SkillDocPage` のヘッダに `SkillDoc.origin` の `OriginBadge`（cc-sdd 標準 / 独自スキル / 未分類）を表示する
  - 完了条件: ja ありフィクスチャでタブ切替により本文テキストが厳密値で切り替わり、ja なしフィクスチャで JA タブ無効 + EN 表示 + 非エラー文言が表示されるテストが通る。origin 混在フィクスチャで一覧が固定順グループ + 件数付き見出しで描画され、詳細ヘッダに origin バッジが厳密値で表示されるテストが通る
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Boundary: SkillListPage, SkillDocPage, OriginBadge_
  - _Depends: 1.1, 1.3, 2.4_

- [ ] 6.3 (P) ADR ビューアを実装する
  - `AdrListPage` で `useAdrList` の全 ADR を id・タイトル・`AdrStatusBadge`（proposed / accepted / deprecated / superseded の色分け）・date・関連 specs 付きで一覧表示し、選択で `/adr/:id` へ遷移する
  - 一覧は `groupByApp` で frontmatter `app` 別にグルーピングし（app 名昇順・各グループ内 id 昇順）、`app` が null の ADR は末尾の「リポジトリ横断」グループに表示する
  - `AdrDetailPage` で frontmatter メタ（`app` 含む）をヘッダ表示し、本文（Context / Decision / Consequences / Alternatives）を `MarkdownDoc` で散文描画する。frontmatter 不正の ADR は `RawBlockView` + 診断表示にフォールバックする
  - 完了条件: フィクスチャ ADR の status バッジ・date・specs が厳密値で一覧表示され、本文セクションが描画されるテストと、frontmatter 破損 ADR が診断付き生表示になるテストが通る。app 混在（null 含む）フィクスチャで一覧が app 別グループ + 末尾「リポジトリ横断」グループで描画されるテストが通る
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - _Boundary: AdrListPage, AdrDetailPage, AdrStatusBadge_
  - _Depends: 1.1, 1.3, 2.4_

- [ ] 7. 統合検証
- [ ] 7.1 承認・手戻りワークフローの E2E テストを実装する
  - Playwright + 実 sdd-core サーバー + フィクスチャリポジトリで `sdd-dashboard/e2e/workflow.spec.ts` を実装する: ボード表示（全レーンとフェーズ状態の厳密値）→ スペッククリックでレビュー画面へ遷移 → 確認ダイアログ経由で承認 → ディスク上の spec.json の approved が true になったことをファイル読取でアサート → ボードが承認済み表示へ自動更新されることを確認する
  - 手戻りシナリオ: 全承認済みフィクスチャを requirements へ巻き戻し、影響表示の内容を確認して確定 → spec.json 上で後続フェーズのフラグクリアと ready=false をファイルでアサート → `/kiro-spec-requirements` の案内表示を確認する。実行前に変更前状態の境界アサートを行う（偽 pass 防止）
  - 完了条件: `npm run test:e2e` で上記 2 シナリオが green になる
  - _Requirements: 1.1, 1.4, 2.2, 2.4, 3.2, 3.4, 3.5, 8.2_
  - _Depends: 3.2, 4.2, 4.3, 4.4_

- [ ] 7.2 誤操作防止・ローカル完結・ナレッジ閲覧の E2E テストを実装する
  - 確認ダイアログをキャンセルした後に spec.json がディスク上で変更されていないことをアサートする。全 E2E 実行を通してネットワークログに外部オリジンへのリクエストが 0 件、書込リクエストが approvals / rollback の 2 エンドポイント以外に 0 件であることをアサートする
  - ナレッジ・ヘルプシナリオ: `/help` の 8 ステップ表示 → `/steering` 一覧と本文表示 → `/skills` の EN/JA タブ切替 → `/adr` の status バッジ付き一覧と本文表示を一連の操作で検証する
  - 完了条件: `npm run test:e2e` で誤操作防止・ローカル完結・ナレッジ閲覧の全アサーションが green になる
  - _Requirements: 4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 9.3, 9.4, 9.5_
  - _Depends: 4.2, 5.1, 6.1, 6.2, 6.3_

## Implementation Notes

- 1.4: review-ui の `useChangeEvents(map)` は `map ?? DEFAULT_INVALIDATION_MAP` で **置換**（マージではない）。注入する map は必ず `{ ...DEFAULT_INVALIDATION_MAP, ...workflowInvalidationMap }` と DEFAULT を spread すること。怠ると spec カテゴリの `['specs']` 無効化（ボード自動更新）が壊れる。配線は AppShell の既存 `useChangeEvents` 呼び出し1箇所＋Provider 配下の `WorkflowSlotRegistrar`（hooks 制約のため main.tsx ではなく AppShell）。
