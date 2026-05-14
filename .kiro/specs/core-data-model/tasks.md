# 実装計画

## タスク一覧

---

- [ ] 1. 基盤: エラーレイヤーとプロジェクトスキャフォールド
- [x] 1.1 サーバーの依存パッケージをインストールしてプロジェクト構造を確立する
  - `evm-studio/server/` に `package.json`、`tsconfig.json`、`vitest.config.ts` を配置する
  - `better-sqlite3`、`drizzle-orm`、`@trpc/server`、`hono`、`zod`、`js-yaml`、`pino`、`drizzle-kit` を依存として追加する
  - `npm install` が完了し、`server/src/` ディレクトリ構造（`db/`、`services/`、`api/`、`errors/`）が存在すること
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 1.2 ErrorCode 定数と AppError クラスを実装する
  - `server/src/errors/codes.ts` に `PROJ_NOT_FOUND`、`TASK_NOT_FOUND`、`MEMBER_NOT_FOUND`、`MEMBER_INVALID_RATE`、`IMPORT_INVALID_YAML`、`IMPORT_PARSE_ERROR`、`IMPORT_MISSING_FIELD` を定義する
  - `server/src/errors/AppError.ts` に `AppError extends Error` クラスを実装し、`code: ErrorCode` プロパティを持たせる
  - 全エラーコードが `codes.ts` に定義されており、文字列リテラルを直書きせずに参照できること
  - _Requirements: 7.1, 7.2_

---

- [ ] 2. データベース: Drizzle スキーマとマイグレーション
- [x] 2.1 全エンティティの Drizzle スキーマを定義する
  - `server/src/db/schema.ts` に `projects`、`tasks`、`members`、`holidays`、`task_dependencies`、`progress_snapshots` の 6 テーブルを定義する
  - カラム名は snake_case（DB）、TypeScript プロパティは camelCase にマッピングする（例: `plannedStart: text('planned_start')`）
  - `is_buffer`・`is_leaf` は `{ mode: 'boolean' }` で整数保存、日付は TEXT（`YYYY-MM-DD`）、タイムスタンプは `{ mode: 'timestamp' }` で保存する
  - `tasks.parentId` は `() => tasks.id` で自己参照する遅延評価で定義する
  - `Project`、`Task`、`Member`、`Holiday`、`TaskDependency`、`ProgressSnapshot` および `New*` 型が Drizzle inference からエクスポートされること
  - `ProgressSnapshot` 型に `pvDays`・`evDays` フィールドが含まれていること（リスケ・再見積後も過去スナップショットの PV/EV が正確に参照できるよう記録時点の値を保存）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.3, 7.4_

- [x] 2.2 DB 接続の初期化とマイグレーション実行を実装する
  - `server/src/db/index.ts` に `better-sqlite3` 接続と `drizzle()` ラッパーをシングルトンとして実装する
  - 接続後即時に `sqlite.pragma('foreign_keys = ON')` を実行する
  - `runMigrations()` 関数を実装し、アプリ起動時に `migrate()` で最新スキーマを適用する
  - `server/src/drizzle.config.ts` を作成し `drizzle-kit generate` が実行できる状態にする
  - `drizzle-kit generate` を実行してマイグレーションファイルが `server/src/db/migrations/` に生成されること
  - _Requirements: 1.7, 1.8_

---

- [ ] 3. CRUD API: Project・Task・Member・Holiday ルーター（並列実装可）
- [x] 3.1 (P) Project CRUD tRPC ルーターを実装する
  - `server/src/api/projects.ts` に `projects.list`、`projects.getById`、`projects.create`、`projects.update`、`projects.delete` プロシージャを実装する
  - `createProjectSchema`（name/startDate/endDate を Zod で検証）と `updateProjectSchema` を定義する
  - `projects.getById` で存在しない id を渡すと `AppError(PROJ_NOT_FOUND)` が throw され、tRPC `NOT_FOUND` に変換されること
  - `projects.delete` が対応する tasks・members・holidays を CASCADE で削除すること（要件 2.6 の検証）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - _Boundary: ProjectsRouter_

