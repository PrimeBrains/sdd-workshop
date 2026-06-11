# Implementation Plan

- [ ] 1. 基盤: クライアントパッケージと共有基盤の構築
- [x] 1.1 sdd-dashboard/client パッケージの scaffolding を作成する
  - Vite + React 19 + TypeScript strict（`any` 禁止・noImplicitAny）+ TailwindCSS 4 のプロジェクトを `sdd-dashboard/client/` に作成し、Vitest + Testing Library の実行環境を整える
  - tsconfig paths に `@/* → src/*` と `@contracts/* → ../server/src/types/*` を定義し、ESLint で `@contracts` からの `import type` 以外の import と `dangerouslySetInnerHTML` の使用を禁止する
  - index.html・依存パッケージに外部 CDN / 外部 URL 参照が一切ないこと
  - 完了条件: `npm run dev` で空のページが表示され、`@contracts/spec` の `SpecSummary` を `import type` したコードが型チェックを通る
  - _Requirements: 8.2_

- [x] 1.2 GET 限定 API クライアントと TanStack Query 基盤を実装する
  - `api/client.ts` に `get<T>` のみの fetch ラッパを実装し、非 2xx の `ApiError` 形とネットワーク断を `NormalizedApiError`（code / message / status）へ正規化する。POST / PUT / DELETE は実装しない
  - `queryKeys.ts` にクエリキー（repo / specs / spec / trace）を集約し、`useRepoInfo` / `useSpecs` / `useSpecDetail` / `useTraceGraph` フックと `queryClient.ts` を実装する
  - `shared/ErrorPanel.tsx` を実装し、`code` と `message` の表示 + 再試行ボタン（refetch 発火）を持たせる
  - 完了条件: msw でモックした 500 + `ApiError` 応答に対し、ErrorPanel にエラーコードとメッセージの厳密値が表示され、再試行ボタンで再取得が発火するテストが通る
  - _Requirements: 1.5_

- [x] 1.3 アプリシェル・ルートレジストリ・SpecActionSlot を実装する
  - `app/router.tsx` にルート表（`/specs`、`/specs/:feature`、`/specs/:feature/:document`、compare / matrix / validation ルート）を `RouteObject[]` レジストリとして定義し、予約名前空間定数（`/board` `/help` `/steering` `/skills` `/adr`）を宣言する
  - `AppShell.tsx`（ヘッダ + スペックサイドバー + Outlet）と `SpecActionSlot.tsx`（Context 登録 API + Outlet。本スペックでは何も登録しない）を実装する
  - 書込操作の UI 要素（承認ボタン等）を一切置かないこと
  - 完了条件: `/specs/foo/requirements` を直接開く・リロードすると同じビュー構成が復元され、未知 URL は `/specs` へフォールバックする
  - _Requirements: 1.4, 8.1_

- [ ] 2. スペック一覧と概要ナビゲーション
- [x] 2.1 (P) スペック一覧画面を実装する
  - `useSpecs` の `SpecSummary[]` から feature 名・phase・承認状態・成果物有無バッジ（`SpecMetaBadges`）を一覧表示し、行クリックで `/specs/:feature` へ遷移する
  - spec.json 不正等の `diagnostics` を持つスペックも省略せず、診断バッジ付きで表示する
  - 完了条件: フィクスチャ 3 スペック（正常 / 成果物欠落 / spec.json 破損）が全件表示され、各メタデータが厳密値で一致するテストが通る
  - _Requirements: 1.1_
  - _Boundary: SpecListPage, SpecMetaBadges_

- [x] 2.2 (P) スペック概要画面とドキュメントタブを実装する
  - `useSpecDetail` から成果物（brief / requirements / design / tasks / research）と validation レポートを選択可能なタブ / カードとして提示する
  - 存在しない成果物はディム表示 + 「未作成」表示とし、クリックしてもエラーにしない
  - 完了条件: `artifacts` の false 項目が非エラーの不在表示になり、true 項目のみ該当ドキュメントルートへ遷移するテストが通る
  - _Requirements: 1.2, 1.3_
  - _Boundary: SpecOverviewPage, DocumentTabs_

