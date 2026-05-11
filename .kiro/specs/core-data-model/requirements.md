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
   *EVM Studio は `projects` テーブルを定義する（カラム: `id` INTEGER PRIMARY KEY、`name` TEXT NOT NULL、`start_date` TEXT NOT NULL、`end_date` TEXT NOT NULL、`created_at` INTEGER timestamp、`updated_at` INTEGER timestamp）。*
2. The EVM Studio shall define a `tasks` table with columns: `id`, `project_id` (FK to projects), `external_id` (TEXT, wbs-YAML の "T001" 形式), `name`, `estimate_days` (REAL), `planned_start` (TEXT), `planned_end` (TEXT), `actual_start` (TEXT nullable), `actual_end` (TEXT nullable), `parent_id` (INTEGER nullable FK to tasks), `assignee_id` (INTEGER nullable FK to members), `level` (INTEGER), `sort_order` (INTEGER), `is_buffer` (INTEGER boolean), `is_leaf` (INTEGER boolean), `remarks` (TEXT nullable), `created_at`, `updated_at`.
   *EVM Studio は `tasks` テーブルを定義する（カラム: `id`、`project_id`（projects への FK）、`external_id`（TEXT、wbs-YAML の "T001" 形式）、`name`、`estimate_days`（REAL）、`planned_start`（TEXT）、`planned_end`（TEXT）、`actual_start`（TEXT nullable）、`actual_end`（TEXT nullable）、`parent_id`（INTEGER nullable FK to tasks）、`assignee_id`（INTEGER nullable FK to members）、`level`（INTEGER）、`sort_order`（INTEGER）、`is_buffer`（INTEGER boolean）、`is_leaf`（INTEGER boolean）、`remarks`（TEXT nullable）、`created_at`、`updated_at`）。*
3. The EVM Studio shall define a `members` table with columns: `id`, `project_id` (FK to projects), `external_id` (TEXT), `name` (TEXT NOT NULL), `availability_rate` (REAL NOT NULL, 0.0〜1.0), `assignment_start` (TEXT), `assignment_end` (TEXT), `created_at`, `updated_at`.
   *EVM Studio は `members` テーブルを定義する（カラム: `id`、`project_id`（projects への FK）、`external_id`（TEXT）、`name`（TEXT NOT NULL）、`availability_rate`（REAL NOT NULL、0.0〜1.0）、`assignment_start`（TEXT）、`assignment_end`（TEXT）、`created_at`、`updated_at`）。*
4. The EVM Studio shall define a `holidays` table with columns: `id`, `project_id` (FK to projects), `date` (TEXT NOT NULL).
   *EVM Studio は `holidays` テーブルを定義する（カラム: `id`、`project_id`（projects への FK）、`date`（TEXT NOT NULL））。*
5. The EVM Studio shall define a `task_dependencies` table with columns: `id`, `task_id` (FK to tasks), `depends_on_task_id` (FK to tasks).
   *EVM Studio は `task_dependencies` テーブルを定義する（カラム: `id`、`task_id`（tasks への FK）、`depends_on_task_id`（tasks への FK））。*
6. The EVM Studio shall define a `progress_snapshots` table with columns: `id`, `task_id` (FK to tasks), `snapshot_date` (TEXT NOT NULL), `progress_pct` (REAL NOT NULL, 0〜100), `ac_days` (REAL NOT NULL, default 0), `created_at`.
   *EVM Studio は `progress_snapshots` テーブルを定義する（カラム: `id`、`task_id`（tasks への FK）、`snapshot_date`（TEXT NOT NULL）、`progress_pct`（REAL NOT NULL、0〜100）、`ac_days`（REAL NOT NULL、デフォルト 0）、`created_at`）。*
7. When the application starts with an empty or outdated database, the EVM Studio shall apply Drizzle ORM migrations automatically to bring the schema up to date.
   *空またはバージョンが古いデータベースでアプリケーションが起動した場合、EVM Studio は Drizzle ORM マイグレーションを自動適用してスキーマを最新状態にする。*
8. The EVM Studio shall enforce referential integrity via foreign key constraints (SQLite `PRAGMA foreign_keys = ON`).
   *EVM Studio は外部キー制約（SQLite `PRAGMA foreign_keys = ON`）により参照整合性を強制する。*

---

### 要件 2: Project CRUD

**目的:** プロジェクト管理者として、プロジェクトを tRPC 経由で作成・取得・更新・削除したい。これにより複数プロジェクトを管理できる。