- [x] 3.2 (P) Task CRUD tRPC ルーターを実装する
  - `server/src/api/tasks.ts` に `tasks.listByProject`、`tasks.getById`、`tasks.create`、`tasks.update`、`tasks.delete` プロシージャを実装する
  - `createTaskSchema` に `estimateDays`（非負実数）、`plannedStart`/`plannedEnd`（YYYY-MM-DD regex）、`isBuffer`（boolean）、`isLeaf`（boolean）を含める
  - `tasks.listByProject` が `sort_order` 昇順で結果を返すこと
  - `tasks.getById` で存在しない id を渡すと `AppError(TASK_NOT_FOUND)` が throw されること
  - `tasks.delete` が関連する `task_dependencies` と `progress_snapshots` を削除すること
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  - _Boundary: TasksRouter_

- [x] 3.3 (P) Member CRUD tRPC ルーターを実装する
  - `server/src/api/members.ts` に `members.listByProject`、`members.create`、`members.update`、`members.delete` プロシージャを実装する
  - `createMemberSchema` で `availabilityRate` を `z.number().min(0).max(1)` で検証する
  - `members.delete` 実行後、そのメンバーを参照していた `tasks.assignee_id` が NULL になること
  - `availabilityRate` が 0〜1 範囲外の値で `BAD_REQUEST` エラーが返ること
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - _Boundary: MembersRouter_

- [x] 3.4 (P) Holiday CRUD tRPC ルーターを実装する
  - `server/src/api/holidays.ts` に `holidays.listByProject`、`holidays.create`、`holidays.delete` プロシージャを実装する
  - `holidays.listByProject` が date 昇順で結果を返すこと
  - 不正な日付形式（YYYY-MM-DD 以外）で `BAD_REQUEST` エラーが返ること
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Boundary: HolidaysRouter_

---

- [ ] 4. サービス: WBS YAML インポートロジック
- [x] 4.1 WBS YAML パーサーと構造バリデーションを実装する
  - `server/src/services/wbs-importer.ts` に `tasks.yaml`・`staffing.yaml`・`schedule.yaml` を `js-yaml.load()` の SAFE_LOAD オプションでパースする処理を実装する
  - 必須フィールドが欠落している場合は `AppError(IMPORT_MISSING_FIELD)` を、YAML パース自体が失敗した場合は `AppError(IMPORT_PARSE_ERROR)` を throw する
  - 正常な YAML が渡されたとき、各エンティティデータを構造化オブジェクトとして保持できること
  - _Requirements: 6.7, 6.10_
  - _Boundary: WbsImporter_

- [x] 4.2 アトミックインポートトランザクション（upsert・ID 解決・スナップショット）を実装する
  - `better-sqlite3` の `db.transaction()` を使用して全 upsert をひとつのトランザクションで実行する
  - `external_id` をキーとして members・tasks・holidays を upsert し、再インポート時に重複が生じないようにする
  - `tasks.yaml` の `parent_id`（external_id 形式）を DB の内部 `id` に解決して `Task.parent_id` を設定する
  - `tasks.yaml` の `depends_on[]` を `task_dependencies` テーブルにインサートし、external_id から DB id に解決する
  - `tasks.yaml` の `assignee`（external_id 形式）を DB の内部 `id` に解決して `Task.assignee_id` を設定する
  - `progress_pct` が指定されたタスクに対してインポート日付を `snapshot_date` とする初回 `ProgressSnapshot` を作成する
  - 初回スナップショット作成時に `ev_days = estimate_days × (progress_pct / 100)` および `pv_days = 稼働日数ベースの計算値`（インポート日と planned_start/end の関係に基づく）を算出して格納する
  - `staffing.meta.public_holidays[]` を `holidays` テーブルに upsert する
  - トランザクション内でエラーが発生した場合、部分書き込みなしでロールバックされること（アトミック性の確認）
  - `ImportSummary`（tasks・members・holidays・dependencies・snapshots のカウント）を返すこと
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  - _Boundary: WbsImporter_
  - _Depends: 4.1_

