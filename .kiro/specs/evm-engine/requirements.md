# 要件定義書: evm-engine

## はじめに

EVM Studio は WBS YAML を取り込み、プロジェクトの進捗を EVM（Earned Value Management）メトリクスで管理するローカルファースト Web アプリである。現状、core-data-model によりデータは SQLite に格納されているが、EVM 計算を担うサービス層が存在しない。そのため、計算の境界条件（PV=0、稼働率考慮、休日除外等）でバグが発生するリスクを抱えたまま実装が進む状況になっている。

本フィーチャーは、プロジェクト管理者が基準日時点の PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI を正確に把握し、クリティカルパスと CCPM バッファ消費率を可視化できるよう、副作用なしの純粋関数群として EVM 計算エンジンを提供する。

## 境界コンテキスト

- **スコープ内**: PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI 計算、日次 PV 配賦（稼働率×休日考慮）、クリティカルパス特定、CCPM バッファ消費率・フィーバーチャートゾーン判定、アラート閾値評価、単体テスト
- **スコープ外**: DB アクセス・データ永続化（progress-tracking が担う）、tRPC ルーター・API エンドポイント（dashboard/reporting が担う）、グラフ描画・UI 表示（dashboard が担う）、朝報フォーマット（reporting が担う）
- **隣接期待値**: core-data-model が提供する `Task`・`Member`・`Holiday`・`ProgressSnapshot` 型を入力として受け取る。dashboard と reporting は本エンジンの出力型（`EvmMetrics`・`CriticalPath`・`FeverChartData`）に依存するため、型定義の変更は両スペックへの再確認が必要となる

---

## 要件

### 要件 1: PV 計算（fill-to-capacity モデル）

**目的**: プロジェクト管理者として、WBS-CMN-013 の fill-to-capacity モデルに基づいた正確な PV（Planned Value）を基準日時点で取得したい。これにより、按分方式では生じる過少評価を回避し、実態に即したスケジュール評価が可能になる。

#### 受け入れ基準

1. When the base date is earlier than a task's `planned_start`, the EVM engine shall return `0` as the PV for that task.
   *基準日がタスクの `planned_start` より前である場合、EVM エンジンはそのタスクの PV として `0` を返す。*

2. When the base date is on or after a task's `planned_end`, the EVM engine shall return `estimate_days` (the task BAC) as the PV for that task.
   *基準日がタスクの `planned_end` 以降である場合、EVM エンジンはそのタスクの PV として `estimate_days`（タスク BAC）を返す。*

3. When the base date is on or after `planned_start` and before `planned_end`, the EVM engine shall calculate the number of working days N from `planned_start` to the base date (excluding weekends and holidays) and return `min(N × availability_rate, estimate_days)` as the task PV.
   *基準日が `planned_start` 以上かつ `planned_end` 未満である場合、EVM エンジンは `planned_start` から基準日までの稼働日数（土日および祝日を除外）N を算出し、`min(N × availability_rate, estimate_days)` をタスク PV として返す。*

4. When a holiday list is provided, the EVM engine shall exclude those dates from the working-day count.
   *祝日リストが与えられる場合、EVM エンジンは当該日付を稼働日数の計算から除外する。*

5. When a task has `is_buffer = true`, the EVM engine shall exclude that task from the cumulative PV calculation.
   *`is_buffer = true` のタスクが含まれる場合、EVM エンジンはそのタスクを PV 累積の計算から除外する。*

6. The EVM engine shall return the project-wide cumulative PV as the sum of the individual PV values of all tasks.
   *EVM エンジンはプロジェクト全体の累積 PV を全タスクの個別 PV の合計として返す。*

### 要件 2: EV・AC 計算

**目的**: プロジェクト管理者として、基準日時点の EV（Earned Value）および AC（Actual Cost）を取得したい。これにより、実際の進捗とコスト投入量を定量的に把握できる。

#### 受け入れ基準

