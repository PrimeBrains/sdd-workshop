# Implementation Plan

- [ ] 1. Foundation: デザイントークン基盤
- [x] 1.1 Tailwind v4 `@theme` にデザイントークンを一元定義し既定パレットを削除する
  - `client/src/index.css` に `@theme` を追加: `--color-*: initial` で既定パレットを削除した上で、design.md のトークン表（paper / paper-warm / ink / ink-soft / line / brand / brand-soft、ok・warn・bad の各系、gray-mid・gray-soft、sidebar 系、chip 系、focus-row・uncovered-row、fill-soft、pre 系、overlay）と `white` / `black` を定義する
  - 既存の `.jump-highlight` / `.correspondence-highlight` は一字も変更しない
  - 完了条件: dev 起動で `bg-paper` 等のトークン utility が効き、`bg-slate-50` が CSS を生成しない（置換前の画面が無装飾化するのは想定内の中間状態。テストは色クラスに依存しないため green を維持）
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.2_

- [x] 1.2 Inter / JetBrains Mono を自己ホストしフォントトークンを定義する
  - `@fontsource-variable/inter` / `@fontsource-variable/jetbrains-mono` を `client/package.json` の dependencies に追加し、`index.css` 冒頭で `@import` する
  - `--font-sans` / `--font-mono` を design.md 記載のスタック（日本語はシステムフォールバック）で定義する
  - 完了条件: dev 画面の本文が Inter Variable・コードが JetBrains Mono Variable で描画され、ブラウザの Network にフォントの外部 URL 取得が現れない
  - _Requirements: 1.2, 6.1, 6.3_

- [x] 1.3 markdown 用 `.md` コンポーネント CSS をスケルトンから移植する
  - `index.css` の `@layer components` に skeleton styles.css 121–135 行相当（h1–h4 / code / pre / pre code / table / th・td / th / blockquote）を移植し、色は全て `var(--color-*)` 参照にする
  - `.md pre` / `.md table` は `overflow-x: auto`（table は `display: block; max-width: 100%`）で要素内封じ込めにする
  - 完了条件: `.md` クラスを付けた検証要素で、表に罫線・セル余白・ヘッダ背景（fill-soft）、引用に brand 左罫線 + brand-soft 背景、pre に暗背景が付く
  - _Requirements: 3.4, 8.3_

- [x] 1.4 (P) 装飾レシピ `shared/ui.ts` を実装する
  - `badgeClass(variant)` / `chipClass(variant)` / `btnClass(variant)` / `cardClass()` を discriminated union の variant 型で実装する（純関数、`any` 禁止、返値はトークン utility のみ）
  - `ui.test.ts` で variant→クラス列の対応を固定し、返値に既定パレット名（slate 等）が含まれないことも検証する
  - 完了条件: `npm test` で ui.test.ts が green
  - _Requirements: 1.5, 3.1_
  - _Boundary: UiRecipes_
  - _Depends: 1.1_

- [ ] 2. シェルと共有プリミティブの再スキン
- [x] 2.1 AppShell を濃緑サイドバー + warm paper ヘッダへ再スキンし main に最大幅を適用する
  - サイドバー: `bg-sidebar` + 淡色テキスト、active ナビは `bg-brand/25` + 左罫線 3px brand（skeleton .sidebar 準拠）。ヘッダ: `bg-paper-warm` + `border-line`
  - `main` に `max-w-[1280px]` とパディング(skeleton `.main` 準拠)を適用し、あわせて `min-w-0` を付与する（フレックス子のオーバーフロー封じ込め下地。8.3 のページ横スクロール検証自体は 4.2 / 6.4 で実施）
  - NavLink の構造・`aria-label`・可視テキストは不変（className のみ）
  - 完了条件: 全ページでサイドバーが濃緑・本文最大幅が効き、`app/` 配下の既存テストが無変更で green
  - _Requirements: 2.1, 2.2, 2.3, 8.5_
  - _Boundary: AppShellReskin_

- [x] 2.2 (P) 共有プリミティブ 3 件を状態色トークンへ再スキンする
  - ErrorPanel → bad 系 / ConnectionBanner → warn 系 / LoadingSkeleton → line・paper-warm 系
  - `role="alert"` / `role="status"` と文言は不変
  - 完了条件: `shared/` 配下の既存テストが無変更で green、dev 画面のエラーパネル・接続バナーがブランド状態色になる
  - _Requirements: 3.3_
  - _Boundary: SharedPrimitivesReskin_