#### 受け入れ基準

1. When a valid project name, start_date, and end_date are specified, the EVM Studio API shall create a new project record and return the created project with its generated id.
   *有効な project name・start_date・end_date が指定されると、API は新規プロジェクトを作成し、生成 id 付きで返す。*
2. When `projects.list` is called, the EVM Studio API shall return a list of all projects.
   *`projects.list` が呼び出されると、API はすべてのプロジェクト一覧を返す。*
3. When `projects.getById` is called with a valid id, the EVM Studio API shall return the matching project.
   *`projects.getById` が有効な id で呼び出されると、API は該当プロジェクトを返す。*
4. If `projects.getById` is called with a non-existent id, the EVM Studio API shall return a NOT_FOUND error (AppError code: `PROJ_NOT_FOUND`).
   *`projects.getById` に存在しない id が指定されると、API は NOT_FOUND エラー（AppError code: `PROJ_NOT_FOUND`）を返す。*
5. When `projects.update` is called with a valid id and update fields, the EVM Studio API shall persist the changes and return the updated project.
   *`projects.update` が有効な id と更新フィールドで呼び出されると、API は変更を永続化し、更新後のプロジェクトを返す。*
6. When `projects.delete` is called with a valid id, the EVM Studio API shall delete the project and all its associated tasks, members, holidays, and dependencies.
   *`projects.delete` が有効な id で呼び出されると、API はそのプロジェクトと関連するすべてのタスク・メンバー・休日・依存関係を削除する。*
7. The EVM Studio API shall validate all project input fields with Zod schemas and return a BAD_REQUEST error for invalid input.
   *API はすべてのプロジェクト入力フィールドを Zod スキーマで検証し、不正な入力には BAD_REQUEST エラーを返す。*

---

### 要件 3: Task CRUD

**目的:** プロジェクト管理者として、プロジェクト内のタスクを tRPC 経由で作成・取得・更新・削除したい。これにより WBS 構造を管理できる。

#### 受け入れ基準

1. When `tasks.create` is called with a valid project_id, name, estimate_days, planned_start, and planned_end, the EVM Studio API shall create a new task record and return it with its generated id.
   *`tasks.create` が有効な project_id・name・estimate_days・planned_start・planned_end で呼び出されると、API は新規タスクを作成し、生成 id 付きで返す。*
2. When `tasks.listByProject` is called with a valid project_id, the EVM Studio API shall return all tasks belonging to that project, ordered by sort_order.
   *`tasks.listByProject` が有効な project_id で呼び出されると、API はそのプロジェクトに属するすべてのタスクを sort_order 順で返す。*
3. When `tasks.getById` is called with a valid id, the EVM Studio API shall return the matching task.
   *`tasks.getById` が有効な id で呼び出されると、API は該当タスクを返す。*
4. If `tasks.getById` is called with a non-existent id, the EVM Studio API shall return a NOT_FOUND error (AppError code: `TASK_NOT_FOUND`).
   *`tasks.getById` に存在しない id が指定されると、API は NOT_FOUND エラー（AppError code: `TASK_NOT_FOUND`）を返す。*
5. When `tasks.update` is called with a valid id and update fields, the EVM Studio API shall persist the changes and return the updated task.
   *`tasks.update` が有効な id と更新フィールドで呼び出されると、API は変更を永続化し、更新後のタスクを返す。*
6. When `tasks.delete` is called with a valid id, the EVM Studio API shall delete the task and its associated task_dependencies and progress_snapshots.
   *`tasks.delete` が有効な id で呼び出されると、API はそのタスクと関連する task_dependencies・progress_snapshots を削除する。*
7. The EVM Studio API shall validate all task input fields with Zod schemas; invalid input shall return a BAD_REQUEST error.
   *API はすべてのタスク入力フィールドを Zod スキーマで検証し、不正な入力には BAD_REQUEST エラーを返す。*
8. The EVM Studio API shall accept an optional `is_buffer` flag (boolean) on task create/update to mark CCPM buffer tasks.
   *API はタスクの作成・更新時にオプションの `is_buffer` フラグ（boolean）を受け付け、CCPM バッファタスクを識別する。*
9. The EVM Studio API shall accept an optional `is_leaf` flag (boolean) on task create/update to prevent double-counting in aggregation.
   *API はタスクの作成・更新時にオプションの `is_leaf` フラグ（boolean）を受け付け、集計時の二重計上を防ぐ。*

