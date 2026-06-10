# Research & Design Decisions

## Summary
- **Feature**: `sdd-review-ui`
- **Discovery Scope**: New Feature（sdd-dashboard クライアントの新規 SPA。ただし上流 sdd-core の API 契約に強く拘束される Extension 的性格を持つ）
- **Key Findings**:
  - sdd-core design.md の API 契約表（14 エンドポイント）のうち、本スペックが消費するのは読取系 5 つ（`/api/repo`, `/api/specs`, `/api/specs/:feature`, `/api/specs/:feature/trace`, `/api/events`）のみ。書込 3 エンドポイントと steering / skills / adr 読取は sdd-workflow-ui の領分
  - 契約型は `sdd-dashboard/server/src/types/` に集約済み（`SpecSummary` / `SpecDetail` / `TraceGraph` / `ChangeEvent` / `DocBlock` / `ApiError` 等）。クライアントは tsconfig パスエイリアスで**型のみ** import する（ランタイム依存なし）
  - 情報無欠落原則のクライアント側責務は「`DocBlock` union の `raw` ブロックを必ず文書順の位置に描画すること」に帰着する。サーバー側で「position 連結 = 元文書全体」が不変則として保証済みのため、クライアントは並び順を保って全ブロックを描画すれば欠落しない
  - `dangerouslySetInnerHTML` 禁止下での生 markdown 描画は react-markdown（hast → React 要素直接生成、デフォルトで raw HTML 非描画）で成立する

## Research Log

### 生 markdown フォールバックの安全な React レンダリング
- **Context**: brief の制約「`dangerouslySetInnerHTML` 禁止（生 markdown フォールバックも React 要素として安全にレンダリング）」をどう実現するか
- **Sources Consulted**: react-markdown README / unified エコシステム（sdd-core が remark を採用済み）
- **Findings**:
  - react-markdown は markdown → mdast → hast → React 要素を `createElement` で直接生成する。`dangerouslySetInnerHTML` を内部でも使用しない
  - デフォルトで raw HTML ノードはスキップされる（`rehype-raw` を入れない限り HTML は描画されない）→ `<script>` 等は不活性なまま
  - remark-gfm を併用すれば GFM テーブル（design の Traceability 表が raw fallback に落ちた場合）も表として描画できる
  - `urlTransform` でリンク/画像 URL をフィルタできる → 外部 URL の画像読み込みを遮断しローカル完結（8.2）を守れる
- **Implications**: RawBlockView を react-markdown + remark-gfm + URL フィルタで実装。MIT・ローカル完結・remark 系でサーバーと方言が揃う

### ルーティングライブラリ
- **Context**: 1.4（URL によるビュー復元）と workflow-ui との同一 SPA 同居にルーターが必要
- **Sources Consulted**: React Router v7（library mode）/ TanStack Router の比較
- **Findings**:
  - React Router v7 の library mode（`createBrowserRouter` + `RouteObject[]`）は `RouteObject` 配列の合成だけで画面群を追加でき、workflow-ui がルートを後付けする「ルートレジストリ」方式と相性が良い
  - TanStack Router は型安全だがコード生成/プラグイン前提の構成が重く、薄いローカルツールには過剰
- **Implications**: React Router v7 を採用。ルート定義は `app/router.tsx` の레지ストリ 1 箇所に集約し、workflow-ui 向けの名前空間を予約する

### SSE 消費と TanStack Query の無効化設計
- **Context**: 7.1〜7.4（自動反映・無関係ビューの非破壊・再接続）の実現方式
- **Sources Consulted**: sdd-core design.md（`GET /api/events`, `event: change`, `ChangeEvent` スキーマ、15 秒 keepalive）/ TanStack Query invalidation ドキュメント
- **Findings**:
  - `ChangeEvent` は `category`（spec / steering / skill / adr / other）と `feature`（specs 配下のみ非 null）を持つ → category=spec のイベントだけを対象に、`feature` 単位でクエリキーを選択的に無効化できる
  - ブラウザ標準 `EventSource` は自動再接続を内蔵する。`onerror` 時に readyState を見て切断インジケータを出し、`onopen` で全クエリを再検証すれば 7.3 を満たせる
  - 無効化はキー単位（`['specs']` / `['spec', feature]` / `['trace', feature]`）で行えば、表示中でないリソースのイベントは active observer がなく再取得が走らない（7.4）。TanStack Query の `refetchType: 'active'` で表示中ビューのみ即時再取得
