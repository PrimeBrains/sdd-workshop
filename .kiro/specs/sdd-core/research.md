# Research & Design Decisions: sdd-core

## Summary

- **Feature**: `sdd-core`
- **Discovery Scope**: New Feature（greenfield。`sdd-dashboard/` 配下は未作成。EVM Studio とはコード共有なし）
- **Key Findings**:
  - パース対象の表記法正典（trace-notation.md / adr.md / validation レポート frontmatter）は steering と kiro-validate-* スキルに確定済み。sdd-core は解釈のみを所有する
  - approved 済み旧 spec（例 `dashboard`）の design.md Traceability テーブルには範囲表記（`1.1-1.6`, `7.1-7.11, 8.1-8.7`）が実在し、後方互換展開が必須
  - chokidar v4 は glob 非対応（`ignored` に関数/正規表現フィルタを渡す）。Hono SSE（`streamSSE`）は `onAbort` での後始末と keepalive ping が必須（roadmap Viability 確認済み 2026-06-10）

## Research Log

### 旧 spec に残る範囲表記の実態

- **Context**: 後方互換展開（要件 6.3）の対象がどの形で存在するかの確認
- **Sources Consulted**: `.kiro/specs/dashboard/design.md`（Requirements Traceability）、`.kiro/specs/*/tasks.md`
- **Findings**:
  - `1.1-1.6` 形式（同一 major・整数 minor）が支配的。`7.1-7.11, 8.1-8.7` のように 1 行に複数範囲が混在する
  - tasks.md の `_Requirements:_` は概ね全列挙だが、`4.7, 6.4, 11.2, 11.3` のような跨ぎ列挙もある
  - trace-notation.md は展開アルゴリズムを「minor を整数として両端間を列挙し、requirements.md との実在照合を行う」と規定済み
- **Implications**: ref-list パーサーはトークン単位で `ID | 範囲 | クロス spec | 解釈不能` を判別する。major が異なる範囲（`1.6-2.3`）と非整数 minor は解釈不能トークン扱いにする

### 表記正典・validation レポートの確定仕様

- **Context**: パーサーが従うべきスキーマの確認
- **Sources Consulted**: `.kiro/steering/trace-notation.md`、`.kiro/steering/adr.md`、`.kiro/adr/template.md`、kiro-validate-{gap,design,impl} SKILL.md
- **Findings**:
  - ref-list 文法: `ref-list = ID ("," SP ID)*`。クロス spec は `<feature-name>/<ID>`
  - ADR frontmatter: `id`（数値）/ `title` / `status`（proposed | accepted | deprecated | superseded）/ `date` / `specs`（配列）/ `requirements`（クロス spec 形式の配列）/ `supersedes` / `superseded_by`。ファイル名 `NNNN-<kebab-slug>.md`、4 桁連番・欠番なし
  - validation レポート frontmatter: `type`（gap | design | impl）/ `feature` / `date` は共通。`decision` は design（GO | NO-GO）と impl（GO | NO-GO | MANUAL_VERIFY_REQUIRED）のみで、**gap には存在しない**
- **Implications**: validation レポートの型は `decision` を optional にする。ADR 作成 API はテンプレート構造（Context / Decision / Consequences 必須、Alternatives 任意）をそのまま生成する

### chokidar v4 / Hono SSE の制約

- **Context**: roadmap の Viability 注意点の設計への反映
- **Sources Consulted**: roadmap.md Phase 2（Viability 確認済み 2026-06-10）、chokidar v4 changelog、Hono `streamSSE` ドキュメント
- **Findings**:
  - chokidar v4 は glob パターンを受け付けない。監視ルートをディレクトリで指定し、`ignored`（`(path, stats) => boolean` 関数）で除外する
  - `awaitWriteFinish` オプションで書込途中のイベント抑制が可能。エディタの一時ファイル（`.swp`、`~`、dotfile）は ignored で除外
  - Hono `streamSSE` はクライアント切断を `stream.onAbort` で受ける。keepalive はコメント行（`: ping`）の定期送信で実現
- **Implications**: watcher はカテゴリ分類（spec / steering / skill / adr / その他）をイベント発行側で行い、SSE 層は配信のみ担当。イベントは短時間のバーストをデバウンス（100ms 程度）してから配信する

### remark でのセクションスライスと position

- **Context**: 情報無欠落原則（要件 13.2, 13.3）の実現方式
- **Sources Consulted**: unified / remark-parse / remark-gfm / remark-frontmatter / mdast 仕様
- **Findings**:
  - mdast の全ノードは `position`（`start.line` / `start.offset` / `end.line` / `end.offset`）を持つ。GFM テーブルは `remark-gfm` で `table` ノードになる
  - 見出しノードの depth と出現順から、`heading N` 〜 次の `heading <=N` 直前までをセクションとしてスライスできる
  - 構造化に失敗した範囲は、成功した要素の position の補集合として元テキストから切り出せる（オフセットベース）
- **Implications**: パーサー出力は「position 付き構造化要素 + position 付き raw ブロック」の直列リストとし、「全要素の position 連結 = 元文書全体」を不変則としてテストで保証する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 層状アーキテクチャ（types → parsers → services → api） | 純粋関数パーサー層の上に FS アクセスを持つサービス層、最外殻に Hono ルート | パーサーが fixture で単体テスト可能。表記法解釈が 1 箇所に集約 | 層を跨ぐ型の流通設計が必要 | **採用**。brief の Boundary Candidates と一致 |
| パイプライン型（md → 中間 JSON キャッシュ → API） | パース結果をメモリ/ファイルにキャッシュ | 再パースコスト削減 | キャッシュ無効化が watcher と密結合になり「ファイルが唯一の真実」と緊張関係 | 棄却。`.kiro/` は小規模でリクエスト時パースが十分速い |