---

### 要件 4: Member CRUD

**目的:** プロジェクト管理者として、プロジェクトのメンバーを tRPC 経由で管理したい。これにより稼働率を考慮した PV 計算の基礎データを揃えられる。

#### 受け入れ基準

1. When `members.create` is called with a valid project_id, name, and availability_rate, the EVM Studio API shall create a new member record and return it.
   *`members.create` が有効な project_id・name・availability_rate で呼び出されると、API は新規メンバーを作成し返す。*
2. When `members.listByProject` is called with a valid project_id, the EVM Studio API shall return all members of that project.
   *`members.listByProject` が有効な project_id で呼び出されると、API はそのプロジェクトの全メンバーを返す。*
3. When `members.update` is called with a valid id and update fields, the EVM Studio API shall persist the changes and return the updated member.
   *`members.update` が有効な id と更新フィールドで呼び出されると、API は変更を永続化し、更新後のメンバーを返す。*
4. When `members.delete` is called with a valid id, the EVM Studio API shall delete the member; tasks referencing the member shall have their assignee_id set to NULL.
   *`members.delete` が有効な id で呼び出されると、API はそのメンバーを削除し、参照していたタスクの assignee_id を NULL に設定する。*
5. The EVM Studio API shall validate that `availability_rate` is a number in the range [0.0, 1.0]; values outside this range shall return a BAD_REQUEST error.
   *API は `availability_rate` が [0.0, 1.0] の範囲内であることを検証し、範囲外の値には BAD_REQUEST エラーを返す。*
6. The EVM Studio API shall validate all member input fields with Zod schemas and return a BAD_REQUEST error for invalid input.
   *API はすべてのメンバー入力フィールドを Zod スキーマで検証し、不正な入力には BAD_REQUEST エラーを返す。*

---

### 要件 5: Holiday CRUD

**目的:** プロジェクト管理者として、プロジェクトの休日カレンダーを tRPC 経由で管理したい。これにより PV の営業日計算に休日を反映できる。

#### 受け入れ基準

1. When `holidays.create` is called with a valid project_id and date in YYYY-MM-DD format, the EVM Studio API shall create a new holiday record and return it.
   *`holidays.create` が有効な project_id と YYYY-MM-DD 形式の date で呼び出されると、API は新規休日レコードを作成し返す。*
2. When `holidays.listByProject` is called with a valid project_id, the EVM Studio API shall return all holidays for that project in ascending date order.
   *`holidays.listByProject` が有効な project_id で呼び出されると、API はそのプロジェクトの全休日を日付昇順で返す。*
3. When `holidays.delete` is called with a valid id, the EVM Studio API shall delete the holiday record.
   *`holidays.delete` が有効な id で呼び出されると、API は該当の休日レコードを削除する。*
4. If `holidays.create` is called with an invalid date format (not YYYY-MM-DD), the EVM Studio API shall return a BAD_REQUEST error.
   *`holidays.create` に不正な日付形式（YYYY-MM-DD 以外）が指定されると、API は BAD_REQUEST エラーを返す。*

---

### 要件 6: WBS YAML インポート

**目的:** プロジェクト管理者として、wbs-* スキルが生成した tasks.yaml / staffing.yaml / schedule.yaml をインポートして SQLite に格納したい。これにより手動入力なしでプロジェクトデータを初期化できる。

#### 受け入れ基準

1. When `import.wbsYaml` is called with a project_id and the contents of tasks.yaml, staffing.yaml, and schedule.yaml, the EVM Studio API shall parse all three YAML files using js-yaml SAFE_LOAD and upsert all entities into the database.
   *`import.wbsYaml` が project_id・tasks.yaml 内容・staffing.yaml 内容・schedule.yaml 内容で呼び出されると、API は js-yaml SAFE_LOAD で 3 つの YAML をパースし、全エンティティをデータベースに upsert する。*
2. When `tasks[].parent_id` is specified in tasks.yaml during YAML import, the EVM Studio API shall resolve the `external_id` reference to the DB `id` and set `Task.parent_id` correctly.
   *YAML インポート中に tasks.yaml の `tasks[].parent_id` が指定されると、API は `external_id` 参照を DB の `id` に解決し `Task.parent_id` を正しく設定する。*
