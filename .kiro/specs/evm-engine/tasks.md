# 実装計画: evm-engine

- [ ] 1. 基盤: エラーコード追加とテスト環境確認
- [x] 1.1 EVM エラーコードを codes.ts に追加する
  - `server/src/errors/codes.ts` の `ErrorCode` オブジェクトに `EVM_INVALID_BASE_DATE`, `EVM_INVALID_AVAILABILITY_RATE`, `EVM_CIRCULAR_DEPENDENCY` を追加する
  - 文字列リテラルの直書きはせず、既存の `ErrorCode` パターンに従う
  - TypeScript コンパイルが通ることで追加コードが正しいことを確認できる
  - _Requirements: 7.4, 7.5_

- [x] 1.2 Vitest テストファイルを空ファイルとして作成する
  - `server/src/services/evm-engine.test.ts` を作成し、`describe` ブロックのスケルトンのみ記述する
  - `npm test` を実行してテストランナーが正常に起動することを確認する
  - _Requirements: 8.1_

- [ ] 2. コア: evm-engine.ts の純粋関数実装
- [x] 2.1 稼働日数カウントユーティリティを実装する
  - `countWorkingDays(plannedStart, baseDate, holidays)` を実装する
  - 土曜（getDay()===6）と日曜（getDay()===0）を除外する
  - `holidays[]` の `date` フィールドと一致する日を除外する
  - 日付を UTC ベース（`Date.UTC`）で処理しタイムゾーンズレを防ぐ
  - 関数が `server/src/services/evm-engine.ts` からエクスポートされていることで完了を確認できる
  - _Requirements: 1.3, 1.4, 7.1, 7.3_
  - _Boundary: EvmEngine_

- [x] 2.2 (P) タスク単体 PV 計算関数を実装する（fill-to-capacity モデル）
  - `calculateTaskPv(task, baseDate, availabilityRate, holidays)` を実装する
  - `task.isBuffer === true` の場合は `0` を返す（バッファ除外）
  - `baseDate < task.plannedStart` の場合は `0` を返す
  - `baseDate >= task.plannedEnd` の場合は `task.estimateDays` を返す
  - その他: `N = countWorkingDays(...)` を呼び出し `Math.min(N * availabilityRate, task.estimateDays)` を返す
  - `baseDate` のフォーマット不正時は `AppError(EVM_INVALID_BASE_DATE)` を throw する
  - `availabilityRate` が `[0, 1]` 範囲外の場合は `AppError(EVM_INVALID_AVAILABILITY_RATE)` を throw する
  - 単体テストで基準日の 3 ケースが全て意図通りに通ることで完了を確認できる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.4_
  - _Boundary: EvmEngine_
  - _Depends: 2.1_

- [x] 2.3 (P) プロジェクト累積 PV・EV・AC 計算関数を実装する
  - `calculateProjectPv(input: EvmInput)` を実装する: `tasks.filter(t => !t.isBuffer)` に対し各タスクの `calculateTaskPv` を呼び出して合計する。`assigneeId` から `members` を引いて `availabilityRate` を取得し、見つからない場合は `1.0` を使用する
  - `calculateTaskEv(task, progressPct)` を実装する: `task.estimateDays * (progressPct / 100)`
  - `calculateProjectEv(tasks, snapshots)` を実装する: `is_buffer` 除外タスクの EV 合計（`snapshots` から `progressPct` を参照）
  - `calculateProjectAc(snapshots)` を実装する: `snapshots` の `acDays` 合計
  - 各関数が期待値を返すことを単体テストで確認できる
  - _Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2_
  - _Boundary: EvmEngine_
  - _Depends: 2.2_

- [x] 2.4 派生メトリクス計算関数を実装する（SPI/CPI/EAC/VAC/ETC/TCPI）
  - `calculateEvmMetrics(input: EvmInput): ProjectEvmMetrics` を実装する
  - SPI: `pv > 0 ? ev / pv : null`
  - CPI: `ac > 0 ? ev / ac : null`
  - EAC: `spi !== null ? bac / spi : null`（SPI ベース）
  - VAC: `eac !== null ? bac - eac : null`
  - ETC: `eac !== null ? eac - ac : null`
  - TCPI: `(bac - ac) !== 0 ? (bac - ev) / (bac - ac) : null`
  - `taskMetrics` に各タスクの PV/EV/AC/SPI/CPI/alertLevel を含める
  - PV=0 で SPI が null、AC=0 で CPI が null になることを単体テストで確認できる
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 7.3_
  - _Boundary: EvmEngine_
  - _Depends: 2.3_

- [x] 2.5 アラートレベル評価関数を実装する
  - `evaluateAlertLevel(spi, delayDays, isOverdue): AlertLevel` を実装する
  - `spi === null` → `'NA'`
  - `isOverdue && progress_pct < 100` → `'OVERDUE'`（isOverdue は呼び出し側が評価して渡す）
  - `spi < 0.8 || delayDays > 5` → `'CRITICAL_DELAY'`
  - `spi < 0.9 || delayDays > 0` → `'WARNING_DELAY'`
  - `spi >= 0.9` → `'NORMAL'`
  - 全 5 分岐が単体テストで確認できる
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.3_
  - _Boundary: EvmEngine_