- **Implications**: 「ChangeEvent → クエリキー集合」の写像を 1 モジュール（SseInvalidationBridge）に集約。steering / skill / adr / other カテゴリは本スペックでは無効化対象を持たない（workflow-ui が将来同ブリッジに写像を追加する）

### 契約型の共有方法
- **Context**: sdd-core の `src/types/` を「下流 UI が import する公開契約」とする取り決め（sdd-core design.md Boundary Commitments）
- **Findings**:
  - モノレポ内の同一パッケージ参照は (a) npm workspace 化、(b) tsconfig `paths` エイリアスで型のみ参照、の 2 案
  - (b) は `import type` に限定すればランタイム依存ゼロでビルドにも server コードが混入しない。Vite は型 import を消去する
- **Implications**: `@contracts/*` → `../server/src/types/*` のエイリアスを張り、ESLint で `@contracts` からの値 import（`import type` 以外）を禁止する

### 相互リンクのアンカー解決
- **Context**: 3.3（ジャンプ先スクロール + ハイライト）と 5.4（マトリクスからの遷移）に共通する位置解決
- **Findings**:
  - sdd-core の `TraceGraph.nodes` は `NodeRef`（requirement=`id`、design=`name`、task=`id`）で識別される。ビューア側が各構造化要素に決定的な DOM アンカー ID（例 `req-1.2` / `design-<slug>` / `task-3.2`）を払い出せば、グラフのノード → DOM 要素を一意に解決できる
  - design 要素はコンポーネント名 or Traceability 行ラベルのため、セクション見出しタイトルとの正規化照合（trim + 小文字化 + slug 化）が必要。照合失敗時は「ドキュメント先頭 + 見つからなかった旨の表示」へフォールバック（情報無欠落と同じ思想で黙って無視しない）
- **Implications**: アンカー ID 規約を `navigation/anchors.ts` の純粋関数に集約し、全ビューアとマトリクス・比較ビューが同一規約を共有する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 機能スライス + 共有基盤層（採用） | api / trace / navigation / markdown を共有基盤とし、画面を features/ 配下に機能単位で分割 | 画面間の独立性が高く workflow-ui の同居が容易。共有層が契約解釈を 1 箇所に集約 | 共有層の肥大化に注意 | structure.md の「データフェッチは hooks に封じ込め」を踏襲 |
| ページ単位モノリス | ページごとに取得・描画を自己完結 | 初速が出る | RefChip・アンカー規約・SSE 無効化が画面ごとに重複分裂する | 不採用 |
| 状態管理ライブラリ集中型 (Redux 等) | 全状態をストアに集約 | — | サーバーキャッシュは TanStack Query が既に担う。二重管理になる | 不採用 |

## Design Decisions

### Decision: レイアウトシェルとルーティングの所有権を sdd-review-ui に置く
- **Context**: sdd-review-ui と sdd-workflow-ui は同一 SPA（roadmap の Shared seams）。シェル・ルーター・SSE 基盤を誰が作るか決めないと両スペックが衝突する
- **Alternatives Considered**:
  1. 共通シェルを第 3 のスペックに切り出す — スペック数が増え、Wave 2 で実体のない殻だけが先行する
  2. workflow-ui がシェルを作り review-ui は画面のみ — 依存方向（review-ui → workflow-ui）が roadmap の依存順（workflow-ui depends on review-ui）と逆転する
  3. review-ui がシェル + ルートレジストリ + SSE ブリッジを作り、workflow-ui はルート追加とスロット注入で同居する（採用）
- **Selected Approach**: 本スペックが `sdd-dashboard/client/` パッケージそのもの（Vite scaffolding・AppShell・router・QueryClient・SSE ブリッジ）を所有。workflow-ui 向けに (a) ルート名前空間（`/board` `/help` `/steering` `/skills` `/adr`）の予約、(b) スペック画面ヘッダの `SpecActionSlot` 拡張点、(c) SseInvalidationBridge への写像追加点、を契約として公開する
- **Rationale**: roadmap の依存順（sdd-workflow-ui depends on sdd-review-ui）と一致し、レビュー画面が単独で完結動作する（読み取り専用 MVP として成立）
- **Trade-offs**: シェル変更が workflow-ui の再検証を誘発する（Revalidation Triggers に明記）
- **Follow-up**: workflow-ui の design 時にスロット契約・ルートレジストリ I/F を再検証する

