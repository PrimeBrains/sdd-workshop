# Research & Design Decisions — sdd-design-system

## Summary
- **Feature**: `sdd-design-system`
- **Discovery Scope**: Extension（既存本番クライアントのビジュアル再スキン。統合ポイント中心の light discovery）
- **Key Findings**:
  - スケルトン `skeleton-client/src/styles.css`（184行）が完全なデザイン正典。`:root` トークン 12 個 + コンポーネント装飾（sidebar / card / badge / chip / btn / tabs / matrix / .md / popover / modal）が全て具体値で定義済み
  - 本番クライアントの色クラスは計 **351 箇所**（slate 211 / amber 56 / sky 19 / emerald 19 / gray 18 / red 14 / blue 6 / rose 5 / indigo 3）。`index.css` は `@import "tailwindcss"` + ハイライト 2 クラスのみで `@theme` 未定義
  - **テストは色クラスに依存しない**（data-testid / role / aria-label / 可視テキストのみ）。例外は3つのクラス契約: ① `RawBlockView.test.tsx` / `DocBlockList.test.tsx` が failure 時 className に `"border"` 部分文字列を**含む**こと・gap 時に**含まない**ことを assert、② `MatrixGrid.test.tsx` の `UNCOVERED_ROW_CLASS` 定数、③ `AdrStatusBadge.test.tsx` がステータス間で className が異なることを比較
  - スケルトンは Inter / JetBrains Mono を**宣言のみ**で実ロードしていない（フォールバックスタックで動作）。本番もフォント定義なし（Tailwind デフォルト）

## Research Log

### スケルトンのデザイントークン全量（正典の具体値）
- **Context**: Req 1.1 / 7.2 — スケルトンを正典としてトークン化するため全値を抽出
- **Sources Consulted**: `sdd-dashboard/skeleton-client/src/styles.css`（直接読解）
- **Findings**:
  - `:root`: paper `#f7f4ec` / paper-warm `#fbf9f2` / ink `#2a2722` / ink-soft `#6b655a` / line `#e3ddcf` / brand `#7ea61f` / brand-soft `#eef3df` / ok `#5d8a3a` / warn `#c89a2d` / bad `#b8482e` / gray `#9a958a` / mono スタック
  - `:root` 外のリテラル（コンポーネント内に散在）: badge の soft 背景・ボーダー（ok `#e7efdc`/`#c9dcb4`、warn `#f7eed3`/`#e6d49a`/文字 `#8a6a14`、bad `#f6e0da`/`#e7bcae`、gray `#eceae3`）、sidebar 系（bg `#26301a`、文字 `#e9ecdf`/`#cdd5bd`、補助 `#9fae84`/`#8d9a73`、active `rgba(126,166,31,.25)` + 左罫線 3px brand）、chip（文字 `#50691a`、線 `#d2dfb0`、hover `#dfe9c4`）、focus 行 `#fdf3cf`、uncovered 行 `#f9e9e4`、`.md` の code 背景 `#efece2`、pre `#2c2a25`/`#e8e4d8`
  - 角丸スケール: 4/6/8/10/12px + 999px（badge）。影: popover `0 12px 36px rgba(0,0,0,.18)`、modal `0 18px 50px rgba(0,0,0,.25)`
- **Implications**: `:root` の 11 色 + 散在リテラルのうち再利用されるもの（soft/line 変種、sidebar 系、focus/uncovered）をトークン昇格させ、1回限りのリテラルは utility の任意値ではなくトークン参照に正規化する

### 本番クライアントの再スキン対象センサス
- **Context**: 再スキンの規模と機械的置換可能性の確認
- **Sources Consulted**: `client/src/` 全域 grep（サブエージェント調査）
- **Findings**:
  - 色クラス 351 箇所。意味的役割は安定: slate=中立、amber=警告/保留、emerald=成功/承認、sky=ready/情報、red/rose=エラー/削除、blue=主アクション（workflow のみ）、indigo=generated 状態（SpecPipelineNode のみ）、gray=ダイアログ背景（workflow actions のみ）
  - シェル: `app/AppShell.tsx`（白背景 sidebar + slate ナビ）。共有プリミティブは `shared/`（ErrorPanel red 系 / ConnectionBanner amber 系 / LoadingSkeleton slate 系）の 3 つのみで、badge/chip 相当は各 feature にインライン
  - markdown 要素は**完全無装飾**（Tailwind preflight がブラウザ既定も剥がすため、表は罫線・余白ゼロ、引用は地の文と同化 — 検証済み、postmortem #0004 の隣接事象）
  - `MermaidBlock` は `securityLevel: 'strict'`、テーマ未指定（default）