- [ ] 3. ドキュメント描画基盤（情報無欠落）
- [x] 3.1 安全な raw markdown 描画と DocBlock ディスパッチを実装する
  - `RawBlockView` を react-markdown + remark-gfm で実装する: raw HTML 非描画、`urlTransform` で外部オリジン URL と危険スキームを無効化、`reason` ツールチップ付きの生表示ボーダー
  - `DocBlockList` を実装し、`DocBlock` union を入力順のまま structured レンダラ / RawBlockView へディスパッチする（並べ替え・スキップなし）。`MarkdownDoc` で brief / research 等の文書全体を描画する
  - 完了条件: `<script>` と外部画像入り markdown が不活性テキストとして表示され script / 外部 img 要素が DOM に存在しないテスト、および structured / raw 混在フィクスチャで描画テキスト連結が元文書全文と一致する情報無欠落テストが通る
  - _Requirements: 2.5, 2.6, 2.7_

- [x] 3.2 ドキュメント表示ページとルーティング結線を実装する
  - `SpecDocumentPage` が `/specs/:feature/:document` のパラメータから対応ビューア（4.x で実装。それまでは MarkdownDoc フォールバック）へディスパッチし、URL ハッシュのアンカー位置を復元する
  - リロードまたは共有リンクとして開かれたフォーカス対象付き URL（ディープリンク）で同じビューを復元し、フォーカス対象を画面内にスクロールする
  - 完了条件: document パラメータごとに対応するビューが描画され、リロード・共有 URL の直接オープンで同一ドキュメント + フォーカス対象が復元されスクロールされる
  - _Requirements: 1.4, 3.9_

- [ ] 3.3 mermaid 図ブロック描画を実装する
  - `MermaidBlock` を実装する: `mermaid` フェンスコードブロックを mermaid ライブラリ（`securityLevel: 'strict'` で初期化）で図として描画し、生成 SVG の DOM 注入は本コンポーネントのみに限定する
  - 描画失敗（構文エラー等）時は生コード全文を目に見える警告とともに表示する（黙って欠落させない）。RawBlockView / MarkdownDoc のコードブロック描画から言語指定 `mermaid` を MermaidBlock へディスパッチする
  - 完了条件: 正常な mermaid ブロックが svg として描画されるテストと、構文エラーのブロックが警告 + 生コード全文（厳密一致）で表示されるテストが通る
  - _Requirements: 2.8, 2.9_
  - _Depends: 3.1_

- [ ] 4. 成果物別構造化ビューア
- [ ] 4.1 (P) requirements ビューアを実装する
  - `RequirementsDoc` の各要件を ID・タイトル・objective・AC リストの構造化カードとして描画し、各要件・AC にアンカー ID を払い出す
  - AC の英文と `translationJa` をペアで同一項目内に表示する（和訳なしは英文のみ）。`otherBlocks` と raw フォールバックは DocBlockList 経由で文書順に描画する
  - 完了条件: 実 spec 構造のフィクスチャで、AC `1.2` のカードに英文と和訳がペアで描画され、ID チップが表示されるテストが通る
  - _Requirements: 2.1, 2.2_
  - _Boundary: RequirementsView_

- [ ] 4.2 (P) design ビューアを実装する
  - `SectionNode` ツリーを左ナビとして描画し、クリックで該当セクションへスクロールする。本文は DocBlockList で描画する
  - Requirements Traceability テーブルを構造化テーブルとして描画し、`refs` の `RefToken[]` を参照チップ列（5.3 実装までは静的表示）として描画する。セクション見出しに design 要素アンカーを払い出す
  - 完了条件: フィクスチャ design 文書でセクションツリーの全見出しがナビに表示され、Traceability 行の参照 ID 群が行ごとに厳密値で描画されるテストが通る
  - _Requirements: 2.3_
  - _Boundary: DesignView_

- [ ] 4.3 (P) tasks ビューアを実装する
  - `TaskEntry` 階層をメジャー / サブタスクの入れ子で描画し、完了状態チェック・`(P)` バッジ・`*`（後送り）バッジを表示する
  - `requirements` 参照チップ列・`depends`（タスクアンカーへのリンク）・`boundary` テキスト・詳細 bullet を各タスクに表示し、タスクごとにアンカー ID を払い出す
  - 完了条件: フィクスチャ tasks 文書で `(P)` / `*` / checked の各マーカーと 3 種注記が該当タスクに厳密に表示されるテストが通る
  - _Requirements: 2.4_
  - _Boundary: TasksView_

