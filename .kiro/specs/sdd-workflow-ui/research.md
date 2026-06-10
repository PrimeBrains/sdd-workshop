# Research & Design Decisions: sdd-workflow-ui

## Summary

- **Feature**: `sdd-workflow-ui`
- **Discovery Scope**: Extension（既存契約への統合が中心。sdd-core の API 契約と sdd-review-ui の SPA シェル拡張契約に接続する）
- **Key Findings**:
  - sdd-review-ui が本スペック向けに 3 つの拡張点を明示的に予約済み: (a) ルート名前空間 `/board` `/help` `/steering` `/skills` `/adr`、(b) `SpecActionSlot`（レビュー画面ヘッダへの操作挿入点）、(c) `SseInvalidationBridge` の `InvalidationMap` 追加点。本スペックはこの 3 点にのみ接続すれば同居できる
  - sdd-core の書込 API は 2 エンドポイント（`PUT /api/specs/:feature/approvals` / `POST /api/specs/:feature/rollback`）で、バリデーション（生成済み前提・フェーズ順序・パス制限）と `phase` / `ready_for_implementation` の導出はすべてサーバー側が実施する。クライアントは結果（`SpecSummary` または `ApiError`）を表示するだけでよい
  - sdd-review-ui の ApiClient は GET 限定（8.1 の構造的保証）であり、書込はそこへ追加できない。本スペックが書込専用クライアントを別ファイルとして追加する必要がある

## Research Log

### sdd-review-ui の拡張契約の確認

- **Context**: 同一 SPA 内に画面・操作を追加するため、シェル境界の正確な把握が必要
- **Sources Consulted**: `.kiro/specs/sdd-review-ui/design.md`（Boundary Commitments / Shell 層 / SseInvalidationBridge）
- **Findings**:
  - ルートレジストリは `RouteObject[]` 合成方式。`RESERVED_NAMESPACES = ["/board", "/help", "/steering", "/skills", "/adr"]` が定数宣言され、連結点は `app/router.tsx` の 1 箇所
  - `SpecActionSlot` は Context ベースの `register(render: (ctx: SpecActionContext) => ReactNode): () => void` API。`SpecActionContext` は `{ feature, document }` を提供する
  - `useChangeEvents(map?: InvalidationMap)` の `InvalidationMap` は `Partial<Record<ChangeEvent["category"], (event) => QueryKey[]>>`。category `steering` / `skill` / `adr` は review-ui では写像なし（本スペックが追加する前提）
  - `fetch` の直接使用は ESLint ルールで `api/client.ts` 以外禁止（review-ui の規律）
- **Implications**: 本スペックの統合は「router 連結 1 箇所 + main.tsx での Slot 登録と map 注入 + AppShell ナビへのリンク追加 + ESLint 許可 1 件」に限定できる。review-ui のソース変更を最小化し、Revalidation Triggers の対象を明確にする

### sdd-core 書込 API・読取 API の契約確認

- **Context**: 承認・手戻り・ナレッジビューアが消費する契約の確定
- **Sources Consulted**: `.kiro/specs/sdd-core/design.md`（API Contract 表 / ApprovalWriter / RollbackWriter / Error Categories）
- **Findings**:
  - `PUT /api/specs/:feature/approvals` body `{ phase: PhaseName; approved: boolean }` → `SpecSummary`。エラー: 404 / 409（`APPROVAL_NOT_GENERATED`, `APPROVAL_ORDER_VIOLATION`）/ 422 / 500
  - `POST /api/specs/:feature/rollback` body `{ targetPhase: PhaseName }` → `SpecSummary`。エラー: 404 / 422 / 500。巻き戻しのセマンティクスは「対象フェーズ `approved = false`、後続フェーズ両フラグ `false`、`ready_for_implementation = false`」（sdd-core 10.1, 10.2）
  - ナレッジ系読取: `GET /api/steering`(`SteeringDocSummary[]`) / `GET /api/steering/:name`(`SteeringDoc`) / `GET /api/skills`(`SkillSummary[]`, en/ja 有無付き) / `GET /api/skills/:name`(`SkillDoc`, `ja` nullable) / `GET /api/adr`(`AdrSummary[]`) / `GET /api/adr/:id`(`AdrDoc`)
  - 書込成功の SSE 通知は専用配信ではなく、watcher のファイル変更検知経路に一本化されている → 書込成功後の画面反映は「mutation レスポンスの即時反映 + SSE 由来の invalidate」の二重経路になる