1. When a task's `progress_pct` is provided, the EVM engine shall return `estimate_days × (progress_pct / 100)` as the EV for that task.
   *タスクの `progress_pct` が与えられる場合、EVM エンジンは `estimate_days × (progress_pct / 100)` をそのタスクの EV として返す。*

2. The EVM engine shall return the project-wide cumulative EV as the sum of the individual EV values of all tasks.
   *EVM エンジンはプロジェクト全体の累積 EV を全タスクの個別 EV の合計として返す。*

3. When a task has `is_buffer = true`, the EVM engine shall exclude that task from the cumulative EV calculation.
   *`is_buffer = true` のタスクが含まれる場合、EVM エンジンはそのタスクを EV 累積の計算から除外する。*

4. The EVM engine shall return the sum of `ProgressSnapshot.ac_days` as the project-wide AC.
   *EVM エンジンは `ProgressSnapshot.ac_days` の合計値をプロジェクト全体の AC として返す。*

### 要件 3: EVM 派生メトリクス計算

**目的**: プロジェクト管理者として、SPI/CPI/EAC/VAC/ETC/TCPI の各派生メトリクスを取得したい。これにより、スケジュール・コストの健全性をリアルタイムに評価できる。

#### 受け入れ基準

1. When PV is greater than 0, the EVM engine shall return `EV / PV` as SPI.
   *PV が 0 より大きい場合、EVM エンジンは `EV / PV` を SPI として返す。*

2. When PV is 0, the EVM engine shall return `null` as SPI to indicate that the value cannot be calculated.
   *PV が 0 である場合、EVM エンジンは SPI として `null` を返す（算出不能を示す）。*

3. When AC is greater than 0, the EVM engine shall return `EV / AC` as CPI.
   *AC が 0 より大きい場合、EVM エンジンは `EV / AC` を CPI として返す。*

4. When AC is 0, the EVM engine shall return `null` as CPI to indicate that the value cannot be calculated.
   *AC が 0 である場合、EVM エンジンは CPI として `null` を返す（算出不能を示す）。*

5. When SPI is not null, the EVM engine shall return `BAC / SPI` as EAC (the CPI-based EAC of `AC + (BAC - EV)` is also available).
   *SPI が null でない場合、EVM エンジンは `BAC / SPI` を EAC として返す（CPI ベース EAC は `AC + (BAC - EV)` でも算出可能）。*

6. The EVM engine shall return `BAC - EAC` as VAC.
   *EVM エンジンは `BAC - EAC` を VAC として返す。*

7. The EVM engine shall return `EAC - AC` as ETC.
   *EVM エンジンは `EAC - AC` を ETC として返す。*

8. When `BAC - AC` is not 0, the EVM engine shall return `(BAC - EV) / (BAC - AC)` as TCPI.
   *`BAC - AC` が 0 でない場合、EVM エンジンは `(BAC - EV) / (BAC - AC)` を TCPI として返す。*

9. When `BAC - AC` is 0, the EVM engine shall return `null` as TCPI.
   *`BAC - AC` が 0 である場合、EVM エンジンは TCPI として `null` を返す。*

### 要件 4: アラート評価

**目的**: プロジェクト管理者として、タスク・プロジェクトのスケジュール遅延状況をアラートレベル（critical/warning/normal/overdue）として取得したい。これにより、要対応タスクを即座に特定できる。

#### 受け入れ基準

1. When SPI is less than 0.8 or the delay in days exceeds 5, the EVM engine shall return `CRITICAL_DELAY` as the alert level.
   *SPI が 0.8 未満または遅延日数が 5 日を超える場合、EVM エンジンはアラートレベルとして `CRITICAL_DELAY` を返す。*

2. When SPI is at least 0.8 and less than 0.9, or the delay in days is between 1 and 5 inclusive, the EVM engine shall return `WARNING_DELAY` as the alert level.
   *SPI が 0.8 以上 0.9 未満または遅延日数が 1 日以上 5 日以内である場合、EVM エンジンはアラートレベルとして `WARNING_DELAY` を返す。*

