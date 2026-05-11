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

1. When 基準日がタスクの `planned_start` より前である, the EVM エンジン shall そのタスクの PV として `0` を返す
2. When 基準日がタスクの `planned_end` 以降である, the EVM エンジン shall そのタスクの PV として `estimate_days`（タスクBAC）を返す
3. When 基準日が `planned_start` 以上かつ `planned_end` 未満である, the EVM エンジン shall `planned_start` から基準日までの稼働日数（土日および祝日を除外）N を算出し、`min(N × availability_rate, estimate_days)` をタスク PV として返す
4. When 祝日リストが与えられる, the EVM エンジン shall 当該日付を稼働日数の計算から除外する
5. When `is_buffer = true` のタスクが含まれる, the EVM エンジン shall そのタスクを PV 累積の計算から除外する
6. The EVM エンジン shall プロジェクト全体の累積 PV を全タスクの個別 PV の合計として返す

### 要件 2: EV・AC 計算

**目的**: プロジェクト管理者として、基準日時点の EV（Earned Value）および AC（Actual Cost）を取得したい。これにより、実際の進捗とコスト投入量を定量的に把握できる。

#### 受け入れ基準

1. When タスクの `progress_pct` が与えられる, the EVM エンジン shall `estimate_days × (progress_pct / 100)` をそのタスクの EV として返す
2. The EVM エンジン shall プロジェクト全体の累積 EV を全タスクの個別 EV の合計として返す
3. When `is_buffer = true` のタスクが含まれる, the EVM エンジン shall そのタスクを EV 累積の計算から除外する
4. The EVM エンジン shall `ProgressSnapshot.ac_days` の合計値をプロジェクト全体の AC として返す

### 要件 3: EVM 派生メトリクス計算

**目的**: プロジェクト管理者として、SPI/CPI/EAC/VAC/ETC/TCPI の各派生メトリクスを取得したい。これにより、スケジュール・コストの健全性をリアルタイムに評価できる。

#### 受け入れ基準

1. When PV が 0 より大きい, the EVM エンジン shall `EV / PV` を SPI として返す
2. If PV が 0 である, the EVM エンジン shall SPI として `null` を返す（算出不能を示す）
3. When AC が 0 より大きい, the EVM エンジン shall `EV / AC` を CPI として返す
4. If AC が 0 である, the EVM エンジン shall CPI として `null` を返す（算出不能を示す）
5. When SPI が null でない, the EVM エンジン shall `BAC / SPI` を EAC（CPI ベース EAC も `AC + (BAC - EV)` で算出可能）として返す
6. The EVM エンジン shall `BAC - EAC` を VAC として返す
7. The EVM エンジン shall `EAC - AC` を ETC として返す
8. When `BAC - AC` が 0 でない, the EVM エンジン shall `(BAC - EV) / (BAC - AC)` を TCPI として返す
9. If `BAC - AC` が 0 である, the EVM エンジン shall TCPI として `null` を返す

### 要件 4: アラート評価

**目的**: プロジェクト管理者として、タスク・プロジェクトのスケジュール遅延状況をアラートレベル（critical/warning/normal/overdue）として取得したい。これにより、要対応タスクを即座に特定できる。

#### 受け入れ基準

1. When SPI が 0.8 未満または遅延日数が 5 日を超える, the EVM エンジン shall アラートレベルとして `CRITICAL_DELAY` を返す
2. When SPI が 0.8 以上 0.9 未満または遅延日数が 1 日以上 5 日以内である, the EVM エンジン shall アラートレベルとして `WARNING_DELAY` を返す
3. When SPI が 0.9 以上である, the EVM エンジン shall アラートレベルとして `NORMAL` を返す
4. When 基準日が `planned_end` を超過し、かつタスクが未完了（`progress_pct < 100`）である, the EVM エンジン shall アラートレベルとして `OVERDUE` を返す
5. If SPI が null（PV = 0）である, the EVM エンジン shall アラートレベルとして `NA` を返す

### 要件 5: クリティカルパス算出

**目的**: プロジェクト管理者として、タスク依存グラフから最長経路（クリティカルパス）を特定したい。これにより、プロジェクトの遅延リスクが最も高いタスク連鎖を把握できる。

