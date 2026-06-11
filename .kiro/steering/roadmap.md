# Roadmap

## Overview

EVM Studio は WBS YAML を取り込み進捗を記録して EVM メトリクスをリアルタイム可視化するローカル Web アプリ。
wbs-* スキルが生成する YAML（tasks / staffing / schedule）を入力とし、決定論的な EVM 計算エンジンと単一ワークベンチ型ダッシュボード UI を提供する。

UI の正典は `mockup/variation-a.jsx`。**3画面構成（旧）から1画面ワークベンチ + モーダル群（新）への全面リストラクチャ**を目的に、既存4スペック (`core-data-model` / `evm-engine` / `progress-tracking` / `dashboard`) を再生成する。

## Approach Decision

- **Chosen**: ローカルファースト Web アプリ（Hono + SQLite + React）+ **mockup 駆動のワークベンチ UI**
- **Why**: クラウドインフラ不要、`npm start` のみで起動、PM の毎日の状況確認・進捗反映を1画面で完結
- **Rejected alternatives**: Firebase/SaaS（クラウド依存）、CLI ツール（UI なし）、複数ページ SPA（モックアップ通りでない・遷移コスト大）

## Scope

- **In**: WBS YAML インポート、プロジェクト/タスク/メンバー管理、EVM 計算 + 前日比、進捗入力（モーダル）、単一ワークベンチダッシュボード、GanttFullscreen、ChartFullscreen、Inspector (Task/Member/Team)
- **Out**: WBS 生成（wbs-* スキルが担う）、認証・認可（ローカル限定）、xlsm インポート（将来対応）、朝報エクスポート（将来対応）

## Constraints

- Node.js 22、Hono 4 + tRPC 11 + Drizzle ORM 0.45 + React 19 + Vite 8 + TailwindCSS 4
- Anthropic SDK 不使用
- `evm-studio/` 配下に全コードを配置（`server/`, `client/`, `e2e/`）
- **UI 仕様の正典は `mockup/variation-a.jsx`**。実装は同モックアップを TSX に移植する形を取る
- 既存実装 (`evm-studio/`) は段階的に置き換える。コアロジック（EVM 計算・スキーマ）は流用、UI 層は全面書き換え

## Boundary Strategy

- **Why this split**: データモデル → 計算 → 進捗 → UI の依存方向に沿って分割。上流が固まってから下流を仕様化する
- **Shared seams to watch**:
  - Task / Member エンティティは全スペックが参照する中核
  - **前日比 (prevDay)** は evm-engine / progress-tracking / dashboard 共通の概念で、責務分担を明確にする
  - **status (active / paused / draft / archived)** は core-data-model で持ち、dashboard が表示する

## Specs (dependency order)

- [x] core-data-model -- Project/Task/Member の CRUD + SQLite スキーマ + wbs-YAML インポート。**Project.status / Member.role / 担当者カラーの追加**。Dependencies: none
- [x] evm-engine -- PV/EV/AC/SPI/CPI/EAC/CCPM バッファ計算 + クリティカルパス + **前日比 (prevDay) 計算 + 担当者別 EVM**。Dependencies: core-data-model
- [x] progress-tracking -- 日次進捗スナップショット + **過去日付指定 / 本日のAC追加（MD・h単位） / 計画線比較 / メモ**。Dependencies: core-data-model
- [x] dashboard -- **mockup/variation-a.jsx を正典とする単一ワークベンチ画面**。トップバー / 左レール / サマリストリップ（前日比トグル）/ アラートストリップ / ガント / SPIトレンド / フィーバーチャート / Inspector (Task/Member/Team) / GanttFullscreen（検索・フィルター・進捗入力サブパネル）/ ChartFullscreen。Dependencies: evm-engine, progress-tracking
- [x] sdd-core -- .kiro/ 構造化パーサー + トレーサビリティグラフ + SSE 監視 + 承認/手戻り/ADR 書込 API（UI なし）。Dependencies: none
- [x] sdd-review-ui -- スペックドキュメントビューア + 相互リンクナビゲーション + トレーサビリティマトリクス + validation レポート表示。Dependencies: sdd-core
- [x] sdd-workflow-ui -- 開発フロー俯瞰ボード + 承認/手戻り操作 UI + ヘルプ + steering/スキル(英日)/ADR 閲覧。Dependencies: sdd-core, sdd-review-ui

