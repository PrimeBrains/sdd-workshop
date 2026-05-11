# 要件定義書: reporting

## Introduction

プロジェクト管理者・担当者が毎朝の進捗状況を確認するために、手動集計なしで定型フォーマットのレポートを自動生成できる機能を提供する。evm-engine の EVM 計算と progress-tracking のスナップショット履歴を結合し、朝報（前日比差分付き）・遅延タスク一覧・EVM サマリーを JSON および Markdown 形式で取得できるようにする。

## Boundary Context

- **In scope**: 朝報生成（前日比 SPI/CPI 差分・完了タスク・遅延タスク・アラート集計）、遅延タスク一覧抽出（SPI < 0.9 または完了予定日超過）、EVM サマリー（BAC/EAC/VAC/ETC/TCPI）の生成、JSON/Markdown 出力、レポート表示 UI（プロジェクト＋日付セレクター・Markdown ダウンロード・遅延タスクテーブル）
- **Out of scope**: EVM 計算ロジック（evm-engine が担う）、進捗データの永続化（progress-tracking が担う）、メール送信・Slack 通知、認証・認可
- **Adjacent expectations**: evm-engine の `calculateEvmMetrics` 関数と `ProjectEvmMetrics` 型を読み取り専用で使用する。progress-tracking の `progress.getByDate` / `progress.getLatest` / `progress.getHistory` tRPC プロシージャからスナップショットデータを取得する。

## Requirements

### Requirement 1: 朝報生成（reports.morning）

**Objective:** プロジェクト管理者として、指定日と前回スナップショット日を指定して朝報を生成したい。それにより、毎朝の進捗報告を手動集計なしで正確に作成できる。

#### Acceptance Criteria

1. When `reports.morning` is called with `{ projectId, date, prevDate? }`, the Reporting Service shall calculate and return the project's BAC, EAC for the target date, VAC, SPI, and CPI.
   *`reports.morning` プロシージャが `{ projectId, date, prevDate? }` で呼び出された時、Reporting Service はプロジェクトの BAC・当日 EAC・VAC・SPI・CPI を算出して返す。*
2. When `reports.morning` is called, the Reporting Service shall compare EVM metrics between `prevDate` and the target date, and return ΔSPI = today_SPI - prev_SPI and ΔEV = today_EV - prev_EV.
   *`reports.morning` が呼び出された時、Reporting Service は `prevDate` の EVM メトリクスと当日の EVM メトリクスを比較し、ΔSPI = today_SPI - prev_SPI および ΔEV = today_EV - prev_EV を算出して返す。*
3. When `reports.morning` is called, the Reporting Service shall return a list of tasks whose `progress_pct` reached 100% since the previous snapshot, as "completed tasks".
   *`reports.morning` が呼び出された時、Reporting Service は前回スナップショット以降に `progress_pct` が 100% に到達したタスクを「完了タスク」として一覧化して返す。*
4. When `reports.morning` is called, the Reporting Service shall return a list of tasks whose `progress_pct` increased since the previous snapshot but remains below 100%, as "in-progress tasks".
   *`reports.morning` が呼び出された時、Reporting Service は前回スナップショット以降に `progress_pct` が増加したが 100% 未満のタスクを「進捗ありタスク」として一覧化して返す。*
5. When `reports.morning` is called, the Reporting Service shall return a list of tasks meeting the condition SPI < 0.9 or (`planned_end < baseDate` and `progress_pct < 100`), as "delayed tasks".
   *`reports.morning` が呼び出された時、Reporting Service は SPI < 0.9 または `planned_end < baseDate` かつ `progress_pct < 100` の条件を満たすタスクを「遅延タスク」として一覧化して返す。*
6. When `reports.morning` is called, the Reporting Service shall aggregate and return the project-level alert counts, including the number of CRITICAL_DELAY and WARNING_DELAY alerts.
   *`reports.morning` が呼び出された時、Reporting Service はプロジェクト全体のアラート状況（CRITICAL_DELAY 件数・WARNING_DELAY 件数）を集計して返す。*
7. When `reports.morning` is called, the Reporting Service shall return a response containing both the structured JSON data and a Markdown-formatted morning report document.
   *`reports.morning` が呼び出された時、Reporting Service はレスポンスに JSON データと Markdown 形式の朝報文書を両方含めて返す。*