- **Implications**: 巻き戻し影響の事前表示はサーバーと同一のルール（決定論的）をクライアント側で純粋関数として再現できる。ただし正は常にサーバーで、実行結果は返却された `SpecSummary` で上書きする

### @xyflow/react ^12.11 の適合性

- **Context**: パイプラインボードのフロー可視化ライブラリ選定（brief 指定）
- **Sources Consulted**: roadmap.md Phase 2（Viability 確認済み 2026-06-10）、@xyflow/react 公式ドキュメント（既知情報）
- **Findings**:
  - MIT ライセンス。npm からローカルバンドルでき、外部 CDN 不要（ローカル完結制約と適合）
  - 必要機能（カスタムノード、静的レイアウト、`fitView`、ノードクリックハンドラ、`nodesDraggable=false` 等の読取専用化）はすべて無償機能。Pro 機能（自動レイアウト UI 等）は不要
  - 自動レイアウトライブラリ（dagre / elk）は導入しない。スペック一覧は「1 スペック = 1 レーン」の規則的な格子配置であり、座標は純粋関数で決定論的に計算できる
- **Implications**: `buildBoardGraph` 純粋関数で `SpecSummary[]` → ノード/エッジ + 座標を生成し、描画層は React Flow に委ねる。レイアウト依存を増やさない

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 機能スライス + 拡張点接続（採用） | `workflow/` 名前空間配下に board / actions / help / knowledge をスライスし、review-ui の 3 拡張点へ接続 | review-ui と境界が明確。review-ui 側変更が連結点のみ | review-ui の拡張契約変更時に追従が必要（Revalidation Triggers で管理） | review-ui と同型のパターンで一貫性が高い |
| 独立 SPA（別ポート） | workflow 画面を別アプリとして配信 | 完全分離 | 同一 SPA 制約（brief）違反。ナビ・SSE・キャッシュが二重化 | brief 制約違反のため棄却 |
| review-ui ソースへの直接追記 | features/ 配下へ画面を混在させる | 短期は楽 | スペック境界が崩れ、review-ui の Boundary Commitments と矛盾 | 棄却 |

## Design Decisions

### Decision: 書込専用クライアントを 1 ファイルに分離する

- **Context**: review-ui の `ApiClient` は GET 限定（review-ui 8.1 の構造的保証）で、`fetch` 直接使用は ESLint で `api/client.ts` のみに許可されている。本スペックは PUT / POST が必要
- **Alternatives Considered**:
  1. review-ui の `client.ts` へ `put` / `post` を追加 — review-ui の「読み取り専用の構造的保証」を破壊する
  2. 書込専用クライアント `workflow/api/writeClient.ts` を新設し、ESLint 許可リストへ 1 ファイル追加する
- **Selected Approach**: 案 2。`writeClient.ts` は承認・巻き戻しの 2 操作に対応するメソッドのみを公開し、汎用の `post<T>(path, body)` を export しない
- **Rationale**: 「書込能力を持つファイルは SPA 内に 1 つ」という規律を維持しつつ、review-ui の GET 限定契約を不変に保つ。要件 9.4（承認・手戻り以外の状態変更手段を提供しない）の構造的保証になる
- **Trade-offs**: fetch ラッパが 2 つ（GET 用 / 書込用）になるが、エラー正規化ロジック（`NormalizedApiError` 化）は review-ui の形と同一にして概念を増やさない
- **Follow-up**: ESLint 設定変更が review-ui のテストに影響しないこと（既存ルールの緩和ではなく許可ファイルの追加であること）を実装時に確認

### Decision: 巻き戻し影響の事前表示はクライアント側純粋関数で導出する

- **Context**: 要件 3.2 は「実行前に」影響範囲（解除されるフェーズ・ready 喪失）の表示を求める。sdd-core にはドライラン API がない
- **Alternatives Considered**:
  1. sdd-core にドライラン API を追加依頼 — 上流契約の変更が必要で、決定論的なルールに対して過剰
  2. sdd-core の RollbackWriter セマンティクス（10.1, 10.2）をクライアント側で純粋関数 `computeRollbackImpact` として再現する
- **Selected Approach**: 案 2。入力は表示中の `SpecSummary.approvals` と選択された `targetPhase`、出力は「承認解除されるフェーズ」「生成フラグごとクリアされる後続フェーズ」「ready_for_implementation が false になること」
- **Rationale**: ルールは「対象 approved=false、後続両フラグ false、ready=false」という固定の決定論で、サーバーと食い違う余地が乏しい。実行後は必ずサーバー返却の `SpecSummary` で上書きするため、万一の乖離も収束する
- **Trade-offs**: sdd-core 側ルール変更時に追従が必要 → 本スペックの Revalidation Triggers に明記
- **Follow-up**: 単体テストで sdd-core design.md 記載のセマンティクスと厳密一致させる