- [ ] 5. 相互リンクナビゲーション
- [ ] 5.1 トレーサビリティ双方向インデックスを実装する
  - `buildTraceIndex` 純粋関数を実装する: `TraceGraph.edges` から要件 → design / task と逆方向の隣接 Map、診断のノード別索引、`uncovered` 集合を構築する。エッジ・診断の追加・削除・再判定をしない
  - `useTraceIndex` フックで `useTraceGraph` と合成する
  - 完了条件: legacy 展開・broken-link・uncovered を含むフィクスチャグラフで、`coverOf` / `requirementsOf` の結果集合が入力エッジ列挙と厳密一致し、`allDiagnostics` が入力と同一であるテストが通る
  - _Requirements: 3.1, 3.2, 5.5_

- [ ] 5.2 アンカー規約とジャンプ実行を実装する
  - `anchorIdOf`（NodeRef → DOM アンカー ID の決定的変換。design 名は slug 正規化）と `useJump`（scrollIntoView + 2 秒の一時ハイライト、アンカー不在時は `resolved: false` を返す）を実装する
  - アンカー解決失敗時は黙って無視せず呼び出し側がフォールバックを実行する: design 対応先は構造化トレーサビリティ行へ（5.3 で結線）、その他はドキュメント先頭へ遷移し「対象位置を特定できなかった」notice を表示する
  - 完了条件: ジャンプ実行で対象要素が viewport 内に入りハイライトクラスが付与される結合テスト、および `anchorIdOf` の厳密値単体テストが通る
  - _Requirements: 3.3_

- [ ] 5.3 参照チップと対応先ポップオーバーを実装する
  - `RefChip` を `RefToken` の kind 別に実装する: `id` 通常チップ / `range` 展開 + legacy バッジ / `cross-spec` チップ / `unparsable` 警告非リンクチップ（raw そのまま表示）
  - クリックで `CounterpartPopover` に TraceIndex 由来の対応先（design / task / requirement）を一覧し、選択で `jumpTo` する。broken-link 診断に該当する参照はリンク切れスタイルで描画しジャンプを提供しない
  - `cross-spec` は対象スペックの requirements ルート + アンカーへ遷移する。4.1〜4.3 のビューアの参照表示を本チップへ差し替える
  - design 対応先のアンカーが解決できない場合は、design ビューの構造化トレーサビリティ行（該当要件の行）へフォールバック遷移する（デッドクリックなし）
  - 完了条件: AC チップ → ポップオーバー → design 対応先選択で design ルートへ遷移しハイライトされる結合テスト、broken-link チップがクリックしても遷移しないテスト、およびアンカー未解決の design 対応先選択でトレーサビリティ行へ遷移するテストが通る
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.10_

- [ ] 5.4 ジャンプ履歴と戻る UI を実装する
  - `jumpHistory`（ジャンプ前のルート + アンカーを push するスタック）と `JumpBackBar`（出自の表示 + 戻るボタン）を実装する
  - 完了条件: 2 回連続ジャンプ後に戻るを 2 回押すと、逆順で各出自（ドキュメント + アンカー位置)へ復帰する結合テストが通る
  - _Requirements: 3.4_

- [ ] 5.5 URL ナビゲーション状態とブラウザ履歴統合を実装する
  - 画面・スペック・ドキュメント・フォーカス対象（AC / design セクション / トレーサビリティ行 / タスク）のナビゲーション状態を URL（パス・クエリ・ハッシュ）に符号化し、`jumpTo` を含むすべての遷移をブラウザ履歴 push で行う
  - ブラウザの戻る / 進む操作で、直前 / 直後のナビゲーション状態（フォーカス・スクロール対象を含む）が復元されること
  - 完了条件: AC フォーカス → design へジャンプ → ブラウザ戻るで元の AC のフォーカス + スクロール位置が復元され、ジャンプ後の URL を直接開くと同じフォーカス状態が再現される結合テストが通る
  - _Requirements: 3.7, 3.8_
  - _Depends: 5.2_

- [ ] 6. サイドバイサイド比較ビュー
- [ ] 6.1 2 ペイン比較画面とドキュメント切替を実装する
  - `ComparePage` を実装する: URL クエリ（left / right、デフォルト requirements / design）に基づき `ComparePane` がビューアを 2 枚並列表示し、各ペインのセレクタで URL を書き換えて切替える
  - 完了条件: `?left=requirements&right=design` で両文書が並列表示され、セレクタ切替後のリロードで同じペイン構成が復元される
  - _Requirements: 4.1, 4.2_
  - _Depends: 4.1, 4.2, 4.3_

