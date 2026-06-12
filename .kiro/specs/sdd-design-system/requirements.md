# Requirements Document

## Introduction
sdd-dashboard アプリには、リッチで見やすい「スケルトン」（`skeleton-client`、`src/styles.css` の手書きデザインシステム）と、汎用グレー（slate）中心で素っ気ない「本番」（`client`）の2つのフロントエンドが存在し、両者のビジュアルデザインが乖離している。本スペックは、スケルトンのデザイン（paper/ink/brand のトークン、濃緑サイドバー、統一されたカード/バッジ/チップ/タブ等）を「正」と定め、本番の見た目をそれに一致させる**ビジュアル再スキン**を対象とする。

スケルトンの配色・フォントは steering の Prime Brains ブランドトークン（`product.md` の Design Tokens: 濃緑 `#7ea61f` / paper `#f7f4ec` / Inter・JetBrains Mono 等）と一致しており、これを正典とする根拠となる。

対象は原則として**見た目のみ**であり、本番の機能・画面構成・情報設計・テストの振る舞いは維持する。ただし、ドキュメントビューア（特に design 文書）は現状「56行のトレーサビリティ表が先頭を占有し本文が2画面以上先」「図が画面を突き破る」「ナビが追従しない」「行長無制限」という可読性の問題を抱えており、装飾だけでは解消できない。このため Requirement 8 に定める範囲に限り、読書体験のためのレイアウト調整（表示順序・追従表示・オーバーフロー制御・行長制御）をスコープに含める。スケルトンはデザインの参照源としてリポジトリに残す。デザイントークンの具体的な実装機構（本番採用の Tailwind v4 のテーマ機能を用いる方針）の詳細は design フェーズで確定する。

## Boundary Context
- **In scope**: 本番クライアントの全画面をスケルトンのデザイン言語に一致させる再スキン。デザイントークン（色・タイポグラフィ）の単一定義化と、シェル・共有プリミティブ・各機能ビューへの適用。ドキュメントビューアの可読性レイアウト調整（design 文書のセクション表示順・ナビの追従表示・埋め込み要素のオーバーフロー制御・本文の行長制御。Requirement 8 に定める範囲に限定）。
- **Out of scope**: 機能追加・挙動変更・Requirement 8 に定める範囲を超える画面構成や情報設計の変更。バックエンド/API/データモデルの変更。スケルトンにあって本番に無い画面・レイアウトの機能的取り込み。skeleton-client 自体の改変。新規画面・新規ナビゲーション項目の追加。スクロール連動のセクションハイライト等の新規インタラクション。
- **Adjacent expectations**: 既存の単体テスト（`client/src/**/*.test.tsx`）・E2E（`sdd-dashboard/e2e/*.spec.ts`）が依存するマークアップ契約（`data-testid` / `aria-label` / `role` / 可視テキスト / インタラクション用クラス）に依存し、それらを壊さない。例外は Requirement 8.1 の表示順変更に伴い**旧順序を固定している既存テスト**（例: `DesignView.test.tsx` の「Traceability テーブル → 本文見出しが文書順で描画される」）のみで、新仕様の順序を検証するよう更新する。デザインの正典は `skeleton-client/src/styles.css`。ローカル完結方針（外部 URL 非依存）を継承する。

## Requirements

### Requirement 1: デザイントークンの統一
**Objective:** ダッシュボード閲覧者として、全画面で一貫したリッチな配色とタイポグラフィを使いたい。視認性が高く一貫したデザイン言語で内容を読めるようにするため。

#### Acceptance Criteria

1. The sdd-dashboard client shall adopt the same color palette as the skeleton (`skeleton-client/src/styles.css`), including paper / paper-warm / ink / ink-soft / line / brand / brand-soft and the status colors ok / warn / bad / gray.
   - 和訳: sdd-dashboard クライアントは、スケルトン（`skeleton-client/src/styles.css`）と同一の配色（paper / paper-warm / ink / ink-soft / line / brand / brand-soft、および状態色 ok / warn / bad / gray）を採用する。