---

- [ ] 5. API: Import tRPC ルーターと Hono サーバー統合
- [x] 5.1 Import tRPC ルーターを実装する
  - `server/src/api/import.ts` に `import.wbsYaml` プロシージャを実装する
  - `importWbsYamlSchema`（projectId・tasksYaml・staffingYaml・scheduleYaml）で Zod バリデーションを行う
  - `WbsImporter.importWbsYaml()` を呼び出し、`ImportSummary` を返す
  - AppError を TRPCError に変換するヘルパー（`toTRPCError`）を適用する
  - 有効な 3 ファイルを渡すと `ImportSummary` が返ること
  - _Requirements: 6.1, 6.7, 6.9, 6.10, 7.2_
  - _Boundary: ImportRouter_
  - _Depends: 4.2_

- [x] 5.2 tRPC appRouter と Hono サーバーエントリーポイントを実装する
  - `server/src/router.ts` に全ルーター（projects・tasks・members・holidays・import）を `createTRPCRouter` でマウントする
  - `server/src/index.ts` に Hono アプリを作成し、CORS（localhost のみ）、`hono/logger` ミドルウェア、tRPC ハンドラーを設定する
  - `runMigrations()` をサーバー起動前に呼び出す
  - `npm run dev:server` でサーバーが起動し、tRPC エンドポイントにアクセスできること
  - _Requirements: 1.7, 1.8, 7.1, 7.2, 7.5_
  - _Boundary: HonoApp, Router_
  - _Depends: 3.1, 3.2, 3.3, 3.4, 5.1_

---

- [ ] 6. テスト: サーバー単体テストと E2E テスト
- [x] 6.1 WBS インポートサービスの単体テストを実装する
  - `server/src/services/wbs-importer.test.ts` に以下のテストケースを実装する：正常インポート（3 YAML → DB）、parent_id の external_id 解決、depends_on の task_dependencies 挿入、不正 YAML でのアトミックロールバック、再インポート（upsert）での重複なし
  - インメモリ SQLite（`:memory:`）または一時ファイルを使ってテスト間の独立性を確保する
  - `npm test` を実行してすべてのテストがパスすること
  - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8_
  - _Boundary: WbsImporter_

- [x] 6.2 Project・Member ルーターのエラーケース単体テストを実装する
  - `server/src/api/projects.test.ts` に `projects.getById` で存在しない id を渡したとき `PROJ_NOT_FOUND` が返るテストを実装する
  - `server/src/api/members.test.ts` に `availabilityRate` が 0〜1 範囲外のとき `BAD_REQUEST` が返るテストを実装する
  - `npm test` を実行してすべてのテストがパスすること
  - _Requirements: 2.4, 4.5_
  - _Boundary: ProjectsRouter, MembersRouter_

- [x] 6.3* WBS インポート → タスク一覧確認の E2E テストを実装する
  - `e2e/import.spec.ts` に 3 YAML ファイルをインポートしてタスク一覧が正しく返ることを検証する Playwright テストを実装する
  - `npm run test:e2e` を実行してテストがパスすること
  - _Requirements: 6.1, 6.9_
  - _Boundary: ImportRouter, TasksRouter_
  - _Depends: 5.2_

---

- [ ] 7. WBS YAML スケジュール分離型対応
- [x] 7.1 tasks.yaml の null フィールド許容パーサーを実装する
  - `server/src/services/wbs-importer.ts` の `parseTasksYaml` で `estimate_days`・`planned_start`・`planned_end` が null または欠落の場合にエラーを throw せず、それぞれ `0`・`null`・`null` として取り込む
  - `ParsedTask` 型の `planned_start`・`planned_end` を `string | null` に更新する
  - `calcPvDays` 関数が null の planned 日付を受け付け、null の場合は 0 を返すようにする
  - `estimate_days` が null の YAML タスクと `planned_start`/`planned_end` がすべて null の YAML タスクで `parseTasksYaml` を呼び出してもエラーが発生しないこと
  - `npm test` がパスすること（既存テスト含む）
  - _Requirements: 6.11_
  - _Boundary: WbsImporter_

