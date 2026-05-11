# Research & Design Decisions: progress-tracking

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

---

## Summary
- **Feature**: `progress-tracking`
- **Discovery Scope**: Extension（既存システム `core-data-model` への機能追加）
- **Key Findings**:
  - `ProgressSnapshot` テーブルは `core-data-model` の `schema.ts` で既に定義済み。新規テーブル追加は不要、マイグレーションも core-data-model 側で管理されている。
  - `AppError` と `ErrorCode` は `server/src/errors/codes.ts` 単一ファイルに同居している（`core-data-model` の設計書では別ファイルだったが実装は統合されている）。新規エラーコードはこのファイルに追加する。
  - クライアントは React 19 + TanStack Query 5 + tRPC クライアント構成。データフェッチは `hooks/` に封じ込め、ページコンポーネントはフックを呼ぶだけにする。
  - `progress.record` は upsert（INSERT OR REPLACE / on conflict do update）が必要。Drizzle の `insert().onConflictDoUpdate()` を使用する。
  - "最新スナップショット" の定義は `snapshot_date` が最大のレコード。SQLite では `MAX(snapshot_date)` でサブクエリまたは Drizzle の `sql` ヘルパーで実装できる。

## Research Log

### 既存コードベース分析

- **Context**: progress-tracking は core-data-model に依存するため、既存の DB スキーマ・ルーター・エラー定義を確認した。
- **Findings**:
  - `server/src/errors/codes.ts` — `ErrorCode` 定数と `AppError` クラスが同一ファイルに定義されている。`SNAP_` プレフィックスのエラーコードをここに追加する。
  - `server/src/index.ts` — Hono エントリーポイントは存在するが tRPC はまだマウントされていない。progress-tracking 実装時には tRPC セットアップも含める必要がある（core-data-model 実装と並行 or 先行して行われる想定）。
  - `client/src/App.tsx` — ほぼ空のスキャフォールド。tRPC クライアント・TanStack Query プロバイダーの設定も progress-tracking の実装スコープに含める必要がある。
  - `evm-studio/` 配下に `server/node_modules/` が存在し、drizzle-orm・zod・pino など必要な依存は既にインストール済み。
- **Implications**:
  - tRPC のサーバー・クライアント統合セットアップが前提として必要。タスクに「tRPC セットアップ」を基盤タスクとして含める。
  - `server/src/router.ts` が存在しないため新規作成が必要。

### Drizzle upsert パターン調査

- **Context**: `(task_id, snapshot_date)` のユニーク制約に対して upsert が必要。
- **Findings**:
  - Drizzle ORM 0.45 では `db.insert(table).values(...).onConflictDoUpdate({ target: [col1, col2], set: {...} })` でユニーク制約に対する upsert が可能。
  - SQLite の `INSERT OR REPLACE` に対応する。conflict 時に更新するフィールドは `progress_pct` と `ac_days` のみ（`task_id`, `snapshot_date`, `id`, `createdAt` は変更しない）。
- **Implications**:
  - `progress.record` の実装で `onConflictDoUpdate` を使用する。

### "最新スナップショット" クエリ設計

- **Context**: `progress.getLatest` では各タスクの最新（最大 snapshot_date）スナップショットを1件ずつ返す必要がある。
- **Findings**:
  - SQLite では `GROUP BY task_id HAVING MAX(snapshot_date)` または相関サブクエリで実装できる。
  - Drizzle の `sql` ヘルパーと `max()` 集計を使ったサブクエリアプローチが型安全。
  - `(task_id, snapshot_date)` に複合インデックスを張ることでクエリ性能を改善できる。
- **Implications**:
  - `progress.getLatest` は Drizzle の `sql` ヘルパーを使った相関サブクエリ、または `max()` + JOIN で実装する。スキーマに複合インデックスを追加する。

## Architecture Pattern Evaluation

| オプション | 説明 | 強み | リスク/制限 |
|-----------|------|------|------------|
| core-data-model 踏襲 | api/progress.ts ルーター + services/ なし（ロジックが薄い） | 一貫性、シンプル | ロジックが増えたとき分離コストが発生 |
| services/progress.ts 追加 | ビジネスロジックをサービス層に分離 | テスト容易性、純粋関数化 | このフェーズでは過剰設計の可能性 |

**選択**: ロジックが薄いため `api/progress.ts` にルーター直結で実装する。バリデーションは Zod、クエリは Drizzle で完結させる。将来ロジックが増えたら `services/progress-snapshot.ts` に切り出す。

## Design Decisions

### Decision: project_id を ProgressSnapshot に含めるか

- **Context**: `ProgressSnapshot` スキーマは `task_id` のみを持ち `project_id` は持たない。getByDate・getLatest は `project_id` でフィルタが必要。
- **Alternatives Considered**:
  1. `progress_snapshots` に `project_id` カラムを追加
  2. `tasks` テーブルと JOIN して `project_id` でフィルタ
- **Selected Approach**: `tasks` との JOIN でフィルタ（スキーマは変更しない）
- **Rationale**: `ProgressSnapshot` は `task_id` で一意に識別でき、`project_id` は `tasks` テーブルが正規管理する。冗長カラムを避けてデータ整合性を保つ。
- **Trade-offs**: JOIN のクエリコスト増加（SQLite で問題になるレベルではない）

### Decision: tRPC プロシージャ命名

- **Context**: steering/structure.md の命名規則に合わせる必要がある。
- **Selected Approach**:
  - `progress.record` — upsert（`create` よりも「記録」の意味を表す動詞）
  - `progress.getByDate` — 日付指定一覧取得
  - `progress.getLatest` — 最新スナップショット一覧
  - `progress.getHistory` — 単一タスクの履歴
- **Rationale**: ドメイン用語（スナップショット記録）に合致した動詞を使用し、コレクション取得は `get` + 形容詞/前置詞で統一。

## Risks & Mitigations

- tRPC セットアップが progress-tracking 実装時に未完成のリスク — タスクに「tRPC サーバー・クライアントセットアップ」を基盤タスクとして明示する
- core-data-model の `schema.ts` が実装されていない場合、`progress_snapshots` テーブルが存在しない — tasks.md の Depends に core-data-model 実装完了を前提として記述する
- `MAX(snapshot_date)` クエリの性能 — `(task_id, snapshot_date)` 複合インデックスで対応

## References

- [Drizzle ORM - insert().onConflictDoUpdate()](https://orm.drizzle.team/docs/insert#on-conflict-do-update) — SQLite upsert パターン
- [tRPC 11 - Hono Adapter](https://trpc.io/docs/server/adapters/hono) — Hono 統合方法
- [TanStack Query v5 + tRPC](https://trpc.io/docs/client/tanstack-query) — クライアント統合
