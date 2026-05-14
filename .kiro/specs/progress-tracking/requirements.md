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
  - 進捗入力パネル UI（GanttFullscreen 内インラインパネル。単一タスクを対象にスナップショット日・進捗率・AC・メモを入力して保存）
- **Out of scope**:
  - EVM メトリクス（PV/EV/SPI/CPI/EAC）の計算（evm-engine が担う）
  - 進捗グラフ・チャートの描画（dashboard が担う）
  - レポート生成
  - WBS YAML インポート時の初回スナップショット作成（core-data-model が担う）
- **Adjacent expectations**:
  - `core-data-model` が `tasks` テーブルと `projects` テーブルを提供済みであること
  - `evm-engine` は `progress.getLatest` の戻り値をそのまま受け取って EV/AC を計算すること

---

## Requirements

### Requirement 1: 進捗スナップショット記録

**Objective:** プロジェクト管理者として、タスクの実績工数と完了率を特定の日付で記録したい。そうすることで、EVM 計算に必要な日次データを蓄積できる。

#### Acceptance Criteria

1. When `progress.record` is called with a `task_id`, `snapshot_date`, `progress_pct`, and `ac_days`, the Progress Tracking Service shall upsert the record (including calculated `pv_days` and `ev_days`), updating it if a record for the same `(task_id, snapshot_date)` already exists, or creating a new one otherwise.
   *`task_id`・`snapshot_date`・`progress_pct`・`ac_days` を指定して `progress.record` を呼び出すと、サービスが `pv_days`（スナップショット日時点の計画出来高）と `ev_days`（`estimate_days × progress_pct / 100`）を算出し、同一 `(task_id, snapshot_date)` のレコードが存在すれば上書き（upsert）し、存在しなければ新規作成する。*
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
4. When `progress.getLatest` is called, the Progress Tracking Service shall include `task_id`, `snapshot_date`, `progress_pct`, `pv_days`, `ev_days`, and `ac_days` in each result item.
   *`progress.getLatest` が呼び出されたとき、結果に `task_id`・`snapshot_date`・`progress_pct`・`pv_days`・`ev_days`・`ac_days` を含める。*

### Requirement 4: 単一タスクのスナップショット履歴取得

**Objective:** プロジェクト管理者として、特定タスクの進捗履歴を時系列で確認したい。そうすることで、タスクの進捗推移を把握できる。

#### Acceptance Criteria

1. When `progress.getHistory` is called with a `task_id`, the Progress Tracking Service shall return all snapshots for the specified task sorted in ascending order by `snapshot_date`.
   *`task_id` を指定して `progress.getHistory` を呼び出すと、指定タスクのすべてのスナップショットを `snapshot_date` 昇順で返す。*
2. The Progress Tracking Service shall return an empty array if the specified `task_id` does not exist in the database.
   *`task_id` が DB に存在しない場合、空配列を返す。*
3. The Progress Tracking Service shall include `id`, `task_id`, `snapshot_date`, `progress_pct`, `pv_days`, `ev_days`, `ac_days`, and `createdAt` in each snapshot item.
   *各スナップショットに `id`・`task_id`・`snapshot_date`・`progress_pct`・`pv_days`・`ev_days`・`ac_days`・`createdAt` を含める。*

### Requirement 5: 進捗入力パネル UI（GanttFullscreen 内インラインパネル）

**Objective:** プロジェクト担当者として、ガント全画面からタスクをクリックして進捗と実績工数を即座に入力・保存したい。そうすることで、毎日の進捗記録を WBS を見ながら素早く完了できる。

#### Acceptance Criteria

1. When the user clicks a leaf task (non-buffer) in GanttFullscreen, the Progress Input UI shall open as an inline right-side panel within the GanttFullscreen overlay, without navigating away.
   *GanttFullscreen でリーフタスク（バッファ以外）をクリックすると、ページ遷移なしに GanttFullscreen オーバーレイ内の右インラインパネルとして進捗入力 UI を開く。*
2. The Progress Input UI shall display a snapshot date picker at the top of the panel, defaulting to today; when a past date is selected, the panel shall display a visual warning indicator.
   *パネル上部にスナップショット日付ピッカーを表示し、デフォルトを今日とする。過去日付が選択された場合は視覚的な警告インジケーターを表示する。*
3. The Progress Input UI shall display the task's ancestor breadcrumb (parent chain), task code, assignee name, planned start/end dates, and current status pill.
   *進捗入力 UI はタスクの祖先パンくず（親チェーン）・タスクコード・担当者名・計画開始/終了日・現在のステータス Pill を表示する。*
4. The Progress Input UI shall display a `progress_pct` input as both a range slider (step 5) and a numeric input (step 1, 0–100), kept in sync.
   *`progress_pct` 入力をレンジスライダー（ステップ 5）と数値入力（ステップ 1、0〜100）の両方で表示し、連動させる。*
5. The Progress Input UI shall display a progress bar that shows both the current `progress_pct` fill and a vertical "今日の計画 N%" marker indicating the planned position for the snapshot date; it shall also show the advance/delay diff (e.g., "+5% 先行" or "−3% 遅延").
   *進捗バーに現在の `progress_pct` 塗りと、スナップショット日時点の計画進捗を示す縦マーカー「計画 N%」を重ねて表示し、先行/遅延差分（例: "+5% 先行"・"−3% 遅延"）も表示する。*
6. The Progress Input UI shall display an `ac_days` input with a MD / h unit toggle (1 MD = 8 h), showing the previous cumulative AC, today's addition, and the new cumulative total.
   *`ac_days` 入力に MD / h 単位トグル（1 MD = 8 h）を設け、前回累積 AC・本日追加分・新累積合計を表示する。*
7. While the user is editing, the Progress Input UI shall display a live preview of the resulting EV, AC, and CPI values based on the current inputs.
   *ユーザーが編集中、入力値に基づく EV・AC・CPI の計算結果をリアルタイムプレビューとして表示する。*
8. The Progress Input UI shall include an optional free-text memo field.
   *任意のフリーテキストメモ欄を設ける。*
9. The Save button shall be disabled when no values have been changed from their initial state (dirty = false); when clicked in the dirty state, it shall call `progress.record` and close the panel on success.
   *保存ボタンは初期状態から変更がない場合（dirty = false）は無効化する。dirty 状態でクリックすると `progress.record` を呼び出し、成功時にパネルを閉じる。*
10. If an error occurs during saving, the Progress Input UI shall display an error message within the panel.
    *保存中にエラーが発生した場合、パネル内にエラーメッセージを表示する。*
11. The Progress Input UI shall display a client-side validation error if `progress_pct` is outside 0–100 or `ac_days` is negative.
    *`progress_pct` が 0〜100 範囲外または `ac_days` が負の場合、クライアントサイドのバリデーションエラーを表示する。*
12. When the panel opens, the Progress Input UI shall pre-populate inputs with the most recent recorded snapshot values for that task (if any).
    *パネルが開いた際、そのタスクの最新スナップショット値（存在する場合）を初期値として入力欄に表示する。*

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