2. The sdd-dashboard client shall use Inter (including Japanese fallback) for body text and JetBrains Mono for code and identifiers.
   - 和訳: sdd-dashboard クライアントは、本文フォントに Inter（日本語フォールバック含む）、コード・識別子に JetBrains Mono を用いる。
3. When any screen is rendered, the sdd-dashboard client shall apply colors and typography from design tokens that originate from a single source of definition.
   - 和訳: いずれかの画面を描画したとき、sdd-dashboard クライアントは、単一の定義元に由来するデザイントークンから配色・タイポグラフィを適用する。
4. The sdd-dashboard client shall replace the existing generic gray (slate)-centric palette with the brand palette (paper / ink / brand).
   - 和訳: sdd-dashboard クライアントは、既存の汎用グレー（slate）中心の配色をブランドパレット（paper / ink / brand）へ置き換える。
5. If a new color or font needs to be applied, then the sdd-dashboard client shall reference a defined token instead of an ad-hoc literal value.
   - 和訳: 新たな色・フォントの適用が必要になった場合、sdd-dashboard クライアントは、アドホックな直値ではなく定義済みトークンを参照する。

### Requirement 2: アプリシェルの視覚的一致
**Objective:** ダッシュボード閲覧者として、スケルトンと同じシェル（サイドバー・ヘッダ・ナビ）の見た目にしたい。アプリ全体の第一印象と操作領域がリッチに感じられるようにするため。

#### Acceptance Criteria

1. The sdd-dashboard client shall display the sidebar with the same dark-olive background and light text as the skeleton.
   - 和訳: sdd-dashboard クライアントは、サイドバーをスケルトンと同じ濃緑系背景＋淡色テキストで表示する。
2. When a navigation item becomes active (selected), the sdd-dashboard client shall apply the same active styling as the skeleton (brand-color emphasis, left border, etc.).
   - 和訳: ナビゲーション項目が選択（アクティブ）状態になったとき、sdd-dashboard クライアントは、スケルトンと同じアクティブ表現（ブランド色の強調・左罫線等）を適用する。
3. The sdd-dashboard client shall match the header (app name, repository name, action slot) to the skeleton tone (warm paper background and borders).
   - 和訳: sdd-dashboard クライアントは、ヘッダ（アプリ名・リポジトリ名・操作スロット）をスケルトンのトーン（warm paper 背景・罫線）に一致させる。
4. The sdd-dashboard client shall display page headings (title and subtitle) with the same typographic hierarchy as the skeleton.
   - 和訳: sdd-dashboard クライアントは、ページ見出し（タイトル・サブタイトル）をスケルトン同等のタイポグラフィ階層で表示する。

### Requirement 3: 共有 UI プリミティブの視覚統一
**Objective:** ダッシュボード閲覧者として、カード・バッジ・チップ・モーダル等の共通部品が統一された見た目であってほしい。どの画面でも一貫した部品体験が得られるようにするため。

#### Acceptance Criteria

1. The sdd-dashboard client shall match cards, badges, chips, and buttons to the skeleton definitions (rounded corners, colors, borders, and status colors ok / warn / bad / gray).
   - 和訳: sdd-dashboard クライアントは、カード・バッジ・チップ・ボタンをスケルトン定義（角丸・配色・境界・状態色 ok / warn / bad / gray）に一致させる。
2. The sdd-dashboard client shall display modals and popovers (such as the reference-selection menu) with the same styling as the skeleton (warm paper background, shadow, and semi-transparent overlay).
   - 和訳: sdd-dashboard クライアントは、モーダルおよびポップオーバー（参照選択メニュー等）をスケルトンと同じ装飾（warm paper 背景・影・半透明オーバーレイ）で表示する。
3. The sdd-dashboard client shall display the error panel and the connection-status banner using the brand palette status colors (such as bad / warn).
   - 和訳: sdd-dashboard クライアントは、エラーパネル・接続状態バナーをブランドパレットの状態色（bad / warn 等）で表示する。