- **Implications**: className 置換は意味マッピング表で機械的に実施可能。markdown だけは utility が届かない（react-markdown 内部要素）ため、スコープ付き CSS（`.md`）の例外が必要

### テスト結合マークアップ契約
- **Context**: Req 5.1 / 5.2 / 5.3 — 壊してはいけない契約の特定
- **Sources Consulted**: `client/src/**/*.test.tsx`（74 ファイル）、`e2e/*.spec.ts` の grep
- **Findings**:
  - 色クラスへの assert はゼロ。data-testid（150+）/ aria-label（20+）/ role / 可視テキストが選択子
  - クラス契約: `RawBlockView.test.tsx:82,91,100` と `DocBlockList.test.tsx:81` — failure ラッパー className は `"border"` を含む、gap ラッパーは含まない。→ **gap ラッパーに与えるクラス名に `border` という部分文字列を含めてはならない**（`.md` は安全）
  - `MatrixGrid.test.tsx` は `UNCOVERED_ROW_CLASS` 定数経由で assert（名称維持で安全）
  - `index.css` の `.jump-highlight` / `.correspondence-highlight` は名称・役割とも維持対象（Req 5.2）
- **Implications**: 再スキンは「className の値だけを変える」「クラス契約 3 点を不変に保つ」で既存テスト全件成功（5.3）を満たせる

### フォントの自己ホスト
- **Context**: Req 1.2（Inter / JetBrains Mono 使用）と Req 6.1/6.3（外部 URL 非依存・同梱）の両立
- **Sources Consulted**: skeleton index.html / styles.css（ロード機構なしを確認）、npm registry（`npm view`）
- **Findings**:
  - スケルトンはフォントを宣言のみ（環境依存のフォールバック描画）。Req 1.2 は「Inter を用いる」と規定するため、宣言のみでは Inter 不在環境（Linux/WSL 等）で要件を満たさない
  - `@fontsource-variable/inter` 5.2.8 / `@fontsource-variable/jetbrains-mono` 5.2.8 が存在（確認済み）。woff2 を Vite が dist に同梱し、外部 URL は発生しない（`check-dist-no-external-urls` に適合）。ライセンスは OFL
  - 日本語グリフは同梱しない（Noto Sans JP のバンドルは数 MB 級）。CJK はスケルトンと同じく `'Hiragino Sans', 'Noto Sans JP'` のシステムフォールバック
- **Implications**: variable フォント 2 パッケージを devDependencies ではなく dependencies に追加し、`index.css` から `@import` する

### Tailwind v4 `@theme` によるトークン定義と既定パレットの無効化
- **Context**: Req 1.3（単一定義元）/ 1.4（slate 置換）/ 1.5（直値禁止）の実装機構
- **Sources Consulted**: Tailwind CSS v4 公式ドキュメント（CSS-first theme、`--color-*: initial` による namespace リセット）
- **Findings**:
  - v4 は `@theme { --color-paper: #f7f4ec; }` で `bg-paper` 等の utility を生成する（CSS-first、tailwind.config 不要）
  - `--color-*: initial` で**既定パレット全体を削除**できる。以後 `bg-slate-50` 等は CSS を生成しなくなり、トークン外の色の混入が構造的に不可能になる（1.4/1.5 の機械的強制）
  - `bg-brand/25` のような不透明度修飾はトークン色にもそのまま使える（sidebar active の `rgba(126,166,31,.25)` を追加トークンなしで表現可能）