3. When `tasks[].depends_on[]` is specified in tasks.yaml during YAML import, the EVM Studio API shall insert corresponding records into `task_dependencies`, resolving external_id to DB id.
   *YAML インポート中に tasks.yaml の `tasks[].depends_on[]` が指定されると、API は external_id を DB id に解決し `task_dependencies` に対応レコードを挿入する。*
4. When `tasks[].assignee` is specified in tasks.yaml during YAML import, the EVM Studio API shall resolve the member `external_id` to the DB `id` and set `Task.assignee_id`.
   *YAML インポート中に tasks.yaml の `tasks[].assignee` が指定されると、API はメンバーの `external_id` を DB の `id` に解決し `Task.assignee_id` を設定する。*
5. When `tasks[].progress_pct` is specified in tasks.yaml during YAML import, the EVM Studio API shall create an initial ProgressSnapshot record for the task with `snapshot_date` equal to the import timestamp date.
   *YAML インポート中に tasks.yaml の `tasks[].progress_pct` が指定されると、API はインポート日時を `snapshot_date` とした初回 ProgressSnapshot レコードをタスクに対して作成する。*
6. When `staffing.meta.public_holidays[]` is specified, the EVM Studio API shall upsert holiday records for the project.
   *`staffing.meta.public_holidays[]` が指定されると、API はプロジェクトの休日レコードを upsert する。*
7. If a YAML file contains an invalid structure (e.g., missing required fields), the EVM Studio API shall return a BAD_REQUEST error (AppError code: `IMPORT_INVALID_YAML`) without partial writes—the import shall be atomic (all or nothing).
   *YAML ファイルが不正な構造（必須フィールド欠落等）を含む場合、API は BAD_REQUEST エラー（AppError code: `IMPORT_INVALID_YAML`）を返し、部分書き込みは行わない（インポートはアトミック）。*
8. If a re-import is performed against the same project_id, the EVM Studio API shall upsert (update existing records by external_id, insert new ones) rather than duplicating.
   *同一 project_id に対して再インポートが行われると、API は重複作成せず upsert（external_id で既存レコードを更新、新規は挿入）を行う。*
9. When YAML import completes successfully, the EVM Studio API shall return a summary object containing counts of upserted projects, tasks, members, holidays, dependencies, and snapshots.
   *YAML インポートが正常に完了すると、API は upsert されたプロジェクト・タスク・メンバー・休日・依存関係・スナップショットの件数を含むサマリーオブジェクトを返す。*
10. The EVM Studio API shall reject YAML files that fail SAFE_LOAD parsing and return a BAD_REQUEST error (AppError code: `IMPORT_PARSE_ERROR`).
    *SAFE_LOAD パースに失敗した YAML ファイルは拒否し、BAD_REQUEST エラー（AppError code: `IMPORT_PARSE_ERROR`）を返す。*

---

### 要件 7: エラーハンドリングと型安全性

**目的:** 開発者として、明確なエラーコードと型安全な API を利用したい。これにより下流スペックの実装が安全かつ予測可能になる。

#### 受け入れ基準

1. The EVM Studio API shall use only error codes defined in `server/src/errors/codes.ts` (AppError pattern); hardcoded string literals shall not be used in throw statements.
   *API は `server/src/errors/codes.ts` に定義されたエラーコード（AppError パターン）のみを使用し、throw 文にハードコードされた文字列リテラルを使用しない。*
2. The EVM Studio API shall convert AppError instances to TRPCError at the tRPC router boundary, preserving the original AppError as the cause.
   *API は tRPC ルーター境界で AppError インスタンスを TRPCError に変換し、元の AppError を cause として保持する。*
3. The EVM Studio shall never use `any` type in TypeScript; all Drizzle-inferred types shall be used directly.
   *EVM Studio は TypeScript で `any` 型を使用せず、Drizzle の推論型をすべて直接使用する。*
4. The EVM Studio API shall export TypeScript types for each entity (`Project`, `Task`, `Member`, `Holiday`, `ProgressSnapshot`, `TaskDependency`) derived from Drizzle schema inference for use by downstream specs.
   *API は各エンティティ（`Project`、`Task`、`Member`、`Holiday`、`ProgressSnapshot`、`TaskDependency`）の TypeScript 型を Drizzle スキーマ推論から導出し、下流スペックが利用できるようエクスポートする。*
5. The EVM Studio shall validate all tRPC procedure inputs with Zod schemas before any database operation.
   *EVM Studio はすべての tRPC プロシージャ入力をデータベース操作の前に Zod スキーマで検証する。*