## Design Decisions

### Decision: API スタイルは REST + 共有 TypeScript 型（tRPC 不採用）

- **Context**: steering tech.md（Phase 1 / EVM Studio）は tRPC 11 を採用しているが、Phase 2 の roadmap / brief は API スタイルを規定していない。下流 2 スペック（sdd-review-ui / sdd-workflow-ui）が参照する安定契約が必要
- **Alternatives Considered**:
  1. tRPC 11 — EVM Studio と同形。エンドツーエンド型安全
  2. REST（Hono ルート） + `types/` ディレクトリの共有 DTO 型 — 契約を明示的な型とエンドポイント表で文書化
- **Selected Approach**: REST + 共有 TypeScript 型。エンドポイントは `/api/*` の JSON、契約型は `sdd-dashboard/server/src/types/` に集約してクライアントから型 import する
- **Rationale**: (1) SSE は素の HTTP エンドポイントであり tRPC subscription（WebSocket 前提）と馴染まない。(2) 下流スペックは本スペックの後に生成されるため、URL + JSON スキーマとして明示的に文書化された契約の方が参照・レビューしやすい。(3) リソース指向の読取中心 API で tRPC の RPC 性の利点が薄い。(4) 依存を Hono 4 + remark + chokidar の最小集合に保てる
- **Trade-offs**: クライアント側のフェッチ層を手書きする（型は共有されるため安全性は保たれる）。EVM Studio とのスタック差分が生じるが、別パッケージで独立しており影響なし
- **Follow-up**: sdd-review-ui / sdd-workflow-ui の design で `types/` の import 経路（パッケージ export）を確定する

### Decision: 読取はリクエスト時パース（キャッシュなし）、watcher は SSE 専用

- **Context**: 要件 2.4（変更の即時反映）と 1.4（DB なし）の両立
- **Alternatives Considered**:
  1. watcher 連動のメモリキャッシュ + 無効化
  2. リクエスト毎にファイルを読み直す
- **Selected Approach**: リクエスト毎読取。watcher はキャッシュ無効化に関与せず、SSE 通知のみを駆動する
- **Rationale**: `.kiro/` は高々数百 KB・数十ファイルで、remark パースはミリ秒オーダー。キャッシュ整合性バグ（ファイルが真実なのに古い表示）の方が高コスト
- **Trade-offs**: 大規模リポジトリでは応答時間が伸びる可能性 → 性能要件はローカル単一ユーザーであり許容
- **Follow-up**: 実測でスペック詳細 API が遅い場合のみ mtime ベースの軽量キャッシュを検討（Revalidation Trigger に記載）

### Decision: 書込はアトミック書込（temp + rename）+ 書込前パスガード

- **Context**: 要件 12.1–12.4。パストラバーサル防止と部分書込防止
- **Alternatives Considered**:
  1. 直接 `writeFile`
  2. 同一ディレクトリへ temp ファイル書込 → `rename`
- **Selected Approach**: 全書込を `safe-path` ガード（`realpath` 解決後に `.kiro/` プレフィックス検査）に通した上で、temp + rename で実行する
- **Rationale**: rename は同一ファイルシステム内で原子的であり、spec.json が不正 JSON のまま残る事故を防ぐ。symlink 経由の脱出は realpath 解決で遮断する
- **Trade-offs**: temp ファイルが watcher イベントを発生させ得る → temp ファイル命名規則（`.tmp-` プレフィックス）を ignored フィルタに含めて抑制
- **Follow-up**: ADR 連番の同時作成競合は「書込直前の再採番 + `wx` フラグ（既存時失敗）」で検出する（要件 11.5）

### Decision: spec.json の `phase` はフラグからの決定的導出で更新する

- **Context**: 承認 API（要件 9）と巻き戻し API（要件 10.1）の双方が `phase` を矛盾なく更新する必要がある
- **Selected Approach**: `phase` を approvals フラグから一意に導出する純粋関数 `derivePhase(approvals)` を定義する: tasks.approved → `tasks-approved`、tasks.generated → `tasks-generated`、design.generated → `design-generated`、requirements.generated → `requirements-generated`、いずれもなし → `initialized`
- **Rationale**: 承認・巻き戻しの 2 つの書込経路が同じ導出関数を共有することで、フラグと phase の不整合が構造的に発生しない
- **Trade-offs**: CLI 側が独自の phase 値を書いた場合は次回書込時に正規化される（許容。フラグが真実）

## Risks & Mitigations

- markdown パースの頑健性が品質の生命線 — raw フォールバック + 「全 position 連結 = 元文書」不変則の自動テストで担保（要件 13.3）
- 旧表記展開の解釈ミス（major 跨ぎ範囲等） — 解釈不能トークンとして診断に落とし、勝手に推測展開しない（要件 6.7）
- SSE 接続リーク — `onAbort` 後始末の結合テスト + 接続数を監査可能なログに出す
- chokidar のイベント重複/バースト — 100ms デバウンス + `awaitWriteFinish` で抑制。e2e 相当の結合テストで「変更 → 2 秒以内に受信」を厳密値で検証

## References

- `.kiro/steering/trace-notation.md` — 参照リスト文法・旧表記の後方互換規定（正典）
- `.kiro/steering/adr.md` + `.kiro/adr/template.md` — ADR 規約・テンプレート（正典）
- `.claude/skills/kiro-validate-{gap,design,impl}/SKILL.md` — validation レポート frontmatter 仕様
- `.kiro/adr/0001-sdd-dashboard-local-web-app.md` — DB なしローカル Web アプリ決定（本設計の前提）
- `.kiro/steering/roadmap.md` Phase 2 — スタック制約と Viability 確認（chokidar v4 / Hono SSE 注意点）