- [ ] 6.2 対応箇所ハイライト同期を実装する
  - `useCorrespondence` を実装する: 一方のペインで選択された要素から TraceIndex の隣接を引き、対向ペインの該当アンカー集合をハイライト + 先頭へスクロールする。対応関係はグラフ由来のみ（独自対応付けをしない）
  - 各ペイン内で RefChip の相互リンクナビゲーションがそのまま機能すること
  - 完了条件: 左ペインの要件カード選択で右ペイン design の対応セクションのみがハイライトされる結合テスト（グラフにない要素が光らないことを含む）が通る
  - _Requirements: 4.3, 4.4_
  - _Depends: 5.1, 5.3_

- [ ] 7. トレーサビリティマトリクス
- [ ] 7.1 カバレッジマトリクス画面を実装する
  - `MatrixPage` / `MatrixGrid` を実装する: 行 = 全要件 ID、列グループ = design 要素 / タスク。セルにエッジ有無と `source` 種別マークを表示する。データは TraceIndex の展開結果のみで、UI 側の再判定をしない
  - 完了条件: フィクスチャグラフのエッジ数とマーク付きセル数が厳密一致するテストが通る
  - _Requirements: 5.1, 5.5_
  - _Depends: 5.1_

- [ ] 7.2 未カバー・診断ハイライトとマトリクスからの遷移を実装する
  - `uncovered.design` / `uncovered.task` の行を警告ハイライトし、`DiagnosticsPanel` に broken-link / unparsable-ref を raw テキスト・発生元・行番号付きで一覧表示する
  - 行ヘッダ / セルのクリックで該当ドキュメントビューの対応要素へ `jumpTo` する
  - 完了条件: design-uncovered の要件行がハイライトされ、セルクリックで tasks ビューの該当タスクへ遷移しハイライトされる結合テストが通る
  - _Requirements: 5.2, 5.3, 5.4_

- [ ] 8. validation レポート表示
- [ ] 8.1 (P) validation レポート一覧を実装する
  - `ValidationList` を実装し、`SpecDetail.validations` の type / date / decision をバッジ付きで一覧表示して概要画面に組み込む。存在しない type は「未生成」プレースホルダを表示する
  - 完了条件: gap のみ存在するフィクスチャで gap がメタデータ付きで表示され、design / impl が未生成表示になるテストが通る
  - _Requirements: 6.1, 6.4_
  - _Boundary: ValidationList_

- [ ] 8.2 (P) validation レポート表示画面を実装する
  - `ValidationReportPage` を実装し、frontmatter メタ + 本文を DocBlockList で構造化描画する。frontmatter 不正で raw 全文 + 診断が返るレポートは RawBlockView + DiagnosticBadge で表示する
  - 完了条件: 正常レポートが構造化表示され、frontmatter 破損フィクスチャが診断バッジ付きの生 markdown 全文として表示されるテストが通る
  - _Requirements: 6.2, 6.3_
  - _Boundary: ValidationReportPage_

- [ ] 9. SSE 自動更新
- [ ] 9.1 変更イベント購読とクエリ無効化ブリッジを実装する
  - `useChangeEvents` を実装する: `GET /api/events` の `event: change` を購読し、category=spec のイベントを `['specs']` / `['spec', feature]` / `['trace', feature]` の invalidate（`refetchType: 'active'`）に写像する。spec 以外のカテゴリは写像なし。写像テーブルは workflow-ui が追加できる形で export する
  - 同一マイクロタスク内の連続イベントはキー集合に集約して 1 回で invalidate する
  - 完了条件: フェイク EventSource の結合テストで「イベントなしでは再取得ゼロ」を先に確認した上で、表示中スペックの change イベントで再取得 + 新データ描画が起き、category=steering では再取得が起きないことが通る
  - _Requirements: 7.1, 7.4_
  - _Depends: 1.2_

- [ ] 9.2 接続状態表示・再接続・連続変更追従を実装する
  - 接続状態（connected / reconnecting）を `ConnectionBanner` に表示し、`onerror` で reconnecting 表示、`onopen` 復帰時に全キー invalidate して取りこぼしを回復する。アンマウント時に `EventSource.close()` する
  - 連続再取得を跨いでコンポーネントキー（feature + document）が安定し、スペック・ドキュメント選択が維持されることを確認する
  - 完了条件: フェイク EventSource の切断 → 再接続シナリオでバナーが表示 → 消滅し、復帰時に表示中クエリの再取得が発火する結合テストが通る
  - _Requirements: 7.2, 7.3_