8. If `projectId` refers to a non-existent project, the Reporting Service shall return a `PROJ_NOT_FOUND` error.
   *`projectId` が存在しないプロジェクトを指す場合、Reporting Service は `PROJ_NOT_FOUND` エラーを返す。*
9. If `prevDate` is omitted, the Reporting Service shall automatically select the most recent past snapshot date.
   *`prevDate` が省略された場合、Reporting Service は直近の過去スナップショット日を自動で選択する。*
10. If no valid snapshot exists for `date`, the Reporting Service shall return a `REPORT_NO_SNAPSHOT` error.
    *`date` に有効なスナップショットが存在しない場合、Reporting Service は `REPORT_NO_SNAPSHOT` エラーを返す。*

### Requirement 2: 遅延タスク一覧取得（reports.delayed）

**Objective:** プロジェクト管理者として、遅延しているタスクの一覧を取得したい。それにより、どのタスクに対策が必要かを迅速に把握できる。

#### Acceptance Criteria

1. When `reports.delayed` is called with `{ projectId, baseDate, minSpi? }`, the Reporting Service shall return tasks with SPI below `minSpi` (defaulting to 0.9 when omitted) as delayed tasks.
   *`reports.delayed` プロシージャが `{ projectId, baseDate, minSpi? }` で呼び出された時、Reporting Service は SPI < `minSpi`（省略時は 0.9）のタスクを遅延タスクとして返す。*
2. When `reports.delayed` is called, the Reporting Service shall also return tasks where `planned_end < baseDate` and `progress_pct < 100` as delayed tasks, evaluated with an OR condition alongside the SPI criterion.
   *`reports.delayed` が呼び出された時、Reporting Service は `planned_end < baseDate` かつ `progress_pct < 100` のタスクも遅延タスクとして返す（SPI 条件と OR で評価する）。*
3. When `reports.delayed` is called, the Reporting Service shall return the task_id, task name, assignee name, SPI, CPI, progress_pct, planned_end, and alert_level for each delayed task.
   *`reports.delayed` が呼び出された時、Reporting Service は各遅延タスクの task_id・タスク名・担当者名・SPI・CPI・progress_pct・planned_end・alert_level を返す。*
4. The Reporting Service shall exclude tasks where `is_buffer = true` from the delayed task list.
   *Reporting Service は `is_buffer = true` のタスクを遅延タスク一覧から除外する。*
5. If `projectId` refers to a non-existent project, the Reporting Service shall return a `PROJ_NOT_FOUND` error.
   *`projectId` が存在しないプロジェクトを指す場合、Reporting Service は `PROJ_NOT_FOUND` エラーを返す。*

### Requirement 3: EVM サマリー取得（reports.summary）

**Objective:** プロジェクト管理者として、プロジェクト全体の EVM サマリーを取得したい。それにより、プロジェクトの健全性を一目で把握できる。

#### Acceptance Criteria

1. When `reports.summary` is called with `{ projectId, baseDate }`, the Reporting Service shall calculate and return BAC, EAC, VAC, ETC, TCPI, SPI, CPI, PV, EV, and AC.
   *`reports.summary` プロシージャが `{ projectId, baseDate }` で呼び出された時、Reporting Service は BAC・EAC・VAC・ETC・TCPI・SPI・CPI・PV・EV・AC を算出して返す。*
2. When `reports.summary` is called and PV equals 0, the Reporting Service shall return SPI as `null` to prevent division by zero.
   *`reports.summary` が呼び出された時、Reporting Service は PV = 0 の場合に SPI を `null` として返す（ゼロ除算安全）。*
3. When `reports.summary` is called and AC equals 0, the Reporting Service shall return CPI as `null`.
   *`reports.summary` が呼び出された時、Reporting Service は AC = 0 の場合に CPI を `null` として返す。*
4. When `reports.summary` is called, the Reporting Service shall exclude tasks where `is_buffer = true` from EVM calculations.
   *`reports.summary` が呼び出された時、Reporting Service は `is_buffer = true` のタスクを EVM 計算から除外する。*
5. If `projectId` refers to a non-existent project, the Reporting Service shall return a `PROJ_NOT_FOUND` error.
   *`projectId` が存在しないプロジェクトを指す場合、Reporting Service は `PROJ_NOT_FOUND` エラーを返す。*