- [ ] 3. markdown 表示の再スキン
- [x] 3.1 RawBlockView / MarkdownDoc へ `md` クラスを適用し failure 装飾をトークン化する
  - RawBlockView ルート div に `md` を付与する（gap ラッパーの className に部分文字列 "border" を含めない契約を維持）
  - failure 装飾を `border border-dashed` + warn 系トークンへ置換（className に "border" を含む契約を維持）し、MarkdownDoc ルートにも `md` を付与する
  - 完了条件: RawBlockView.test / DocBlockList.test が無変更で green、requirements / design 画面で表・引用・コードに `.md` 装飾が当たる
  - _Requirements: 3.4_
  - _Boundary: RawBlockView, MarkdownDoc_

- [x] 3.2 (P) MermaidBlock の図枠装飾をスケルトン準拠にする
  - コンテナへ skeleton `.mermaid-block` 準拠の図枠（白背景・line 罫線・角丸 8px・中央寄せ）を utility で付与し、コンテナの `overflow-x-auto` を維持する
  - エラー表示を bad 系トークンへ置換する（`role` と文言は不変）
  - 完了条件: Mermaid 図が図枠付きで描画され、MermaidBlock 関連テストが無変更で green
  - _Requirements: 3.4, 8.3_
  - _Boundary: MermaidBlock_

- [ ] 4. DesignView の読書体験（本スペック唯一の構造変更）
- [x] 4.1 セクション順を「本文 → Traceability」へ入替え、順序固定テストを新契約へ更新する
  - `DesignView.tsx` article 内の `<section>` 2 ブロックを交換するのみ。testid（design-section-nav / design-body / traceability-row）・`trace-row-*` アンカー・`data-node-*` は不変
  - `DesignView.test.tsx` の順序固定テスト 1 件のみを「本文見出し → Traceability テーブル」へ更新する（5.3 の唯一の例外。他のテストは無変更）
  - 完了条件: design 画面のファーストビューに本文（Overview）が表示され、DesignView.test 全件 green
  - _Requirements: 8.1, 5.3_

- [ ] 4.2 DesignView の表装飾・ナビ sticky 化・残存色クラス置換とオーバーフロー封じ込め
  - Traceability 表: `border-line` セル罫線・`fill-soft` ヘッダ背景・コンパクトタイポグラフィ（skeleton table.matrix 準拠）
  - nav: `sticky` + top 20px 相当 + `max-h-[85vh]` + `overflow-y-auto` + `self-start`（幅 `w-56` 維持）
  - DesignView 内の残存色クラス（nav リンクの slate 等）を意味マッピング表で全置換する
  - 最長文書（sdd-core/design）の巨大シーケンス図でページ全体の横スクロールが発生しないことを確認し、破れている場合はフレックス祖先の `min-w-0` 欠落を特定して補修する（補修先はファイルを問わない。このため本タスクは Boundary 宣言を持たない）
  - 完了条件: 長文書のスクロール中もナビが追従して内部スクロールでき、body に横スクロールが出ず、viewer 配下の既存テストが（4.1 で更新した 1 件を除き）無変更で green
  - _Requirements: 4.2, 8.2, 8.3, 8.4_

- [ ] 5. 機能ビューの再スキン（意味マッピング表 + レシピの一括適用）
- [ ] 5.1 (P) specs 一覧・概要を再スキンする
  - SpecListPage / SpecOverviewPage / SpecMetaBadges / DocumentTabs の色クラスを意味マッピング表で置換し、バッジ・タブはレシピを適用する
  - ページ見出しを skeleton .page-title / .page-sub のタイポグラフィ階層へ揃える
  - 完了条件: `specs/` 配下の既存テストが無変更で green、一覧と概要がブランドパレットで表示される
  - _Requirements: 4.1, 3.1, 2.4_
  - _Boundary: FeatureReskin specs_
  - _Depends: 1.4_

- [ ] 5.2 (P) viewer の残りビューを再スキンする
  - RequirementsView / TasksView / DocumentView / SpecDocumentPage の色クラスを置換する（DesignView はタスク 4 が全て所有するため対象外）
  - 要件カード・AC 行・TOC・タスク行を skeleton 準拠の装飾へ、ページ見出しを .page-title / .page-sub 階層へ揃える
  - 完了条件: `viewer/` 配下（DesignView.test を除く）の既存テストが無変更で green
  - _Requirements: 4.2, 2.4_
  - _Boundary: FeatureReskin viewer_

- [ ] 5.3 (P) matrix を再スキンする
  - MatrixGrid / DiagnosticsPanel / MatrixPage の色クラスを置換し、focus 行は `focus-row`・uncovered 行は `uncovered-row` トークンへ
  - `UNCOVERED_ROW_CLASS` の定数名・クラス名は不変。ページ見出しを .page-title / .page-sub 階層へ揃える
  - 完了条件: `matrix/` 配下の既存テスト（UNCOVERED_ROW_CLASS 契約含む）が無変更で green
  - _Requirements: 4.3, 5.2, 2.4_
  - _Boundary: FeatureReskin matrix_

