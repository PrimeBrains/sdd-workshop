# 要件定義書: progress-tracking

## Introduction

EVM Studio のユーザー（プロジェクト管理者・担当者）が、タスクの実績工数（ac_days）と完了率（progress_pct）を日次でシステムに記録し、EVM エンジンおよびダッシュボードが最新スナップショットを取得できるようにする機能。

`ProgressSnapshot` エンティティを (task_id, snapshot_date) のキーで蓄積型に保存し、tRPC エンドポイント経由で記録・参照できる。クライアント側には日次入力フォームを提供する。

## Boundary Context

- **In scope**:
  - `ProgressSnapshot` の upsert（進捗記録）
  - 指定日付のスナップショット一括取得
  - タスクごとの最新スナップショット取得（evm-engine 連携用）
  - 単一タスクのスナップショット履歴取得
  - 日次入力フォーム UI（プロジェクト選択・日付選択・タスク一覧への入力）
- **Out of scope**:
  - EVM メトリクス（PV/EV/SPI/CPI/EAC）の計算（evm-engine が担う）
  - 進捗グラフ・チャートの描画（dashboard が担う）
  - レポート生成（reporting が担う）
  - WBS YAML インポート時の初回スナップショット作成（core-data-model が担う）
- **Adjacent expectations**:
  - `core-data-model` が `tasks` テーブルと `projects` テーブルを提供済みであること
  - `evm-engine` は `progress.getLatest` の戻り値をそのまま受け取って EV/AC を計算すること

---

## Requirements

### Requirement 1: 進捗スナップショット記録

**Objective:** プロジェクト管理者として、タスクの実績工数と完了率を特定の日付で記録したい。そうすることで、EVM 計算に必要な日次データを蓄積できる。

#### Acceptance Criteria

1. When `progress.record` is called with a `task_id`, `snapshot_date`, `progress_pct`, and `ac_days`, the Progress Tracking Service shall upsert the record, updating it if a record for the same `(task_id, snapshot_date)` already exists, or creating a new one otherwise.
   *`task_id`・`snapshot_date`・`progress_pct`・`ac_days` を指定して `progress.record` を呼び出すと、同一 `(task_id, snapshot_date)` のレコードが存在すれば上書き（upsert）し、存在しなければ新規作成する。*
2. The Progress Tracking Service shall accept only integers between 0 and 100 (inclusive) for `progress_pct`, and shall return a validation error if a value outside that range is provided.
   *`progress_pct` は 0 以上 100 以下の整数のみ受け付け、範囲外の値が指定された場合はバリデーションエラーを返す。*
3. The Progress Tracking Service shall accept only non-negative floating-point numbers for `ac_days`, and shall return a validation error if a negative value is provided.
   *`ac_days` は 0 以上の浮動小数点数のみ受け付け、負の値が指定された場合はバリデーションエラーを返す。*
4. The Progress Tracking Service shall accept `snapshot_date` as a string in `YYYY-MM-DD` format, and shall return a validation error if an invalid format is provided.
   *`snapshot_date` は `YYYY-MM-DD` 形式の文字列として受け付け、不正な形式が指定された場合はバリデーションエラーを返す。*
5. The Progress Tracking Service shall return a `SNAP_TASK_NOT_FOUND` error if the provided `task_id` does not exist in the database.
   *`task_id` が DB に存在しない場合、`SNAP_TASK_NOT_FOUND` エラーを返す。*
6. When `progress.record` completes successfully, the Progress Tracking Service shall return the saved `ProgressSnapshot` record.
   *`progress.record` が正常に完了したとき、保存された `ProgressSnapshot` レコードを返す。*
7. The Progress Tracking Service shall not modify or delete snapshots recorded on other dates, thereby guaranteeing the cumulative integrity of the snapshot history.
   *過去の別日付のスナップショットを変更・削除しない（スナップショットの蓄積を保証する）。*

### Requirement 2: 指定日付のスナップショット一括取得

**Objective:** プロジェクト管理者として、特定プロジェクトの特定日付における全タスクのスナップショットを取得したい。そうすることで、その日の進捗状況を一覧できる。

#### Acceptance Criteria

1. When `progress.getByDate` is called with a `project_id` and `snapshot_date`, the Progress Tracking Service shall return a list of snapshots recorded on that date for all tasks within the specified project.
   *`project_id` と `snapshot_date` を指定して `progress.getByDate` を呼び出すと、指定プロジェクト内の全タスクのうち、指定日付に記録されたスナップショットの一覧を返す。*
2. The Progress Tracking Service shall exclude from the result any task that has no snapshot recorded on the specified date.
   *指定日付にスナップショットが存在しないタスクは結果に含めない。*
3. The Progress Tracking Service shall return an empty array if the specified `project_id` does not exist in the database, without performing a project existence check.
   *指定 `project_id` が DB に存在しない場合、空配列を返す（プロジェクト存在確認は不要）。*
4. When `progress.getByDate` is called, the Progress Tracking Service shall return the results sorted in ascending order by `task_id`.
   *`progress.getByDate` が呼び出されたとき、結果を `task_id` 昇順でソートして返す。*

### Requirement 3: タスクごとの最新スナップショット取得（evm-engine 連携）

**Objective:** EVM エンジンとして、プロジェクト内の全タスクの最新スナップショットを一括取得したい。そうすることで、EV・AC の計算に最新の実績データを使用できる。

#### Acceptance Criteria