### Requirement 4: JSON と Markdown の出力形式

**Objective:** API コンシューマーおよびプロジェクト管理者として、レポートを JSON と Markdown の両形式で取得したい。それにより、ダッシュボード表示とSlack/Teams/メールへの貼り付けを両立できる。

#### Acceptance Criteria

1. The Reporting Service shall include both structured JSON data and a rendered Markdown string in the `reports.morning` response.
   *Reporting Service は `reports.morning` のレスポンスに構造化された JSON データとレンダリング済み Markdown 文字列の両方を含める。*
2. When a Markdown report is generated, the Reporting Service shall structure the content with Markdown headings and tables covering the project name, target date, EVM summary, completed tasks, in-progress tasks, delayed tasks, and alert aggregation.
   *Markdown レポートが生成された時、Reporting Service はプロジェクト名・対象日・EVM サマリー・完了タスク・進捗ありタスク・遅延タスク・アラート集計を Markdown 見出しと表形式で構造化する。*
3. The Reporting Service shall reference assignee names in Markdown output exclusively from `Member.name`.
   *Reporting Service は Markdown 出力に担当者名を含める場合、`Member.name` からのみ参照する（個人名の集約）。*

### Requirement 5: レポート表示 UI（ReportPage）

**Objective:** プロジェクト管理者として、ブラウザ上でレポートを確認・ダウンロードしたい。それにより、ツールを切り替えずにレポートを確認できる。

#### Acceptance Criteria

1. When a user accesses ReportPage, the ReportPage shall display a project selector and a date input field.
   *ユーザーが ReportPage にアクセスした時、ReportPage はプロジェクトセレクターと日付入力フィールドを表示する。*
2. When a user selects a project and date, the ReportPage shall call `reports.morning` and display the rendered Markdown morning report.
   *ユーザーがプロジェクトと日付を選択した時、ReportPage は `reports.morning` を呼び出してレンダリングされた Markdown の朝報を表示する。*
3. When the morning report is displayed, the ReportPage shall show a "Download as .md" button that triggers a Markdown file download when clicked.
   *朝報が表示されている状態で、ReportPage は「.md としてダウンロード」ボタンを表示し、クリック時に Markdown ファイルをダウンロードさせる。*
4. When a user views the delayed tasks section on ReportPage, the ReportPage shall display a table with columns for task name, assignee, SPI, planned_end, and alert_level.
   *ユーザーが ReportPage で遅延タスクセクションを表示した時、ReportPage はタスク名・担当者・SPI・planned_end・alert_level を列として持つテーブルを表示する。*
5. If the `reports.morning` call returns an error, the ReportPage shall display the error message as a toast notification.
   *`reports.morning` 呼び出しがエラーを返した時、ReportPage はエラーメッセージをトーストで表示する。*
6. While data is being fetched, the ReportPage shall display a loading indicator.
   *データ取得中、ReportPage はローディングインジケーターを表示する。*

### Requirement 6: エラーハンドリングと型安全性

**Objective:** 開発者として、レポート機能のエラーを一貫した方法で処理したい。それにより、予期しない状態でも適切なフィードバックが提供される。

#### Acceptance Criteria

1. The Reporting Service shall validate all tRPC procedure inputs using Zod schemas.
   *Reporting Service はすべての tRPC プロシージャ入力を Zod スキーマでバリデーションする。*
2. When an `AppError` is thrown, the Reporting Service shall convert it to a `TRPCError` and map it to the appropriate HTTP status code at the API boundary.
   *`AppError` が throw された時、Reporting Service は `TRPCError` に変換して API 境界で適切な HTTP ステータスコードにマッピングする。*
3. The Reporting Service shall define the error codes `REPORT_NO_SNAPSHOT` and `REPORT_PROJ_NOT_FOUND` in `server/src/errors/codes.ts`.
   *Reporting Service は `REPORT_NO_SNAPSHOT`・`REPORT_PROJ_NOT_FOUND` のエラーコードを `server/src/errors/codes.ts` に定義する。*
4. The Reporting Service shall record only `task_id`, `project_id`, and `snapshot_date` in logs, excluding any personal names.
   *Reporting Service はログに個人名を含めず `task_id`・`project_id`・`snapshot_date` のみを記録する。*