- [x] 2.6 CCPM フィーバーチャート計算関数を実装する
  - `calculateFeverChart(cumulativeDelayDays, bufferTotalDays, completedEvOnChain, bacOfChain): FeverChartData` を実装する
  - `bufferConsumption = cumulativeDelayDays / bufferTotalDays`
  - `criticalChainCompletion = completedEvOnChain / bacOfChain`
  - ゾーン判定: `bufferConsumption < criticalChainCompletion * 0.67` → `'GREEN'`、`< criticalChainCompletion * 1.0` → `'YELLOW'`、それ以上 → `'RED'`
  - `bufferTotalDays = 0` や `bacOfChain = 0` のケースはゼロ除算になるため、呼び出し側の責任とし関数内では防御チェックのみ行う（NaN を防ぐため 0 除算時は consumption/completion を 0 とする）
  - GREEN/YELLOW/RED 境界値テストが通ることで完了を確認できる
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.3_
  - _Boundary: EvmEngine_

- [ ] 3. コア: critical-path.ts の純粋関数実装
- [x] 3.1 クリティカルパス算出関数を実装する
  - `findCriticalPath(input: CriticalPathInput): CriticalPathResult` を実装する
  - `tasks.filter(t => !t.isBuffer)` で is_buffer タスクを除外する
  - 除外後のタスクから `plannedEnd` 最遅のタスクを終端として特定する（同着の場合は最初に見つかったものを選択）
  - 訪問済み ID を `Set<number>` で管理し、終端から `dependsOnTaskId` をたどって先行タスクを選択する（各ステップで `plannedEnd` 最遅の先行を選択）
  - 再訪問を検出したら `AppError(ErrorCode.EVM_CIRCULAR_DEPENDENCY, ...)` を throw する
  - `depends_on` が空になったら収集した ID 配列を `reverse()` して `{ criticalPath, terminalTaskId }` を返す
  - 正常系（3 タスク直列）テストと循環依存エラーテストが通ることで完了を確認できる
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.3, 7.4_
  - _Boundary: CriticalPath_

- [ ] 4. 統合: 単体テストの全ケース実装
- [x] 4.1 PV 計算テストを実装する
  - 境界値 3 ケース（before/during/after planned period）の各パターンをアサートする
  - 稼働率 `0.6` で `min(N * 0.6, estimate_days)` のキャップ動作をアサートする
  - 祝日あり vs 祝日なしで稼働日数に差異が生じることをアサートする
  - `is_buffer = true` タスクが PV に含まれないことをアサートする
  - `npm test` で全アサーションがグリーンになることで完了を確認できる
  - _Requirements: 8.1, 8.6_
  - _Depends: 2.2, 2.3_

- [x] 4.2 (P) EV/AC・派生メトリクステストを実装する
  - `progress_pct = 0/50/100` での EV をアサートする
  - `is_buffer = true` タスクが EV 累積から除外されることをアサートする
  - SPI: `PV = 0` で `null`、正常値 `EV=2, PV=4` で `0.5` をアサートする
  - CPI: `AC = 0` で `null`、正常値をアサートする
  - EAC/VAC/ETC/TCPI の計算値をアサートする（TCPI: `BAC-AC = 0` で `null`）
  - `npm test` で全アサーションがグリーンになることで完了を確認できる
  - _Requirements: 8.2_
  - _Depends: 2.4_

- [x] 4.3 (P) アラートレベルテストを実装する
  - `SPI = 0.75` → `CRITICAL_DELAY` をアサートする
  - `delayDays = 7` → `CRITICAL_DELAY` をアサートする
  - `SPI = 0.85` → `WARNING_DELAY` をアサートする
  - `delayDays = 2` → `WARNING_DELAY` をアサートする
  - `SPI = 0.95` → `NORMAL` をアサートする
  - `isOverdue = true` → `OVERDUE` をアサートする
  - `SPI = null` → `NA` をアサートする
  - `npm test` で全アサーションがグリーンになることで完了を確認できる
  - _Requirements: 8.5_
  - _Depends: 2.5_

- [x] 4.4 (P) クリティカルパステストを実装する
  - 3 タスク直列（A→B→C）で `[A.id, B.id, C.id]` が返ることをアサートする
  - 2 経路がある場合（A→B→D と A→C→D）で `plannedEnd` 最遅の経路が選択されることをアサートする
  - `is_buffer = true` タスクがパスから除外されることをアサートする
  - 循環依存（A→B→A）で `EVM_CIRCULAR_DEPENDENCY` が throw されることをアサートする
  - `npm test` で全アサーションがグリーンになることで完了を確認できる
  - _Requirements: 8.3_
  - _Depends: 3.1_

- [x] 4.5 (P) フィーバーチャートテストを実装する
  - `bufferConsumption = 0.2, completion = 0.5` → `GREEN` をアサートする（0.2 < 0.5×0.67=0.335）
  - `bufferConsumption = 0.4, completion = 0.5` → `YELLOW` をアサートする（0.4 ≥ 0.335 かつ < 0.5）
  - `bufferConsumption = 0.6, completion = 0.5` → `RED` をアサートする（0.6 ≥ 0.5）
  - `npm test` で全アサーションがグリーンになることで完了を確認できる
  - _Requirements: 8.4_
  - _Depends: 2.6_

## Implementation Notes

- タスク2.4/2.5統合: `calculateEvmMetrics` は `evaluateAlertLevel(taskSpi, 0, isOverdue)` を呼び出す。`delayDays` は常に `0` のため、delayDays経由の CRITICAL_DELAY/WARNING_DELAY 分岐は calculateEvmMetrics からは到達不能。isOverdue/SPI経由のアラートは正常動作。将来 delayDays の算出（plannedEnd超過日数）が必要な場合は calculateEvmMetrics の修正が必要。