### Decision: 次アクション案内（CLI コマンド導出)を単一モジュールに集約する

- **Context**: 承認後（2.5）と手戻り後（3.5）の両方で「次に打つ CLI コマンド」を案内する。ヘルプ画面（4.2）にも同じコマンド知識が登場する
- **Selected Approach**: フェーズ → コマンドの対応を `nextCommand.ts` 1 箇所に定義する（承認後: requirements 承認 → `/kiro-spec-design`、design 承認 → `/kiro-spec-tasks`、tasks 承認 → `/kiro-impl`。手戻り後: 巻き戻し先フェーズの再生成コマンド）。ヘルプコンテンツも同モジュールを参照する
- **Rationale**: Single Source of Truth（structure.md）。コマンド改名時の修正箇所を 1 つにする
- **Trade-offs**: なし（小さな対応表）

### Decision: ナレッジ文書の描画は review-ui の markdown 基盤を再利用する

- **Context**: steering / スキル / ADR 本文の描画には安全な markdown 描画（XSS 遮断・外部 URL 遮断・情報無欠落）が必要
- **Alternatives Considered**:
  1. workflow 側で react-markdown を直接使う — 安全設定（urlTransform 等）が二重実装になり、設定差分が脆弱性になる
  2. review-ui の `MarkdownDoc` / `DocBlockList` / `RawBlockView` を import して使う
- **Selected Approach**: 案 2。安全描画の所有者は review-ui のまま（review-ui design「raw markdown の安全描画は RawBlockView のみが所有」と整合）
- **Rationale**: 同一 SPA 内の共有基盤であり、依存方向（workflow → review 基盤）は一方向で循環しない
- **Trade-offs**: review-ui の markdown コンポーネント契約変更が本スペックに波及する → Revalidation Triggers 管理

### Decision: ボードのグラフモデルは「1 スペック = 1 レーン × 4 フェーズノード」とする

- **Context**: 要件 1.1 はフェーズ進行と承認状態のグラフィカルなフロー表示を求める。スペック間依存関係は sdd-core の API（`SpecSummary`）に含まれない
- **Alternatives Considered**:
  1. スペック間依存グラフ — データソースに依存情報がなく、roadmap.md の独自パースが必要（sdd-core の boundary 外の解釈をクライアントが持つことになる）
  2. スペックごとの横方向フェーズパイプライン（requirements → design → tasks → implementation の 4 ノード + 進行エッジ）を縦に並べる
- **Selected Approach**: 案 2。各フェーズノードは状態（未生成 / 生成済み未承認 / 承認済み）を色とバッジで表現し、現在フェーズを強調。スペックラベルのクリックでレビュー画面へ遷移
- **Rationale**: spec.json 由来のデータ（API 契約内）だけで構成でき、cc-sdd フローの形そのもの（ヘルプ画面の解説と同型）を視覚化できる
- **Trade-offs**: スペック間依存は表示されない（将来 sdd-core が依存情報を提供すれば拡張可能）

## Risks & Mitigations

- review-ui の拡張契約（ルートレジストリ / SpecActionSlot / InvalidationMap）が実装中に形を変えるリスク — 両スペックの Revalidation Triggers を相互参照し、契約型を `import type` で共有してコンパイルエラーで検知する
- クライアント側 rollback 影響予測と sdd-core 実装の乖離リスク — 純粋関数の単体テストを sdd-core design.md のセマンティクス文言に対して書き、実行後はサーバー返却値で必ず上書きする
- @xyflow/react のバンドルサイズ・スタイル読込 — `@xyflow/react/dist/style.css` をローカル import（外部 CDN なし）。board ルートのみで使用するため遅延ロード（route-level code splitting）を許容する

## References

- `.kiro/specs/sdd-core/design.md` — API 契約表・書込セマンティクス・ErrorCode 語彙
- `.kiro/specs/sdd-review-ui/design.md` — SPA シェル拡張契約（ルートレジストリ / SpecActionSlot / InvalidationMap）
- `.kiro/steering/roadmap.md` Phase 2 — 技術制約・@xyflow/react viability 確認
- `.kiro/steering/adr.md` — ADR frontmatter / 本文セクション規約（ビューアの表示対象）
- [React Flow (@xyflow/react)](https://reactflow.dev/) — MIT。カスタムノード・静的レイアウトは無償機能