- [ ] 10. 統合検証
- [ ] 10.1 主要レビューフローの E2E テストを実装する
  - Playwright + 実 sdd-core サーバー + フィクスチャリポジトリで実装する: 一覧表示（feature 名の厳密値）→ requirements 閲覧 → Req チップから design へジャンプ → マトリクスで uncovered 行ハイライト確認
  - ライブ更新シナリオ: テスト中にフィクスチャの requirements.md をディスク上で書き換え、リロードなしで新 AC テキスト（厳密値）が表示され、document 選択が維持されることを検証する。書き換え前に旧テキストの表示を境界アサートしてから行う（偽 pass 防止）
  - 完了条件: `npm run test:e2e` で上記 2 シナリオが green になる
  - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2, 7.1, 7.2_
  - _Depends: 2.1, 4.1, 4.2, 5.3, 7.1, 7.2, 9.1_

- [ ] 10.2 読み取り専用・ローカル完結の検証テストを実装する
  - E2E 全シナリオ実行中のネットワークログを収集し、外部オリジンへのリクエストが 0 件、サーバーへの非 GET リクエストが 0 件（SSE 接続は GET）であることをアサートする
  - ビルド成果物（dist）に外部 URL 参照が含まれないことを検査するスクリプトを `npm run build` 後に実行する
  - 完了条件: 上記 2 アサーションを含むテストが green になり、UI 上に書込系の操作要素が存在しないことのチェック（SpecActionSlot が空であること）を含む
  - _Requirements: 8.1, 8.2_

## Implementation Notes

- 1.1: スケルトンクライアントは `sdd-dashboard/skeleton-client/` へ退避済み（root vite.config の `root` と root tsconfig の `include` を追従）。本実装クライアントは `sdd-dashboard/client/` の独立パッケージ
- 1.1: vite dev proxy は `/api → http://localhost:7411`（sdd-core `DEFAULT_PORT`。定義は client/vite.config.ts の 1 箇所）。`@contracts/*` は tsconfig paths のみ（Vite alias に置かない）ことで値 import がビルドでも落ちる
- 1.1: client tsconfig は `moduleResolution: "bundler"` で server types の NodeNext 形式 `.js` 指定子を解決できる。`@contracts/api` は `../errors/codes.js`（types/ 外 1 ファイル）へ推移参照する
- 1.2: クライアント合成エラーコードは `NETWORK_ERROR`（ネットワーク断）に加え `UNEXPECTED_RESPONSE`（非 JSON・形不一致・空 code/message）の 2 つ。「code/message 必ず非空」の事後条件を満たすための合成（client.ts に文書化済み）
- 1.2: QueryClient 既定は retry 1 / staleTime 30s / refetchOnWindowFocus false（`createQueryClient()` factory。main.tsx への組み立ては 1.3）。ESLint で `fetch` 直接使用は api/client.ts 以外禁止
- 1.3: vitest globals 無効のため RTL 自動 cleanup が効かない。複数 `render` するテストファイルは明示 `afterEach(cleanup)` が必要（後続 2.x 以降の画面テストも同様）
- 1.3: 将来ページのプレースホルダは `app/placeholders.tsx`（2.x/3.2/6.x/7.x/8.x で差し替え）。layout から子ルートの params を読むには `useParams` でなく `useMatches()` の最深 match を使う（SpecActionSlotOutlet 実装済み）
- 3.1: 安全描画設定は `RawBlockView` の `safeMarkdownOptions`（module 定数）が単一所有。react-markdown 10 は rehype-raw なしで raw HTML をテキストノード化（不活性テキスト表示は標準動作）。`safeUrlTransform` は許可リスト方式（fragment / 相対 / 同一オリジン http(s) のみ）
- 3.1: `DocBlockList` の `StructuredItem` memo はレンダラの参照安定が前提 — 4.x ビューアで `renderStructured` をインライン arrow にすると memo が無効化される点に注意
- 3.2: SpecDocumentPage の DocumentKind switch が 4.x ビューアの差し替え点。アンカー `req-<id>`/`task-<id>` は暫定払い出しで 5.2 anchorIdOf が単一所有者になる。4.1 への引き継ぎ: RequirementsFallback は otherBlocks の SectionNode children（入れ子見出し）をタイトルのみ描画 — 4.1 で MarkdownDoc 相当に置換すること
- 3.2: `navigation/useHashScrollRestore.ts`（data-ready ゲート + getElementById + scrollIntoView block:center）は 5.2 useJump と合成する前提の最小フック。hash 変化でも再スクロールする（in-app 遷移と両立）