- **Implications**: 既定パレット削除 + `white`/`black` のみ再定義が最小かつ最強の単一定義元になる。置換漏れは「無装飾」として即座に視認でき、grep でも検出可能

### DesignView の読書体験調査（Requirement 8 追加に伴う再 discovery）
- **Context**: design 文書ビューが「見る気が起きない」というレビューフィードバック。実画面計測と構造分析で原因を特定し Req 8 を追加
- **Sources Consulted**: 実画面計測（Playwright、`/specs/sdd-core/design`）、`DesignView.tsx` / `DesignView.test.tsx` / `AppShell.tsx` / `MermaidBlock.tsx` の読解
- **Findings**:
  - 実測: 文書全高 23,574px。Requirements Traceability 表（56 行）が高さ 2,283px でページ先頭（159px）を占有し、本文は約 2.5 画面先
  - `DesignView.tsx:207-246`: `flex` 2 カラム（nav `w-56` **非 sticky** + article）。article 内は Traceability → 本文の順
  - `DesignView.test.tsx:252` が「Traceability テーブル → 本文見出しの文書順」を固定（順序変更で更新が必要な唯一のテスト）
  - `AppShell.tsx:135` の `main` は `flex-1 p-6` のみで最大幅なし → 1440px で行長無制限
  - `MermaidBlock.tsx:75` には `overflow-x-auto` が既にあるが、シーケンス図がページを突き破る（フレックス祖先の `min-w-0` 連鎖等、封じ込めを破る要因の検証が実装時に必要）
  - スケルトンのレイアウト正典: `.main`（max-width 1280px・padding 26px 34px）、`.viewer-grid`（230px + 1fr）、`.toc`（sticky top 20px・max-height 85vh・内部スクロール）
- **Implications**: 装飾（3.4）だけでは解消不能な構造問題が 4 点（表の壁・非 sticky ナビ・行長・オーバーフロー）。Req 8 として要件化し、構造変更は DesignView 1 ファイルに限定する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. スケルトン CSS 移植 | styles.css をほぼそのまま本番に持ち込み、コンポーネントへクラス名を貼る | 視覚パリティ最速 | Tailwind utility 運用と二重体系化、既存 351 箇所と衝突、保守が分裂 | brief が明示的に否定 |
| B. `@theme` トークン + utility 置換（採用） | トークンを `@theme` に一元定義し、既存 utility クラスをトークン utility へ置換 | 既存運用維持・テスト安全・単一定義元 | 351 箇所の置換作業、頻出装飾の重複 | 頻出装飾はレシピで補完 |
| C. 共有コンポーネント化 | Badge/Chip 等を新規共有コンポーネントに抽出して差し替え | 再利用性最大 | マークアップ構造が変わりテスト破壊リスク、見た目スペックの範囲超過 | Req 5.4（視覚表現に限定）に抵触 |

## Design Decisions

### Decision: Tailwind v4 `@theme` + 既定パレット削除をトークン機構とする
- **Context**: Req 1.1–1.5。トークンの単一定義元と slate 混入の再発防止
- **Alternatives Considered**:
  1. `@theme` でトークン追加のみ（既定パレット共存）— 緩いが混入を防げない
  2. `@theme` + `--color-*: initial` で既定パレット削除 — トークン外の色が構造的に使用不能
- **Selected Approach**: 2。`client/src/index.css` に `@theme { --color-*: initial; ... }` でスケルトン由来トークンと `white`/`black` のみを定義
- **Rationale**: Req 1.5（直値・アドホック禁止）を規約でなくビルド機構で強制できる。定義元も `index.css` の 1 ファイルに閉じる（1.3）
- **Trade-offs**: 置換漏れクラスは「無スタイル」になる（ビルドエラーにはならない）。検出は目視 + grep censo で補完
- **Follow-up**: 実装時に `slate-|gray-[0-9]|sky-|emerald-|indigo-|rose-|amber-|red-[0-9]|blue-` の残存 grep が 0 件であることをタスク完了条件に含める