1. When `progress.getLatest` is called with a `project_id`, the Progress Tracking Service shall return one snapshot per task within the specified project, selecting the snapshot with the most recent `snapshot_date` for each task.
   *`project_id` を指定して `progress.getLatest` を呼び出すと、指定プロジェクト内の各タスクについて、最も新しい `snapshot_date` を持つスナップショットを 1 件ずつ返す。*
2. The Progress Tracking Service shall return only the snapshot with the maximum `snapshot_date` when multiple snapshots exist for the same task.
   *同一タスクに複数のスナップショットが存在する場合、`snapshot_date` が最大のもののみを返す。*
3. The Progress Tracking Service shall exclude from the result any task that has never had a snapshot recorded.
   *スナップショットが一度も記録されていないタスクは結果に含めない。*
4. When `progress.getLatest` is called, the Progress Tracking Service shall include `task_id`, `snapshot_date`, `progress_pct`, and `ac_days` in each result item.
   *`progress.getLatest` が呼び出されたとき、結果に `task_id`・`snapshot_date`・`progress_pct`・`ac_days` を含める。*

### Requirement 4: 単一タスクのスナップショット履歴取得

**Objective:** プロジェクト管理者として、特定タスクの進捗履歴を時系列で確認したい。そうすることで、タスクの進捗推移を把握できる。

#### Acceptance Criteria

1. When `progress.getHistory` is called with a `task_id`, the Progress Tracking Service shall return all snapshots for the specified task sorted in ascending order by `snapshot_date`.
   *`task_id` を指定して `progress.getHistory` を呼び出すと、指定タスクのすべてのスナップショットを `snapshot_date` 昇順で返す。*
2. The Progress Tracking Service shall return an empty array if the specified `task_id` does not exist in the database.
   *`task_id` が DB に存在しない場合、空配列を返す。*
3. The Progress Tracking Service shall include `id`, `task_id`, `snapshot_date`, `progress_pct`, `ac_days`, and `createdAt` in each snapshot item.
   *各スナップショットに `id`・`task_id`・`snapshot_date`・`progress_pct`・`ac_days`・`createdAt` を含める。*

### Requirement 5: 日次進捗入力フォーム UI

**Objective:** プロジェクト担当者として、ブラウザ上でタスクの進捗と実績工数をワンアクションで入力・保存したい。そうすることで、毎日の進捗記録を素早く完了できる。

#### Acceptance Criteria

1. When the user opens the progress input page, the Progress Input UI shall display a project selection dropdown and a date selection field.
   *ユーザーが進捗入力ページを開いたとき、プロジェクト選択ドロップダウンと日付選択フィールドを表示する。*
2. When a project and date are selected, the Progress Input UI shall display the list of leaf tasks for the selected project, with an input field for `progress_pct` (integer 0–100) and `ac_days` (non-negative number) for each task.
   *プロジェクトと日付が選択されたとき、選択されたプロジェクトのリーフタスク一覧を表示し、各タスクに `progress_pct`（0〜100 整数）と `ac_days`（0 以上の数値）の入力フィールドを表示する。*
3. When the user clicks the "Save" button, the Progress Input UI shall submit snapshots for all entered tasks in bulk via `progress.record`.
   *ユーザーが「保存」ボタンを押したとき、入力された全タスクのスナップショットを `progress.record` 経由で一括送信する。*
4. When the save operation succeeds, the Progress Input UI shall display a success notification.
   *保存が成功したとき、成功通知を表示する。*
5. If an error occurs during saving, the Progress Input UI shall display an error message to the user.
   *保存中にエラーが発生したとき、エラーメッセージをユーザーに表示する。*
6. The Progress Input UI shall display a client-side validation error before submission if `progress_pct` is less than 0 or greater than 100.
   *`progress_pct` が 0 未満または 100 超の場合、送信前にクライアントサイドでバリデーションエラーを表示する。*
7. The Progress Input UI shall display a client-side validation error before submission if `ac_days` is a negative value.
   *`ac_days` が負の値の場合、送信前にクライアントサイドでバリデーションエラーを表示する。*
8. When the selected project has previously recorded snapshots, the Progress Input UI shall pre-populate the input fields with the existing values.
   *選択されたプロジェクトに記録済みスナップショットが存在する場合、既存の値を入力フィールドの初期値として表示する。*

### Requirement 6: エラーハンドリングと型安全

**Objective:** システムとして、不正な入力やシステムエラーを適切に処理し、クライアントに明確なエラー情報を返したい。そうすることで、運用時の問題を迅速に特定・修正できる。

#### Acceptance Criteria

1. The Progress Tracking Service shall perform input validation using Zod schemas on all tRPC procedures.
   *すべての tRPC プロシージャで Zod スキーマによる入力バリデーションを実施する。*
2. The Progress Tracking Service shall throw domain errors as `AppError(code: ErrorCode, message)` and convert them to `TRPCError` at the tRPC boundary.
   *ドメインエラーを `AppError(code: ErrorCode, message)` として throw し、tRPC 境界で `TRPCError` に変換する。*
3. The Progress Tracking Service shall add error codes for the progress domain to the `ErrorCode` constant in `server/src/errors/codes.ts` using the `SNAP_` prefix.
   *progress ドメインのエラーコードを `server/src/errors/codes.ts` の `ErrorCode` 定数に追加する（`SNAP_` プレフィックス）。*
4. The Progress Tracking Service shall record only `task_id` and `project_id` in business logic layer logs, excluding any personal names.
   *ビジネスロジック層のログに個人名を含めず、`task_id` と `project_id` のみを記録する。*