#### 受け入れ基準

1. When タスクリストと依存関係リストが与えられる, the EVM エンジン shall `planned_end` が最も遅いタスクを終端ノードとして特定する
2. When 終端ノードから `depends_on` を逆方向にたどる, the EVM エンジン shall 各ステップで `planned_end` が最も遅い先行タスクを選択する
3. The EVM エンジン shall `depends_on` が空になるまで遡り、タスク ID のリストとしてクリティカルパスを返す
4. When `is_buffer = true` のタスクが含まれる, the EVM エンジン shall そのタスクをクリティカルパス探索から除外する
5. If 循環依存が検出される, the EVM エンジン shall エラー（`EVM_CIRCULAR_DEPENDENCY`）を throw する

### 要件 6: CCPM バッファ消費率・フィーバーチャート

**目的**: プロジェクト管理者として、CCPM のフィーバーチャート用のバッファ消費率とクリティカルチェーン完了率を取得したい。これにより、バッファ管理の状況を可視化するための座標データが得られる。

#### 受け入れ基準

1. When クリティカルチェーン上の累積遅延日数とバッファ総日数が与えられる, the EVM エンジン shall `累積遅延日数 / バッファ総日数` をバッファ消費率として返す
2. When クリティカルチェーン上の完了 EV とチェーン BAC が与えられる, the EVM エンジン shall `完了EV / チェーンBAC` をクリティカルチェーン完了率として返す
3. When バッファ消費率が `完了率 × 0.67` 未満である, the EVM エンジン shall フィーバーチャートゾーンとして `GREEN` を返す
4. When バッファ消費率が `完了率 × 0.67` 以上かつ `完了率 × 1.0` 未満である, the EVM エンジン shall フィーバーチャートゾーンとして `YELLOW` を返す
5. When バッファ消費率が `完了率 × 1.0` 以上である, the EVM エンジン shall フィーバーチャートゾーンとして `RED` を返す
6. When `is_buffer = true` のタスクが含まれる, the EVM エンジン shall それらのタスクを EVM 計算から除外し、バッファ管理計算にのみ使用する

### 要件 7: 純粋関数設計と型安全性

**目的**: 開発者として、副作用なし・DB アクセスなしの純粋関数群として EVM エンジンを利用したい。これにより、単体テストが容易になり、計算の再現性が保証される。

#### 受け入れ基準

1. The EVM エンジン shall DB アクセス・ファイル I/O・外部 API 呼び出しを一切行わない（引数のスナップショットデータのみを使用する）
2. The EVM エンジン shall core-data-model が定義する `Task`・`Member`・`Holiday`・`ProgressSnapshot` 型を入力として受け取る
3. The EVM エンジン shall TypeScript strict モードに準拠し、`any` 型を使用しない
4. The EVM エンジン shall 計算エラー（ゼロ除算・循環依存・無効な基準日）を `AppError`（`EVM_*` エラーコード）として throw する
5. The EVM エンジン shall エラーコードを `ErrorCode` 定数から参照し、文字列リテラルの直書きを行わない

### 要件 8: 単体テスト

**目的**: 開発者として、EVM エンジンの全計算関数が境界値・エラーケースで正しく動作することを自動テストで検証したい。これにより、将来の変更でのリグレッションを防止できる。

#### 受け入れ基準

1. The EVM エンジン shall PV 計算の境界値（基準日＜開始日、基準日＝開始日、基準日≥終了日）を Vitest でテストする
2. The EVM エンジン shall SPI・CPI の PV=0・AC=0 時の null 返却を Vitest でテストする
3. The EVM エンジン shall クリティカルパスの正常系・循環依存エラーを Vitest でテストする
4. The EVM エンジン shall フィーバーチャートの Green/Yellow/Red ゾーン判定を Vitest でテストする
5. The EVM エンジン shall アラートレベルの全分岐（CRITICAL_DELAY/WARNING_DELAY/NORMAL/OVERDUE/NA）を Vitest でテストする
6. The EVM エンジン shall 祝日を含む PV 計算と祝日なし PV 計算の差異を Vitest でテストする