3. When SPI is at least 0.9, the EVM engine shall return `NORMAL` as the alert level.
   *SPI が 0.9 以上である場合、EVM エンジンはアラートレベルとして `NORMAL` を返す。*

4. When the base date exceeds `planned_end` and the task is incomplete (`progress_pct < 100`), the EVM engine shall return `OVERDUE` as the alert level.
   *基準日が `planned_end` を超過し、かつタスクが未完了（`progress_pct < 100`）である場合、EVM エンジンはアラートレベルとして `OVERDUE` を返す。*

5. When SPI is null (i.e., PV = 0), the EVM engine shall return `NA` as the alert level.
   *SPI が null（PV = 0）である場合、EVM エンジンはアラートレベルとして `NA` を返す。*

### 要件 5: クリティカルパス算出

**目的**: プロジェクト管理者として、タスク依存グラフから最長経路（クリティカルパス）を特定したい。これにより、プロジェクトの遅延リスクが最も高いタスク連鎖を把握できる。

#### 受け入れ基準

1. When a task list and dependency list are provided, the EVM engine shall identify the task with the latest `planned_end` as the terminal node.
   *タスクリストと依存関係リストが与えられる場合、EVM エンジンは `planned_end` が最も遅いタスクを終端ノードとして特定する。*

2. When traversing `depends_on` in reverse from the terminal node, the EVM engine shall select the predecessor task with the latest `planned_end` at each step.
   *終端ノードから `depends_on` を逆方向にたどる場合、EVM エンジンは各ステップで `planned_end` が最も遅い先行タスクを選択する。*

3. The EVM engine shall trace back until `depends_on` is empty and return the critical path as a list of task IDs.
   *EVM エンジンは `depends_on` が空になるまで遡り、タスク ID のリストとしてクリティカルパスを返す。*

4. When a task has `is_buffer = true`, the EVM engine shall exclude that task from the critical path search.
   *`is_buffer = true` のタスクが含まれる場合、EVM エンジンはそのタスクをクリティカルパス探索から除外する。*

5. When a circular dependency is detected, the EVM engine shall throw an error (`EVM_CIRCULAR_DEPENDENCY`).
   *循環依存が検出された場合、EVM エンジンはエラー（`EVM_CIRCULAR_DEPENDENCY`）を throw する。*

### 要件 6: CCPM バッファ消費率・フィーバーチャート

**目的**: プロジェクト管理者として、CCPM のフィーバーチャート用のバッファ消費率とクリティカルチェーン完了率を取得したい。これにより、バッファ管理の状況を可視化するための座標データが得られる。

#### 受け入れ基準

1. When the cumulative delay days on the critical chain and the total buffer days are provided, the EVM engine shall return `cumulative delay days / total buffer days` as the buffer consumption rate.
   *クリティカルチェーン上の累積遅延日数とバッファ総日数が与えられる場合、EVM エンジンは `累積遅延日数 / バッファ総日数` をバッファ消費率として返す。*

2. When the completed EV on the critical chain and the chain BAC are provided, the EVM engine shall return `completed EV / chain BAC` as the critical chain completion rate.
   *クリティカルチェーン上の完了 EV とチェーン BAC が与えられる場合、EVM エンジンは `完了EV / チェーンBAC` をクリティカルチェーン完了率として返す。*

3. When the buffer consumption rate is less than `completion rate × 0.67`, the EVM engine shall return `GREEN` as the fever chart zone.
   *バッファ消費率が `完了率 × 0.67` 未満である場合、EVM エンジンはフィーバーチャートゾーンとして `GREEN` を返す。*

4. When the buffer consumption rate is at least `completion rate × 0.67` and less than `completion rate × 1.0`, the EVM engine shall return `YELLOW` as the fever chart zone.
   *バッファ消費率が `完了率 × 0.67` 以上かつ `完了率 × 1.0` 未満である場合、EVM エンジンはフィーバーチャートゾーンとして `YELLOW` を返す。*