- [x] 7.2 schedule.yaml の assignments[] パーサーを実装する
  - `server/src/services/wbs-importer.ts` の `parseScheduleYaml` を拡張し、`assignments[]` フィールドが存在する場合に `{ task_id: string; planned_start: string; planned_end: string }` の配列として返す
  - `ParsedScheduleYaml` 型に `assignments?: Array<{ task_id: string; planned_start: string; planned_end: string }>` を追加する
  - `assignments[]` を持たない schedule YAML でも正常にパースできること（後方互換）
  - `npm test` がパスすること
  - _Requirements: 6.12_
  - _Boundary: WbsImporter_
  - _Depends: 7.1_

- [x] 7.3 importWbsYaml に schedule assignments → task planned 日付マッピングを追加する
  - `server/src/services/wbs-importer.ts` の `importWbsYaml` トランザクション内に第3パスを追加し、`schedule.assignments[]` の `task_id`（external_id 形式）に対応するタスクの `planned_start`/`planned_end` を DB に更新する（parent_id 解決の後、task_dependencies 挿入の前）
  - 対応タスクが見つからない assignment は無視する
  - `planned_start` または `planned_end` が null のままタスクの ProgressSnapshot を作成する場合は `pv_days = 0` とする
  - reschedule 形式の schedule YAML（T-prefix task_id + planned_start/end）をインポートした後、対応タスクの `planned_start` が null でないこと
  - `npm test` がパスすること
  - _Requirements: 6.12, 6.13_
  - _Boundary: WbsImporter_
  - _Depends: 7.2_

- [x] 7.4 (P) null フィールドと assignments マッピングの単体テストを追加する
  - `server/src/services/wbs-importer.test.ts` に以下のテストケースを追加する：
    - `estimate_days` が null のタスクが `estimateDays=0` でインポートされること
    - `planned_start`/`planned_end` が null のタスクが DB に null で保存されること
    - `assignments[]` を含む schedule YAML をインポートした後、対応タスクの `planned_start`/`planned_end` が設定されること
    - `planned_start`/`planned_end` が null のタスクの ProgressSnapshot で `pvDays = 0` となること
  - `npm test` を実行してすべてのテストがパスすること
  - _Requirements: 6.11, 6.12, 6.13_
  - _Boundary: WbsImporter_
  - _Depends: 7.3_

- [x] 7.5 (P) 実プロジェクト YAML を使用した E2E テストを追加する
  - `e2e/import.spec.ts` に以下の E2E テストを追加する：
    - tasks.yaml（84 タスク）+ staffing.yaml + reschedule-2026-05-14.yaml を `fs.readFileSync` で読み込み `import.wbsYaml` でインポートする
    - インポート後のタスク件数が 84 件であること
    - assignments で planned 日付が設定されたタスク（T002a 等）の `plannedStart` が null でないこと
    - 再インポートしてもタスク件数が 84 件のまま（重複なし）であること
  - `npm run test:e2e` を実行してテストがパスすること
  - _Requirements: 6.11, 6.12, 6.8_
  - _Boundary: ImportRouter, TasksRouter_
  - _Depends: 7.3_

## Implementation Notes

- js-yaml 4 では `yaml.DEFAULT_SAFE_SCHEMA` は存在しない（v3 のみ）。`yaml.DEFAULT_SCHEMA` を使用すること
- better-sqlite3 の raw インスタンスは `(db as unknown as { $client: Database }).$client` でアクセスする
- Vitest は v2.1.9 を使用（Node v21.7.3 は vitest v4 の engine 要件 `^20.0.0 || ^22.0.0 || >=24.0.0` を満たさないため）
- E2E テストの tRPC 呼び出しは POST `/trpc/{procedure}` に plain JSON body を送信し、レスポンスの `result.data` を参照する