### Decision: トレーサビリティの双方向インデックスはクライアントで「展開」のみ行い「解釈」しない
- **Context**: brief の Out of Boundary「core のグラフをそのまま描画する。独自解釈をしない」と、UI 都合の逆引き（Req → tasks / task → Reqs）の両立
- **Alternatives Considered**:
  1. UI が requirements/design/tasks の参照表記を再パースする — sdd-core と解釈が分裂する（明確に禁止されている）
  2. `TraceGraph.edges` から両方向 Map を構築する純粋関数（採用）
- **Selected Approach**: `traceIndex.ts` が `TraceGraph` の nodes / edges / diagnostics を入力に、`NodeRef` をキーとした両方向隣接 Map と診断ルックアップを構築する。エッジ・診断の追加・削除・再判定は一切しない（sdd-core design の Postcondition「edges から両方向インデックスをクライアント側で構築可能な完全列挙」に依拠）
- **Rationale**: 5.5（独自判定をしない）を構造的に保証しつつ O(1) 逆引きを得る
- **Trade-offs**: グラフが不完全なら画面も不完全になる — それが正しい挙動（診断表示が補完する）
- **Follow-up**: sdd-core の `TraceGraph` 形状変更時は本インデックスを追従（Revalidation Triggers）

### Decision: 自動更新は「クエリ無効化」一本に絞り、差分パッチをしない
- **Context**: 7.2 の「AI 生成中のリアルタイム閲覧」で、イベントごとに全文再取得するか差分適用するか
- **Alternatives Considered**:
  1. SSE ペイロードに差分を載せて部分更新 — sdd-core の `ChangeEvent` は差分を持たない（契約外）
  2. 変更イベント → 該当クエリ無効化 → 全文再取得（採用）
- **Selected Approach**: ChangeEvent をトリガーに該当キーを invalidate し、TanStack Query の再取得・キャッシュ置換に任せる。サーバーは毎リクエスト読取（sdd-core 1.4）のため常に最新が返る
- **Rationale**: ローカル単一ユーザー・ファイルサイズ高々数百 KB の前提で全文再取得のコストは無視できる。差分管理の複雑性を持ち込まない
- **Trade-offs**: 大量バースト時に再取得が頻発し得る → sdd-core 側の 100ms デバウンスと、クライアント側の invalidate 集約（同一 tick 内の重複排除）で抑制
- **Follow-up**: E2E でファイル連続変更時の表示追従とスクロール維持を確認

### Decision: 比較ビューの対応ハイライトはトレースグラフ由来の対応のみ扱う
- **Context**: 4.3 の「対応箇所ハイライト」の対応関係の定義
- **Selected Approach**: 対応関係 = traceIndex の隣接（requirement ⇄ design 要素 ⇄ task）に限定する。テキスト類似度等のヒューリスティック対応付けはしない
- **Rationale**: 「core のグラフをそのまま描画」の境界に忠実。決定的でテスト可能
- **Trade-offs**: グラフに現れない暗黙の対応は光らない — トレーサビリティ記法の改善で解決すべき問題であり UI で補わない
- **Follow-up**: なし

## Risks & Mitigations
- design 要素名（`NodeRef.name`）とセクション見出しの照合が表記ゆれで外れる — slug 正規化を 1 関数に集約し、照合失敗時は明示フォールバック表示（黙って無視しない）。単体テストで実 spec の名称を fixture 化
- 大きな design.md（500 行超）の描画性能 — `DocBlock` 単位の memo 化。ローカル単一ユーザーのため目標は「再取得後 1 秒以内に再描画」程度に留める
- react-markdown のバージョン更新で HTML 取り扱いが変わるリスク — 「`<script>` を含む markdown が文字列として表示される」ことを固定の単体テストで担保
- workflow-ui との同居でシェルが汚れる — SpecActionSlot とルートレジストリ以外の結合点を作らない（design の Boundary Commitments に明記）

## References
- `.kiro/specs/sdd-core/design.md` — API 契約表・公開契約型・`ChangeEvent` スキーマ（本スペックの上流正典）
- `.kiro/steering/trace-notation.md` — ID 体系・リンク切れの定義（表示語彙として参照。解釈は sdd-core が実装）
- `.kiro/steering/roadmap.md` Phase 2 — 技術制約（React 19 + Vite、DB なし、情報無欠落原則）
- `.kiro/steering/testing-conventions.md` — 厳密値アサート・偽 pass 防止・データフロー結合テスト
- react-markdown（MIT）/ React Router v7（MIT）/ TanStack Query 5（MIT）公式ドキュメント