## 既存 spec の再生成方針

各 spec の `phase` を `implemented` のままにせず、Discovery 完了後に再生成する：

1. `brief.md` を mockup ベースで書き直す（このフェーズで完了）
2. `/kiro-spec-batch` または各 spec で `/kiro-spec-requirements` を実行して requirements / design / tasks を再生成
3. `/kiro-impl` で実装をやり直す（既存実装は段階的に置き換え）

既存実装の扱い：
- **流用**: SQLite スキーマの大半、EVM 計算純粋関数、tRPC ルーター骨格
- **書き換え**: client/src/ 全体（pages 分離 → 単一ワークベンチ）、進捗入力（独立ページ → モーダル）
- **新規**: ProjectRail, Inspector (3モード), GanttFullscreen, ChartFullscreen, SummaryStrip（前日比トグル付き）, AlertStrip

---

## Phase 2: SDD Dashboard

### Overview

cc-sdd（Kiro スペック駆動開発）の開発フローと成果物を GUI で確認・操作するローカル Web ダッシュボード。任意のリポジトリの `.kiro/` を直接読み、markdown を構造化パースして表示する**汎用ツール**（起動引数でリポジトリパスを指定）。承認レビュー時の可読性と、Req ⇄ Design ⇄ Task の双方向トレーサビリティ確認を中核価値とする。

### Approach Decision

- **Chosen**: 薄いローカル Web アプリ（Hono 4 + React 19 + Vite、**DB なし**）。`.kiro/` を chokidar で監視し SSE でホットリロード。markdown は remark (mdast) で構造化パースし、失敗箇所は生 markdown 表示にフォールバック（情報無欠落原則）
- **Why**: ファイルが唯一の真実（CLI/AI による変更が即 GUI に反映、同期問題が存在しない）。承認・手戻りの書込操作と両立。EVM Studio で実績のあるスタックの薄い構成
- **Rejected alternatives**: 静的生成（書込操作と矛盾）、VS Code 拡張（Webview の UI 表現力・配布コスト）
- **Viability 確認済み (2026-06-10)**: 全依存 MIT・保守活発。注意点: chokidar v4 は glob 非対応（ignored フィルタ使用）、Hono SSE は onAbort 後始末 + keepalive ping 必須、@xyflow/react は ^12.11 を使用

### Scope

- **In**: .kiro/ 構造化パース、トレーサビリティグラフ、スペックビューア、相互リンク、トレーサビリティマトリクス、フロー俯瞰、進捗表示、承認/手戻り操作、validation ギャップ表示、ヘルプ/オンボーディング、steering/スキル(英日)/ADR 閲覧
- **Out**: AI 実行連携（Claude Code 起動。将来候補）、リモート/マルチユーザー・認証、.kiro 以外のファイル管理、スペック再生成そのもの（CLI スキルが担う）

### Constraints

- `sdd-dashboard/` 配下に全コードを配置（`server/`, `client/`）。EVM Studio とは独立した npm パッケージ
- Node.js 22、TypeScript strict、Hono 4 + React 19 + Vite + remark + chokidar v4 + @xyflow/react ^12.11。DB 不使用
- 書込は対象リポジトリの `.kiro/` 配下のみ（パストラバーサル防止）
- **情報無欠落原則**: 構造化表示に失敗した内容は必ず生 markdown でフォールバック表示する

### Boundary Strategy