5. When the buffer consumption rate is at least `completion rate × 1.0`, the EVM engine shall return `RED` as the fever chart zone.
   *バッファ消費率が `完了率 × 1.0` 以上である場合、EVM エンジンはフィーバーチャートゾーンとして `RED` を返す。*

6. When tasks with `is_buffer = true` are present, the EVM engine shall exclude those tasks from the EVM calculation and use them only for buffer management calculation.
   *`is_buffer = true` のタスクが含まれる場合、EVM エンジンはそれらのタスクを EVM 計算から除外し、バッファ管理計算にのみ使用する。*

### 要件 7: 純粋関数設計と型安全性

**目的**: 開発者として、副作用なし・DB アクセスなしの純粋関数群として EVM エンジンを利用したい。これにより、単体テストが容易になり、計算の再現性が保証される。

#### 受け入れ基準

1. The EVM engine shall perform no database access, file I/O, or external API calls, using only the snapshot data passed as arguments.
   *EVM エンジンは DB アクセス・ファイル I/O・外部 API 呼び出しを一切行わず、引数のスナップショットデータのみを使用する。*

2. The EVM engine shall accept the `Task`, `Member`, `Holiday`, and `ProgressSnapshot` types defined by core-data-model as inputs.
   *EVM エンジンは core-data-model が定義する `Task`・`Member`・`Holiday`・`ProgressSnapshot` 型を入力として受け取る。*

3. The EVM engine shall conform to TypeScript strict mode and shall not use the `any` type.
   *EVM エンジンは TypeScript strict モードに準拠し、`any` 型を使用しない。*

4. The EVM engine shall throw calculation errors (division by zero, circular dependency, invalid base date) as `AppError` with `EVM_*` error codes.
   *EVM エンジンは計算エラー（ゼロ除算・循環依存・無効な基準日）を `AppError`（`EVM_*` エラーコード）として throw する。*

5. The EVM engine shall reference error codes from the `ErrorCode` constants and shall not hard-code string literals.
   *EVM エンジンはエラーコードを `ErrorCode` 定数から参照し、文字列リテラルの直書きを行わない。*

### 要件 8: 単体テスト

**目的**: 開発者として、EVM エンジンの全計算関数が境界値・エラーケースで正しく動作することを自動テストで検証したい。これにより、将来の変更でのリグレッションを防止できる。

#### 受け入れ基準

1. The EVM engine shall test PV calculation boundary values (base date < start date, base date = start date, base date >= end date) using Vitest.
   *EVM エンジンは PV 計算の境界値（基準日＜開始日、基準日＝開始日、基準日≥終了日）を Vitest でテストする。*

2. The EVM engine shall test that SPI and CPI return null when PV = 0 and AC = 0 respectively, using Vitest.
   *EVM エンジンは SPI・CPI の PV=0・AC=0 時の null 返却を Vitest でテストする。*

3. The EVM engine shall test the normal critical path case and the circular-dependency error case using Vitest.
   *EVM エンジンはクリティカルパスの正常系・循環依存エラーを Vitest でテストする。*

4. The EVM engine shall test fever chart Green/Yellow/Red zone determination using Vitest.
   *EVM エンジンはフィーバーチャートの Green/Yellow/Red ゾーン判定を Vitest でテストする。*

5. The EVM engine shall test all alert level branches (CRITICAL_DELAY/WARNING_DELAY/NORMAL/OVERDUE/NA) using Vitest.
   *EVM エンジンはアラートレベルの全分岐（CRITICAL_DELAY/WARNING_DELAY/NORMAL/OVERDUE/NA）を Vitest でテストする。*

6. The EVM engine shall test the difference in PV calculation with and without holidays using Vitest.
   *EVM エンジンは祝日を含む PV 計算と祝日なし PV 計算の差異を Vitest でテストする。*