4. The sdd-dashboard client shall match Markdown rendering (headings, code, blockquotes, tables, and Mermaid diagram frames) to the skeleton `.md` styles.
   - 和訳: sdd-dashboard クライアントは、Markdown 表示（見出し・コード・引用・表・Mermaid 図枠）をスケルトンの `.md` スタイルに一致させる。

### Requirement 4: 各機能ビューへのデザイン適用
**Objective:** ダッシュボード閲覧者として、すべての機能画面がスケルトン準拠で表示されてほしい。一部の画面だけ素っ気ないという不整合をなくすため。

#### Acceptance Criteria

1. The sdd-dashboard client shall match the spec list and spec overview to the skeleton appearance (cards, badges, and row layout).
   - 和訳: sdd-dashboard クライアントは、スペック一覧・スペック概要をスケルトンの見た目（カード・バッジ・行レイアウト）に一致させる。
2. The sdd-dashboard client shall match the document viewer (tabs, requirement cards, acceptance-criteria rows, table of contents, and task rows) to the skeleton styling.
   - 和訳: sdd-dashboard クライアントは、ドキュメントビューア（タブ・要件カード・受入基準行・目次/TOC・タスク行）をスケルトンの装飾に一致させる。
3. The sdd-dashboard client shall match the traceability matrix (table, uncovered-row highlight, and focus-row highlight) to the skeleton colors.
   - 和訳: sdd-dashboard クライアントは、トレーサビリティマトリクス（表組み・未カバー行・フォーカス行のハイライト）をスケルトンの配色に一致させる。
4. The sdd-dashboard client shall match the compare view and the validation report to the skeleton tone.
   - 和訳: sdd-dashboard クライアントは、比較ビューおよび検証レポートをスケルトンのトーンに一致させる。
5. Where workflow screens (board / help / steering / skills / adr) are included, the sdd-dashboard client shall apply the same design language to them.
   - 和訳: ワークフロー系画面（board / help / steering / skills / adr）が含まれる場合、sdd-dashboard クライアントは、それらにも同一のデザイン言語を適用する。

### Requirement 5: 機能・構造・テストの非破壊
**Objective:** 開発・運用担当者として、再スキンが既存の機能とテストを壊さないことを保証したい。安全に見た目だけを刷新できるようにするため。

#### Acceptance Criteria

1. The sdd-dashboard client shall not change existing `data-testid` / `aria-label` / `role` attributes or visible text.
   - 和訳: sdd-dashboard クライアントは、既存の `data-testid` / `aria-label` / `role` / 可視テキストを変更しない。
2. The sdd-dashboard client shall preserve the names and roles of the existing interaction classes (`.jump-highlight` / `.correspondence-highlight` / `.uncovered-row`).
   - 和訳: sdd-dashboard クライアントは、既存のインタラクション用クラス（`.jump-highlight` / `.correspondence-highlight` / `.uncovered-row`）の名称と役割を維持する。
3. When the existing unit tests and E2E are run after the re-skin, the sdd-dashboard client shall make them all pass, where tests that pin the previous section order changed by Requirement 8.1 may be updated to assert the new specified order.
   - 和訳: 再スキン後に既存の単体テストおよび E2E を実行したとき、sdd-dashboard クライアントは、それらを全件成功させる。ただし Requirement 8.1 が変更するセクション表示順を固定していたテストに限り、新仕様の順序を検証するよう更新してよい。
4. The sdd-dashboard client shall not change screen composition, information architecture, or functional behavior beyond the scope defined in Requirement 8, and shall limit all other changes to visual presentation.
   - 和訳: sdd-dashboard クライアントは、Requirement 8 に定める範囲を超えて画面構成・情報設計・機能挙動を変更せず、それ以外の変更を視覚表現に限定する。

### Requirement 6: ローカル完結・外部依存なし
**Objective:** オフライン環境の利用者として、インターネット接続なしでデザインが完全に表示されてほしい。現場環境でも見た目が崩れないようにするため。

