# 要件定義書

## はじめに

EVM Studio は WBS YAML を取り込み、プロジェクト・タスク・メンバー・休日のデータを SQLite に永続化する。本スペック「core-data-model」は、その基盤となるデータモデル・CRUD API・WBS YAML インポート機能を定義する。
下流の evm-engine・progress-tracking・dashboard などすべてのスペックが参照する共通エンティティ型（Task 等）を確定し、tRPC 経由で操作できる状態にすることが目標である。

## 境界コンテキスト

- **スコープ内**: Drizzle スキーマ定義（Project / Task / Member / Holiday / TaskDependency）、マイグレーション生成、tRPC CRUD エンドポイント（Project / Task / Member / Holiday）、wbs-YAML インポートエンドポイント（tasks.yaml / staffing.yaml / schedule.yaml）、インポート時の初回 ProgressSnapshot 登録
- **スコープ外**: EVM メトリクス計算（evm-engine が担う）、日次進捗スナップショットの更新（progress-tracking が担う）、UI コンポーネント・チャート（dashboard / reporting が担う）、xlsm インポート（将来対応）
- **隣接期待値**: evm-engine は本スペックが定義する Task 型・DB テーブル構造に依存する。インポート後に Task.estimate_days・planned_start・planned_end が正しく登録されていることを前提に PV 計算を行う。progress-tracking は本スペックが登録した初回 ProgressSnapshot を起点として進捗を更新する。

---

## 要件

### 要件 1: SQLite スキーマ定義

**目的:** プロジェクト管理者として、プロジェクト・タスク・メンバー・休日・タスク依存関係を SQLite に永続化したい。これにより EVM 計算と進捗管理の基盤となるデータを一元管理できる。

#### 受け入れ基準

1. The EVM Studio shall define a `projects` table with columns: `id` (INTEGER PRIMARY KEY), `name` (TEXT NOT NULL), `start_date` (TEXT NOT NULL), `end_date` (TEXT NOT NULL), `created_at` (INTEGER timestamp), `updated_at` (INTEGER timestamp).
2. The EVM Studio shall define a `tasks` table with columns: `id`, `project_id` (FK to projects), `external_id` (TEXT, wbs-YAML の "T001" 形式), `name`, `estimate_days` (REAL), `planned_start` (TEXT), `planned_end` (TEXT), `actual_start` (TEXT nullable), `actual_end` (TEXT nullable), `parent_id` (INTEGER nullable FK to tasks), `assignee_id` (INTEGER nullable FK to members), `level` (INTEGER), `sort_order` (INTEGER), `is_buffer` (INTEGER boolean), `is_leaf` (INTEGER boolean), `remarks` (TEXT nullable), `created_at`, `updated_at`.
3. The EVM Studio shall define a `members` table with columns: `id`, `project_id` (FK to projects), `external_id` (TEXT), `name` (TEXT NOT NULL), `availability_rate` (REAL NOT NULL, 0.0〜1.0), `assignment_start` (TEXT), `assignment_end` (TEXT), `created_at`, `updated_at`.
4. The EVM Studio shall define a `holidays` table with columns: `id`, `project_id` (FK to projects), `date` (TEXT NOT NULL).
5. The EVM Studio shall define a `task_dependencies` table with columns: `id`, `task_id` (FK to tasks), `depends_on_task_id` (FK to tasks).
6. The EVM Studio shall define a `progress_snapshots` table with columns: `id`, `task_id` (FK to tasks), `snapshot_date` (TEXT NOT NULL), `progress_pct` (REAL NOT NULL, 0〜100), `ac_days` (REAL NOT NULL, default 0), `created_at`.
7. When the application starts with an empty or outdated database, the EVM Studio shall apply Drizzle ORM migrations automatically to bring the schema up to date.
8. The EVM Studio shall enforce referential integrity via foreign key constraints (SQLite `PRAGMA foreign_keys = ON`).

---

### 要件 2: Project CRUD

**目的:** プロジェクト管理者として、プロジェクトを tRPC 経由で作成・取得・更新・削除したい。これにより複数プロジェクトを管理できる。

#### 受け入れ基準

1. When a valid project name, start_date, end_date が指定されると, the EVM Studio API shall create a new project record and return the created project with its generated id.
2. The EVM Studio API shall return a list of all projects when `projects.list` が呼び出されると.
3. When `projects.getById` が有効な id で呼び出されると, the EVM Studio API shall return the matching project.
4. If `projects.getById` で存在しない id が指定されると, the EVM Studio API shall return a NOT_FOUND error (AppError code: `PROJ_NOT_FOUND`).
5. When `projects.update` が有効な id と更新フィールドで呼び出されると, the EVM Studio API shall persist the changes and return the updated project.
6. When `projects.delete` が有効な id で呼び出されると, the EVM Studio API shall delete the project and all its associated tasks, members, holidays, and dependencies.
7. The EVM Studio API shall validate all project input fields with Zod schemas and return a BAD_REQUEST error for invalid input.

---

### 要件 3: Task CRUD

**目的:** プロジェクト管理者として、プロジェクト内のタスクを tRPC 経由で作成・取得・更新・削除したい。これにより WBS 構造を管理できる。

#### 受け入れ基準