- [ ] 5.4 (P) compare / validation を再スキンする
  - ComparePage / ComparePane / ValidationList / ValidationReportPage の色クラスを置換し、ページ見出しを .page-title / .page-sub 階層へ揃える
  - `.correspondence-highlight` の付与ロジック・クラス名は不変
  - 完了条件: `compare/` `validation/` 配下の既存テストが無変更で green
  - _Requirements: 4.4, 2.4_
  - _Boundary: FeatureReskin compare, FeatureReskin validation_

- [ ] 5.5 (P) crosslink（チップ・ポップオーバー）を再スキンする
  - RefChip / JumpBackBar / CounterpartPopover の色クラスを置換し、ポップオーバーは設計のモーダル・ポップオーバー装飾規約（paper-warm 背景・影）へ
  - 完了条件: `crosslink/` 配下の既存テストが無変更で green
  - _Requirements: 3.2_
  - _Boundary: FeatureReskin crosslink_

- [ ] 5.6 (P) workflow の board / knowledge を再スキンする
  - board: パイプラインノードを approved → ok 系 / generated → warn 系へ（既存 indigo は warn へ）。knowledge: AdrStatusBadge（ステータス間 className 差分契約を維持）・steering / skills 一覧の色クラス置換
  - ページ見出しを .page-title / .page-sub 階層へ揃える
  - 完了条件: `workflow/board` `workflow/knowledge` 配下の既存テストが無変更で green
  - _Requirements: 4.5, 2.4_
  - _Boundary: FeatureReskin workflow board, FeatureReskin workflow knowledge_

- [ ] 5.7 (P) workflow の actions / help を再スキンする
  - actions: 承認・手戻りダイアログをモーダル装飾規約（`bg-overlay` オーバーレイ・paper-warm ダイアログ・影）へ、ボタンはレシピを適用する。help: フロー図・ガイドの色クラス置換
  - ページ見出しを .page-title / .page-sub 階層へ揃える
  - 完了条件: `workflow/actions` `workflow/help` 配下の既存テストが無変更で green
  - _Requirements: 3.2, 4.5, 2.4_
  - _Boundary: FeatureReskin workflow actions, FeatureReskin workflow help_
  - _Depends: 1.4_

- [ ] 6. 統合検証
- [ ] 6.1 既定パレットの残存一掃と全単体テスト
  - `client/src` の `*.tsx` への grep（slate / gray / sky / emerald / indigo / rose / amber / red / blue の数値スケール）が 0 件であることを確認し、残存があれば置換する
  - `npm test` 全件 green・`tsc --noEmit`・`eslint` 成功
  - 完了条件: grep 0 件の出力とテスト・型・lint の全件成功ログ
  - _Requirements: 1.4, 5.1, 5.3_

- [ ] 6.2 ビルドと外部 URL 不在チェック
  - `npm run build` 成功後、`e2e/check-dist-no-external-urls.ts` を実行して合格させる
  - 完了条件: チェックスクリプトの合格出力（フォント同梱後も外部 URL ゼロ）
  - _Requirements: 6.2_

- [ ] 6.3 E2E テストの実行
  - `e2e/readonly-local.spec.ts` / `review.spec.ts` を実行し全件 green
  - 完了条件: Playwright の全件成功レポート
  - _Requirements: 5.3_

- [ ] 6.4 スケルトン目視比較と読書体験の最終確認
  - skeleton-client と本番を並行起動し、4 画面（spec 一覧 / viewer の requirements・design / matrix / 承認モーダル）を目視比較し、差異はスケルトン側へ寄せる
  - design 読書体験 4 項目を最長文書で確認: ファーストビューに本文 / ページ横スクロールなし / ナビ追従 / 行長制御
  - `git status` で skeleton-client 配下が無変更であることを確認する
  - 変更が視覚表現 + Requirement 8 の範囲に限定されていることを diff で確認する
  - 完了条件: 比較・確認の証跡が記録され、差異があればスケルトン準拠へ修正済み
  - _Requirements: 5.4, 7.1, 7.2, 8.1, 8.3, 8.4, 8.5_

## Implementation Notes
- 1.2: Vite の既定 assetsInlineLimit(4KB) は小さい woff2 を data: URI 化し check-dist-no-external-urls.ts が fail する。vite.config.ts で .woff2 のみ inline 無効化済み（counterfactual ビルドで必要性実証済み）
- 1.3: `.md` ベース font-size 13.5px（skeleton 122 行）は設計の対象セレクタ外として未移植。3.1 で `md` クラス付与時に utility（text-[13.5px] 等）での補完要否を判断すること
- 3.1: `md` クラス付与時は `text-[13.5px]` を併記する規約（RawBlockView / MarkdownDoc で採用済み）。今後 `md` を付与するコンポーネントも同様にすること