### Decision: フォントは @fontsource variable パッケージで自己ホスト
- **Context**: Req 1.2 / 6.1 / 6.3。スケルトンは宣言のみだが、Inter 不在環境では 1.2 を満たせない
- **Alternatives Considered**:
  1. スケルトンと同じ宣言のみ（フォールバック任せ）— 環境依存で 1.2 が不成立
  2. `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono` を同梱 — 全環境で確定的
- **Selected Approach**: 2。`index.css` で `@import` し、`--font-sans` / `--font-mono` トークンの先頭に variable フォント名を置く
- **Rationale**: Req 6.3「Web フォントを用いる場合は同梱」に正面から適合し、6.2 の dist 検査も通る
- **Trade-offs**: バンドル +数百 KB（woff2、latin 系サブセット）。日本語グリフはシステムフォールバック（スケルトンと同等）
- **Follow-up**: `check-dist-no-external-urls` をビルド後に実行して 6.2 を確認

### Decision: markdown 装飾はスコープ付き `.md` コンポーネント CSS（utility 運用の唯一の例外）
- **Context**: Req 3.4。react-markdown が生成する内部要素（h1–h4 / code / pre / table / blockquote）には className を注入しにくい
- **Alternatives Considered**:
  1. react-markdown の `components` マップで全要素に Tailwind クラスを注入 — 9+ 要素のオーバーライド増殖、`safeMarkdownOptions` の安全責務と混線
  2. `@layer components` に skeleton `.md` 相当を token 参照で移植し、markdown コンテナに `md` クラスを付与 — 変更点 3 ファイル
- **Selected Approach**: 2。`index.css` の `@layer components` に `.md` スタイル（skeleton 121–135 行のポート、色は全て `var(--color-*)` 参照）を定義。`RawBlockView` / `MarkdownDoc` のルート要素に `md` クラスを付与し、`MermaidBlock` のコンテナにはスケルトン `.mermaid-block` 相当の枠（白背景・line 罫線・角丸 8px）を utility で付与
- **Rationale**: スケルトンとセレクタ構造ごと一致させられ視覚パリティが確実。クラス名 `md` は `"border"` を含まないため RawBlockView の gap テスト契約も安全
- **Trade-offs**: utility 運用に対する例外が 1 つ増える（design.md に例外として明記し、適用範囲を `.md` 配下に限定）
- **Follow-up**: failure 装飾（amber 点線）は `border-dashed border-warn-line bg-warn-soft/40` 等のトークン utility へ置換しつつ `"border"` 部分文字列を維持

### Decision: 頻出装飾は型付きレシピ関数 `shared/ui.ts` に集約
- **Context**: Req 3.1。badge / chip / button が多数の feature にインライン重複しており、再スキン後の drift を防ぎたい
- **Alternatives Considered**:
  1. 各所に同じ utility 列をコピペ — 即日 drift する
  2. 新規共有コンポーネント（`<Badge>` 等）— マークアップ変更でテスト破壊リスク（Req 5.4 抵触）
  3. className 文字列を返す純関数レシピ（`badgeClass("ok")` 等）— マークアップ不変
- **Selected Approach**: 3。`client/src/shared/ui.ts` に `badgeClass` / `chipClass` / `btnClass` / `cardClass` を discriminated union の variant 型で定義
- **Rationale**: DOM 構造・testid・role を一切変えず（5.1/5.4）、装飾定義を 1 箇所に集約。downstream スペックの参照規約にもなる
- **Trade-offs**: 既存コンポーネント側で className 組み立てを関数呼び出しへ書き換える編集が発生（機械的）
- **Follow-up**: レシピ関数は単体テストで variant→クラス列の対応を固定する

### Decision: 意味ベースの色クラスマッピング表で一括置換
- **Context**: Req 1.4 / 4.1–4.5。351 箇所を一貫した規則で置換する
- **Selected Approach**: slate-50→paper / white・slate-100→paper-warm or line(用途別) / slate-200・300→line / slate-400・500→ink-soft / slate-600〜900→ink / amber→warn 系 / emerald→ok 系 / red・rose→bad 系 / sky・blue→brand 系 / indigo(generated)→warn 系（スケルトンの node.generated が amber 系のため）/ gray(ダイアログ)→paper-warm・line
- **Rationale**: 既存コードの色は意味的に安定使用されており、機械的な表引きで一貫置換できる
- **Trade-offs**: 個別画面でスケルトンと 1px 単位の差異は残りうる → Req 7.2（スケルトン正典）に従い実装時にスケルトン側へ寄せる
- **Follow-up**: 置換後に skeleton と並べた目視比較（board / viewer / matrix / modal の 4 画面）