#### Acceptance Criteria

1. The sdd-dashboard client shall not depend on external URLs (such as web font CDNs) for applying colors and fonts.
   - 和訳: sdd-dashboard クライアントは、配色・フォントの適用にあたり外部 URL（Web フォント CDN 等）へ依存しない。
2. When the build artifact is inspected, the sdd-dashboard client shall pass the no-external-URL check (`e2e/check-dist-no-external-urls.ts`).
   - 和訳: ビルド成果物を検査したとき、sdd-dashboard クライアントは、外部 URL 不在チェック（`e2e/check-dist-no-external-urls.ts`）に合格する。
3. Where web fonts are used, the sdd-dashboard client shall provide them self-hosted (bundled).
   - 和訳: Web フォントを用いる場合、sdd-dashboard クライアントは、それを同梱（self-host）して提供する。

### Requirement 7: スケルトンのデザイン参照源としての保持
**Objective:** 今後 UI を拡張する開発者として、スケルトンが「デザインの正」として残ってほしい。将来の UI もこの基準に揃えられるようにするため。

#### Acceptance Criteria

1. The sdd-dashboard project shall retain skeleton-client as the design reference source and shall not modify or delete it in this work.
   - 和訳: sdd-dashboard プロジェクトは、skeleton-client をデザインの参照源として保持し、本作業で改変・削除しない。
2. If a styling discrepancy is found between production and the skeleton, then the design policy shall treat the skeleton as canonical.
   - 和訳: 本番とスケルトンで装飾の差異が判明した場合、デザイン方針はスケルトンを正典として優先する。

### Requirement 8: ドキュメントビューアの読書体験
**Objective:** ダッシュボード閲覧者として、design のような長大な構造化文書を「読む気になる」画面で通読・レビューしたい。先頭の表の壁・画面を突き破る図・追従しないナビ・無制限の行長といった可読性の障害を取り除くため。

#### Acceptance Criteria

1. When a design document is displayed, the sdd-dashboard client shall present the document body (Overview onward) first and place the Requirements Traceability table after the body as a dedicated section.
   - 和訳: design ドキュメントを表示したとき、sdd-dashboard クライアントは、本文（Overview 以降）を先頭に表示し、Requirements Traceability 表は本文の後の専用セクションとして配置する。
2. The sdd-dashboard client shall render the Requirements Traceability table with the skeleton matrix-table styling (cell borders, header background, and compact typography).
   - 和訳: sdd-dashboard クライアントは、Requirements Traceability 表をスケルトンの matrix 表装飾（セル罫線・ヘッダ背景・コンパクトなタイポグラフィ）で描画する。
3. Where an embedded element (Mermaid diagram, code block, or table) exceeds the content column width, the sdd-dashboard client shall contain the overflow with horizontal scrolling inside that element's frame and shall not cause page-level horizontal scrolling.
   - 和訳: 埋め込み要素（Mermaid 図・コードブロック・表）がコンテンツカラム幅を超える場合、sdd-dashboard クライアントは、その要素の枠内の横スクロールでオーバーフローを収め、ページ全体の横スクロールを発生させない。
4. While the user scrolls a design document, the sdd-dashboard client shall keep the section navigation visible as a sticky sidebar with its own internal scrolling (per the skeleton `.toc` definition).
   - 和訳: design ドキュメントのスクロール中、sdd-dashboard クライアントは、セクションナビをスケルトンの `.toc` 定義に準じた sticky サイドバー（内部スクロール付き）として表示し続ける。
5. The sdd-dashboard client shall constrain the document body to a readable maximum width consistent with the skeleton layout (`.main` max-width and the two-column viewer grid).
   - 和訳: sdd-dashboard クライアントは、ドキュメント本文をスケルトンのレイアウト（`.main` の最大幅と 2 カラムの viewer グリッド）に整合する読みやすい最大幅に制約する。
