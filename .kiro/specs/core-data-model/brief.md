# Brief: core-data-model

## Problem

現状のスキーマには `Project.status` / `Member.role` / `Member.initials`（表示用イニシャル）/ `Project.code`（短縮コード）/ `ProgressSnapshot.note` が未定義、または不足している。モックアップ `mockup/variation-a.jsx` のプロジェクトレール（status による Dot 色分け）、Members リスト（role 表示）、Avatar（initials）、TopBar のプロジェクトコード表示が成立しない。

## Current State

- `projects` テーブル: id, name, startDate, endDate, ...（`status` / `code` 未定義）
- `members` テーブル: id, projectId, name, availabilityRate, ...（`role` / `initials` 未定義）
- `tasks` テーブル: 基本フィールドは網羅。`assignee_id` 経由でメンバー解決
- `progress_snapshots`: id, taskId, snapshotDate, progressPct, acDays（`note` 未定義 → progress-tracking spec で追加）
- `task_dependencies` / `holidays`: 既存
- WBS YAML インポート: 基本動作は実装済（最近 YYYY-MM-DD 変換バグを修正）

## Desired Outcome

- `Project.status` (`active` / `paused` / `draft` / `archived`) を保持
- `Project.code` (例: `NXP-002`) を保持し、ピッカーとレールで表示
- `Member.role` (例: `PM`, `Lead Eng`, `Engineer`, `Designer`, `QA`, `BA`, `Security`, `Analyst`) を保持
- `Member.initials` を自動生成 or 明示保存（モックアップは `田美` のような2文字日本語イニシャル）
- WBS YAML インポート側で status / code / role / initials を許容（オプショナル、デフォルト値あり）

## Approach

- Drizzle スキーマに以下を追加：
  - `projects`: `status: text` (default `'active'`), `code: text` (nullable, unique)
  - `members`: `role: text` (nullable), `initials: text` (nullable)
- WBS YAML フィールド対応表を `.kiro/steering/domain.md` に追記
- マイグレーションは新規ファイルで（既存データは status='active' / code/role/initials は NULL で OK）
- tRPC `projects.list` / `members.listByProject` のレスポンス型を更新

## Scope

- **In**:
  - Project / Member スキーマ拡張
  - マイグレーション追加
  - tRPC レスポンス型の更新
  - WBS YAML インポーターの拡張（オプショナルフィールド対応）
  - シードデータ: モックアップの5プロジェクトと同等のテストデータを `evm-studio/server/seeds/` に追加
- **Out**:
  - ProgressSnapshot 拡張（→ progress-tracking spec）
  - クリティカルパス計算（→ evm-engine）
  - UI（→ dashboard）

## Boundary Candidates

- **schema**: Drizzle スキーマ定義 + マイグレーション
- **importer**: wbs-YAML → DB 変換
- **seed**: 開発用シードデータ
- **crud-api**: tRPC ルーター（projects / tasks / members）

## Out of Boundary

- EVM 計算（→ evm-engine）
- 進捗記録（→ progress-tracking）
- UI 描画（→ dashboard）

## Upstream / Downstream

- **Upstream**: なし（最上流）
- **Downstream**:
  - `evm-engine`: スキーマ全般を参照
  - `progress-tracking`: tasks / projects を参照
  - `dashboard`: projects.status / members.role / projects.code を表示

## Existing Spec Touchpoints

- **Extends**: 既存 core-data-model spec を拡張書き直し
- **Adjacent**: progress-tracking（progress_snapshots の note カラム追加で連動）

## Constraints

- マイグレーションは破壊的変更を避ける（既存レコードを残せること）
- `Project.code` は重複可（unique 制約は付けない、運用判断）
- WBS YAML のフィールド追加は後方互換（既存 YAML をそのまま読み込める）
- TypeScript strict / Drizzle 推論型を優先