- **Why this split**: データ層（core）→ レビュー体験（review-ui）→ フロー操作（workflow-ui）の依存方向。核心価値であるレビュー UI を独立スペック化し、俯瞰・操作系と混ぜて肥大化させない
- **Shared seams to watch**:
  - トレーサビリティ ID 体系（Req x.y / Design セクション / Task x.y）は3スペック共通の中核モデル。正典は steering の trace-notation
  - 承認状態 (spec.json) は core が書込を実装し、workflow-ui が操作 UI を持つ
  - review-ui と workflow-ui は同一 SPA 内の画面群。レイアウトシェル・ルーティングの分担に注意

### Existing Spec Updates

- なし（Phase 1 スペックへの変更はない）

### Direct Implementation Candidates

- [x] trace-notation -- トレーサビリティ表記法を steering 文書化（`trace-notation.md`）し、kiro-spec-design / kiro-spec-tasks のテンプレートを正規化。参照 ID は範囲表記（`1.1-1.6`）を禁止し全列挙に統一（grep 可能性を優先。旧 spec の範囲表記はパーサーの後方互換で吸収）
- [x] adr-notation -- `.kiro/adr/` の置き場・記法（連番・status・関連 spec/要件参照）を定義（steering `adr.md` + template + ADR-0001 起票済み）
- [x] validate-output -- kiro-validate-gap / kiro-validate-design / kiro-validate-impl を改修し、結果を spec ディレクトリに validation-{gap,design,impl}.md として保存（frontmatter: type / feature / date / decision）
- [x] skill-ja -- 全22スキルの SKILL.ja.md 併置翻訳（GUI は英/日タブ切替で表示。frontmatter は英語のまま、見出し構造は EN と 1:1）

※ trace-notation / adr-notation / validate-output は **sdd-core のパース対象の正典**となるため、sdd-core の要件定義前に完了させること。

---

## Phase 3: Team Sharing (evm-studio)

### Overview

EVM Studio をローカル単独利用からチーム共有運用に移行する（GitHub Issue #2）。チーム全員が同じ URL で同一の WBS・進捗データを参照・更新できるようにし、運用コストは無料に抑える。

### Approach Decision

- **Chosen**: Cloudflare Workers + D1 への移行。Hono を Workers に移植、DB を D1 化、SPA は Workers Assets 配信。アクセス制御はチーム共有シークレット 1 つ、チーム間分離は「チームごとの別デプロイ（別 Worker + 別 D1）」で実現し権限管理コードを持たない
- **Why**: 「課金なし」を確実に満たすのは本案と無料 VM 案のみで、本案は保守ゼロ・Cloudflare 1 社完結。Issue の「権限管理が面倒」という懸念にデプロイ分離で正面から応える
- **Rejected alternatives**: Turso + 無料 PaaS（非同期化コストは同等な上コールドスタート・複数ベンダー）、無料 VM（VM 確保・構築・保守が属人的手作業）
- **Viability 確認済み (2026-06-11)**: 致命的問題なし。注意点: D1 は対話的トランザクション非対応（`db.batch()` で代替、Drizzle `db.transaction()` は実行時エラー）、pino は Workers 非互換（console JSON + Workers Logs に置換）、テーブル再作成型マイグレーションの cascade delete 誤発火に注意、D1 無料枠はアカウント 10 DB・書込 10 万行/日

### Scope

- **In**: Workers ランタイム移植、D1 移行（非同期化・batch 化・マイグレーション）、Workers Assets 配信、共有シークレット認証、定期 refetch による他者更新反映、wrangler 設定とチーム別デプロイ手順
- **Out**: ユーザー個別認証・ロール権限、リアルタイム共同編集（CRDT）、マルチテナント設計、オフライン対応、EVM 計算・UI 機能の変更

### Specs (dependency order)

- [ ] team-sharing -- Cloudflare Workers + D1 移行によるチーム共有化（共有シークレット認証 + 定期 refetch 含む）。Dependencies: core-data-model, evm-engine, progress-tracking, dashboard