1. When `tasks.create` が有効な project_id・name・estimate_days・planned_start・planned_end で呼び出されると, the EVM Studio API shall create a new task record and return it with its generated id.
2. When `tasks.listByProject` が有効な project_id で呼び出されると, the EVM Studio API shall return all tasks belonging to that project, ordered by sort_order.
3. When `tasks.getById` が有効な id で呼び出されると, the EVM Studio API shall return the matching task.
4. If `tasks.getById` で存在しない id が指定されると, the EVM Studio API shall return a NOT_FOUND error (AppError code: `TASK_NOT_FOUND`).
5. When `tasks.update` が有効な id と更新フィールドで呼び出されると, the EVM Studio API shall persist the changes and return the updated task.
6. When `tasks.delete` が有効な id で呼び出されると, the EVM Studio API shall delete the task and its associated task_dependencies and progress_snapshots.
7. The EVM Studio API shall validate all task input fields with Zod schemas; invalid input shall return a BAD_REQUEST error.
8. The EVM Studio API shall accept optional `is_buffer` flag (boolean) on task create/update to mark CCPM buffer tasks.
9. The EVM Studio API shall accept optional `is_leaf` flag (boolean) on task create/update to prevent double-counting in aggregation.

---

### 要件 4: Member CRUD

**目的:** プロジェクト管理者として、プロジェクトのメンバーを tRPC 経由で管理したい。これにより稼働率を考慮した PV 計算の基礎データを揃えられる。

#### 受け入れ基準

1. When `members.create` が有効な project_id・name・availability_rate で呼び出されると, the EVM Studio API shall create a new member record and return it.
2. When `members.listByProject` が有効な project_id で呼び出されると, the EVM Studio API shall return all members of that project.
3. When `members.update` が有効な id と更新フィールドで呼び出されると, the EVM Studio API shall persist the changes and return the updated member.
4. When `members.delete` が有効な id で呼び出されると, the EVM Studio API shall delete the member; tasks referencing the member shall have their assignee_id set to NULL.
5. The EVM Studio API shall validate that `availability_rate` is a number in the range [0.0, 1.0]; values outside this range shall return a BAD_REQUEST error.
6. The EVM Studio API shall validate all member input fields with Zod schemas and return a BAD_REQUEST error for invalid input.

---

### 要件 5: Holiday CRUD

**目的:** プロジェクト管理者として、プロジェクトの休日カレンダーを tRPC 経由で管理したい。これにより PV の営業日計算に休日を反映できる。

#### 受け入れ基準

1. When `holidays.create` が有効な project_id と date（YYYY-MM-DD 形式）で呼び出されると, the EVM Studio API shall create a new holiday record and return it.
2. When `holidays.listByProject` が有効な project_id で呼び出されると, the EVM Studio API shall return all holidays for that project in ascending date order.
3. When `holidays.delete` が有効な id で呼び出されると, the EVM Studio API shall delete the holiday record.
4. If `holidays.create` で不正な日付形式（YYYY-MM-DD 以外）が指定されると, the EVM Studio API shall return a BAD_REQUEST error.

---

### 要件 6: WBS YAML インポート

**目的:** プロジェクト管理者として、wbs-* スキルが生成した tasks.yaml / staffing.yaml / schedule.yaml をインポートして SQLite に格納したい。これにより手動入力なしでプロジェクトデータを初期化できる。

#### 受け入れ基準

1. When `import.wbsYaml` が project_id・tasks.yaml 内容・staffing.yaml 内容・schedule.yaml 内容で呼び出されると, the EVM Studio API shall parse all three YAML files using js-yaml SAFE_LOAD and upsert all entities into the database.
2. When YAML インポート中に tasks.yaml の `tasks[].parent_id` が指定されると, the EVM Studio API shall resolve the `external_id` reference to the DB `id` and set `Task.parent_id` correctly.
3. When YAML インポート中に tasks.yaml の `tasks[].depends_on[]` が指定されると, the EVM Studio API shall insert corresponding records into `task_dependencies`, resolving external_id to DB id.
4. When YAML インポート中に tasks.yaml の `tasks[].assignee` が指定されると, the EVM Studio API shall resolve the member `external_id` to the DB `id` and set `Task.assignee_id`.
5. When YAML インポート中に tasks.yaml の `tasks[].progress_pct` が指定されると, the EVM Studio API shall create an initial ProgressSnapshot record for the task with `snapshot_date` equal to the import timestamp date.
6. When `staffing.meta.public_holidays[]` が指定されると, the EVM Studio API shall upsert holiday records for the project.
7. If YAML ファイルが不正な構造（必須フィールド欠落等）を含む場合, the EVM Studio API shall return a BAD_REQUEST error (AppError code: `IMPORT_INVALID_YAML`) without partial writes—the import shall be atomic (all or nothing).
8. If YAML インポートで同一 project_id に対して再インポートが行われると, the EVM Studio API shall upsert (update existing records by external_id, insert new ones) rather than duplicating.
9. When YAML インポートが完了すると, the EVM Studio API shall return a summary object containing counts of upserted projects, tasks, members, holidays, dependencies, and snapshots.
10. The EVM Studio API shall reject YAML files that fail SAFE_LOAD parsing and return a BAD_REQUEST error (AppError code: `IMPORT_PARSE_ERROR`).

---

### 要件 7: エラーハンドリングと型安全性

**目的:** 開発者として、明確なエラーコードと型安全な API を利用したい。これにより下流スペックの実装が安全かつ予測可能になる。

#### 受け入れ基準

1. The EVM Studio API shall use only error codes defined in `server/src/errors/codes.ts` (AppError pattern); hardcoded string literals shall not be used in throw statements.
2. The EVM Studio API shall convert AppError instances to TRPCError at the tRPC router boundary, preserving the original AppError as the cause.
3. The EVM Studio shall never use `any` type in TypeScript; all Drizzle-inferred types shall be used directly.
4. The EVM Studio API shall export TypeScript types for each entity (`Project`, `Task`, `Member`, `Holiday`, `ProgressSnapshot`, `TaskDependency`) derived from Drizzle schema inference for use by downstream specs.
5. The EVM Studio shall validate all tRPC procedure inputs with Zod schemas before any database operation.