### Decision: 対話ハイライト 2 クラスと Mermaid テーマは現状維持
- **Context**: Req 5.2（クラス名・役割維持）とスコープ最小化
- **Selected Approach**: `.jump-highlight` / `.correspondence-highlight` は名称・色とも不変更（直書き RGB のまま）。Mermaid は default テーマ維持で枠のみ装飾（Req 3.4 の対象は「図枠」）
- **Rationale**: ハイライトは一時的状態表示で警告色（amber/sky）の意味が確立済み。Mermaid テーマ変更は図の可読性リスクに対しリターンが薄い
- **Trade-offs**: ハイライト色がトークン体系の外に残る（コメントで出自を明記）

### Decision: Req 8 の構造変更は DesignView 1 ファイル + AppShell main 最大幅に封じ込める
- **Context**: Requirement 8（読書体験）はレイアウト変更を伴うが、スペックの本質は再スキンであり構造変更の波及を最小化したい
- **Alternatives Considered**:
  1. 専用レイアウトコンポーネント（ViewerLayout）の新設 — 抽象の追加に対し利用箇所が 1 つで過剰
  2. DesignView 内のセクションブロック交換 + nav className の sticky 化 + AppShell main の最大幅 — 既存構造の最小編集
- **Selected Approach**: 2。順序入替は `<section>` 2 ブロックの位置交換、sticky は `sticky top-5 max-h-[85vh] overflow-y-auto self-start`、最大幅は AppShell `main` に `max-w-[1280px]`（スケルトン `.main` 準拠、全画面一貫）
- **Rationale**: testid・アンカー・`data-node-*` を一切動かさず、更新が必要な既存テストを順序固定テスト 1 件に限定できる。最大幅を main に置くことで 8.5 が viewer 固有ハックにならずスケルトンのシェル設計と一致する
- **Trade-offs**: scroll-spy 等のリッチなナビ体験は見送り（Out of scope 明記）。Traceability 表が文書末尾に移ることで「表を先に見たい」ユーザーはナビからジャンプする一手間が増える（スケルトンの DesignTab も本文先頭であり正典に一致）
- **Follow-up**: Mermaid の封じ込めは `overflow-x-auto` が既にあるのに破れている実態があるため、実装時に祖先チェーンの `min-w-0` を点検し、巨大シーケンス図（sdd-core/design）で必ず実画面検証する

## Risks & Mitigations
- **置換漏れで無スタイル要素が残る**（既定パレット削除の副作用）— 残存色クラスの grep census 0 件をタスク完了条件化 + 全画面目視
- **`"border"` 部分文字列契約の踏み抜き**（RawBlockView gap テスト）— gap ラッパーへ付与するのは `md` クラスのみとし、design.md に契約として明記
- **フォント同梱によるバンドル増**— variable woff2 のみ（latin 系）で数百 KB に抑制。日本語はシステムフォールバック
- **ESLint `eslint.config.js` や E2E が想定外のクラスに依存**— 着手時に e2e/*.spec.ts の再 grep で契約を再確認（現時点ではゼロ確認済み）

## References
- `sdd-dashboard/skeleton-client/src/styles.css` — デザイン正典（トークン・装飾の出典）
- `.kiro/steering/product.md` Design Tokens — ブランド色の正当性根拠（Prime Brains）
- Tailwind CSS v4 Theme variables（CSS-first `@theme`、namespace リセット `--color-*: initial`）
- fontsource: `@fontsource-variable/inter` / `@fontsource-variable/jetbrains-mono` 5.2.8（npm view で存在確認、OFL）
- `.kiro/postmortem/defects.md` #0004 — markdown 無装飾問題の隣接事象（RawBlock 装飾の意味と適用条件）
