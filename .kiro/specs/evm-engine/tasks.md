# Implementation Plan

- [ ] 1. 基盤整備: エラーコードと型エクスポートの確認
- [x] 1.1 EVM エラーコードを `errors/codes.ts` に整備する
  - `server/src/errors/codes.ts` の `ErrorCode` オブジェクトに `EVM_INVALID_BASE_DATE` / `EVM_INVALID_AVAILABILITY_RATE` / `EVM_CIRCULAR_DEPENDENCY` が存在することを確認し、不足があれば追加する
  - 文字列リテラル直書き禁止規約に従い、`as const` でリテラル型を維持する
  - 追加後、`tsc --noEmit` でコンパイルエラーが出ないことで完了を確認できる
  - _Requirements: 11.4_
  - _Boundary: ErrorsLayer_

- [x] 1.2 (P) Drizzle 推論型のエクスポートを確認する
  - `server/src/db/schema.ts` から `Project` / `Task` / `Member` / `Holiday` / `ProgressSnapshot` / `TaskDependency` 型が型エクスポートされていることを確認する
  - 不足している場合は `core-data-model` spec へ差分修正を依頼するメモを残す（本スペックでは型を追加しない）
  - `services/evm-*.ts` から `import type { Project, Task, ... } from '../db/schema'` でインポート可能なことで完了を確認できる
  - _Requirements: 10.1, 10.4_
  - _Boundary: DataLayer_

- [ ] 2. コア計算: `evm-engine.ts` の拡張
- [x] 2.1 既存の純粋関数を確認しテストファイル骨格を準備する
  - `server/src/services/evm-engine.ts` の `countWorkingDays` / `calculateTaskPv` / `calculateProjectPv` / `calculateEvmMetrics` の現状シグネチャを確認する
  - 不足している入力（`Project.startDate` 等）がある場合は `EvmInput` 型を拡張する
  - `server/src/services/evm-engine.test.ts` に `describe('calculateEvmMetrics')` 等の空ブロックを用意する
  - `npm test -- evm-engine` がテスト 0 件パスで完了することで動作確認できる
  - _Requirements: 1.1-1.10, 10.1, 10.2_
  - _Boundary: EvmEngine_

- [x] 2.2 `calculatePrevDate` を実装する
  - `calculatePrevDate(baseDate: string, holidays: ReadonlyArray<Holiday>, override?: string): string` を実装する
  - `override` 指定時はその値をそのまま返す
  - 未指定時は `baseDate - 1 日` から土日（`getDay() === 0 || 6`）と `holidays.date` を除外し直近の営業日を返す
  - 日付計算は UTC ベース（`Date.UTC`）で行い、タイムゾーンずれを起こさない
  - `baseDate` 形式不正時は `AppError(ErrorCode.EVM_INVALID_BASE_DATE)` をスローする
  - Vitest で「土日スキップ」「holidays スキップ」「override 採用」「不正 baseDate でスロー」の 4 ケースが緑になることで完了を確認できる
  - _Requirements: 2.1, 2.2, 11.1, 11.4_
  - _Boundary: EvmEngine_
  - _Depends: 1.1_

- [x] 2.3 (P) `calculatePrevDayDelta` を実装する
  - `calculatePrevDayDelta(current: EvmSummary, previous: EvmSummary | null): { spiDelta: number; cpiDelta: number }` を実装する
  - `previous === null`、または `current.spi`/`previous.spi`/`current.cpi`/`previous.cpi` のいずれかが `null` のとき対応する Delta を `0` とする
  - それ以外は `current.spi - previous.spi` / `current.cpi - previous.cpi` を返す
  - Vitest で「previous が null」「片方の spi が null」「正常差分」の 3 ケースが緑になることで完了を確認できる
  - _Requirements: 2.6, 2.7_
  - _Boundary: EvmEngine_
  - _Depends: 2.1_

- [x] 2.4 `calculateEvmMetrics` の境界値テストを補強する
  - `pv = 0` → `spi = null`、`ac = 0` → `cpi = null`、`bac - ac = 0` → `tcpi = null`、`spi !== null && spi > 0` のとき `eac = bac / spi` のケースを Vitest に追加する
  - 既存のロジックに修正が必要な場合は 1.10 に従って関数を更新する
  - 4 ケース以上が新規パスすることで完了を確認できる
  - _Requirements: 1.5-1.10, 13.1_
  - _Boundary: EvmEngine_
  - _Depends: 2.1_

- [ ] 3. 担当者別集計: `evm-assignees.ts`
- [x] 3.1 (P) `aggregateAssignees` を実装する
  - `server/src/services/evm-assignees.ts` に `aggregateAssignees({ baseDate, members, tasks, snapshots, holidays })` を実装する
  - メンバーごとに担当タスクをグループ化し、`bac` / `ev` / `pv`（`calculateTaskPv` を再利用）/ `ac` を合計する
  - `pv > 0 && ac > 0` のとき `spi = ev / pv`、`cpi = ev / ac`、それ以外は対応値を `null` にする
  - `status` を SPI 閾値で `'critical'`（`< 0.8`）/ `'warning'`（`< 0.9`）/ `'normal'`（`>= 0.9` または `null`）で決定する
  - 担当タスクなしのメンバーも `{ bac:0, ev:0, pv:0, ac:0, spi:null, cpi:null, status:'normal' }` で 1 件返す
  - Vitest で「複数タスク」「タスク未割当」「`availabilityRate=0.5`」「`spi=null` の status」の 4 ケースが緑になることで完了を確認できる
  - _Requirements: 3.1-3.10_
  - _Boundary: EvmAssignees_
  - _Depends: 2.1_

- [x] 3.2 (P) `aggregateAssigneesAt` を実装する（前日比用）
  - `aggregateAssigneesAt({ baseDate: prevDate, ... })` を実装し、`{ id, ev, pv, ac, spi, cpi }` のみを返す（status は含めない）
  - 内部実装は `aggregateAssignees` と共有する private helper を経由する
  - Vitest で「prevDate 時点の数値が baseDate 時点と異なる」ケースが緑になることで完了を確認できる
  - _Requirements: 2.4_
  - _Boundary: EvmAssignees_
  - _Depends: 3.1_

- [ ] 4. SPI トレンド: `evm-trend.ts`
- [x] 4.1 (P) `buildSpiTrend` を実装する
  - `server/src/services/evm-trend.ts` に `buildSpiTrend({ baseDate, trendWindowDays?, project, tasks, members, holidays, snapshots })` を実装する
  - スナップショット日付の集合 `D` を `[start, baseDate]` 範囲（`trendWindowDays` 指定時はそれで絞る）で抽出し、昇順に並べる
  - 各 `d ∈ D` で `calculateEvmMetrics({ baseDate: d, ... })` を実行し `{ d: 'MM-DD', spi, cpi }` を生成する
  - 0 件のとき `[]` を返す
  - Vitest で「windowDays 指定あり / なし」「スナップショット 0 件」「spi=null の点を含める」の 3 ケースが緑になることで完了を確認できる
  - _Requirements: 5.1-5.6_
  - _Boundary: EvmTrend_
  - _Depends: 2.1_

- [ ] 5. フィーバーチャート: `evm-fever.ts`
- [x] 5.1 (P) `calculateFever` を実装する
  - `server/src/services/evm-fever.ts` に `calculateFever({ baseDate, tasks, dependencies, snapshots, holidays, trendWindowDays? })` を実装する
  - `critical-path.ts` の `findCriticalChain(tasks, dependencies)` でクリティカルチェーンを特定する
  - バッファタスクがプロジェクトに存在しない場合は `null` を返す
  - `bufferConsumption = 累積遅延日数 / バッファ総日数`、`criticalChainCompletion = 完了 EV / クリティカルチェーン BAC` を算出する
  - `bufferTotalDays === 0` または `bacOfChain === 0` のときは消費率・完了率を `0` として扱う
  - ゾーン判定: `consumption < completion * 0.67` → GREEN、`< completion * 1.0` → YELLOW、それ以上 → RED
  - `trail` を `trendWindowDays`（既定 30）日分のスナップショット日ごとに `(x: completion, y: consumption)` で時系列順に返す
  - Vitest で「バッファ非存在で null」「GREEN/YELLOW/RED 境界」「`bufferTotalDays=0` 防御」が緑になることで完了を確認できる
  - _Requirements: 6.1-6.6, 11.3_
  - _Boundary: EvmFever_
  - _Depends: 2.1_

- [ ] 6. タスクロールアップとアラート: `evm-tasks.ts`
- [x] 6.1 `rollupTasks` を実装する
  - `server/src/services/evm-tasks.ts` に `rollupTasks({ project, tasks, members, snapshots, holidays, baseDate })` を実装する
  - 各タスクについて `start = days(plannedStart - project.startDate)`、`end = days(plannedEnd - project.startDate)` を整数で返す
  - 葉タスク（`isLeaf === true`）: 最新スナップショットの `progressPct` を `progress`、`pv > 0` のとき `spi = ev / pv` を、それ以外 `null` を返す
  - 親タスク: 子葉タスクの BAC 加重平均で `progress` を、子葉タスクの `ev` 合計 / `pv` 合計で `spi` を算出する（`pv 合計 = 0` のとき `null`）
  - `assignee` を `Task.assigneeId → Member.name` に解決する（バッファや未割当は `null`）
  - `code` の階層辞書順（`1` < `1.1` < `1.2` < `2`）で安定ソートして返却する
  - Vitest で「葉タスク SPI」「親タスク BAC 加重平均」「WBS ソート」「assignee 解決」「buffer フラグ」の 5 ケースが緑になることで完了を確認できる
  - _Requirements: 7.1-7.7_
  - _Boundary: EvmTasks_
  - _Depends: 2.1_

- [x] 6.2 `rollupTasksPrevDiff` を実装する
  - 前日 (`prevDate`) 時点のスナップショットから、進捗が存在する葉タスクのみ `{ id, progress, spi }` を返す
  - 内部で `rollupTasks` を `baseDate = prevDate` で呼び出し、結果から `leaf === true && progress !== undefined` のものをフィルタする
  - Vitest で「prevDate スナップショットが存在するタスクのみ返す」が緑になることで完了を確認できる
  - _Requirements: 2.5_
  - _Boundary: EvmTasks_
  - _Depends: 6.1_

- [x] 6.3 (P) `filterAlerts` を実装する
  - 葉タスクの `spi` が `< 0.8` → `level: 'critical'`、`[0.8, 0.9)` → `level: 'warning'` のアラートを生成する
  - `spi === null` または `>= 0.9` は除外する
  - `spi` 昇順（重大度順）でソートして返す
  - 0 件のとき空配列 `[]` を返す
  - Vitest で `spi = 0.79 / 0.80 / 0.89 / 0.90 / 1.00 / null` の 6 境界点が期待通り判定されることで完了を確認できる
  - _Requirements: 4.1-4.6, 13.4_
  - _Boundary: EvmTasks_
  - _Depends: 6.1_

- [ ] 7. ガントメタデータ: `evm-gantt.ts`
- [x] 7.1 (P) `buildGanttMeta` を実装する
  - `server/src/services/evm-gantt.ts` に `buildGanttMeta({ project, baseDate })` を実装する
  - `totalDays = (endISO - startISO) + 1`（両端含む暦日数）として算出する
  - `baseDay = days(baseDate - startISO)` の整数値を算出し、`baseDate < startISO` のとき `0` に、`baseDate > endISO` のとき `totalDays - 1` にクリップする
  - `months` は `startISO ～ endISO` 範囲の各月初について `{ d: 相対日数, l: '5月' 形式の日本語ラベル }` を時系列順に返す。`startISO` を含む月は必ず先頭に出す
  - Vitest で「両端含む totalDays」「baseDay クリップ」「months 月初検出」の 3 ケースが緑になることで完了を確認できる
  - _Requirements: 8.1-8.6_
  - _Boundary: EvmGantt_

- [ ] 8. tRPC ルーター: `api/evm.ts`
- [x] 8.1 Zod 入力スキーマと型エクスポートを定義する
  - `server/src/api/evm.ts` に `evmCalculateSchema = z.object({ projectId, baseDate, options? })` を定義する
  - `EvmCalculateInput` / `EvmCalculateOutput` 型をエクスポートする
  - `options.prevDate` / `options.trendWindowDays` が optional であることを確認する
  - 既存ルーターから本スキーマが参照され、`tsc --noEmit` がパスすることで完了を確認できる
  - _Requirements: 9.1, 9.5_
  - _Boundary: EvmRouter_
  - _Depends: 1.1_

- [x] 8.2 `evm.calculate` を集約レスポンス対応に書き換える
  - tRPC `evm.calculate` の `query` ハンドラ内で 1 度に DB I/O を実行する: project / tasks / task_dependencies / members / holidays / progress_snapshots（範囲: `project.startDate ～ baseDate`）
  - `progress-tracking` の `progress.getByDateRange({ projectId, startDate: project.startDate, endDate: baseDate })` 範囲取得 API を利用し、戻り値 `Array<{taskId, snapshotDate, progressPct, acDays}>` を取得する（未実装の場合は Drizzle で `between(snapshotDate, project.startDate, baseDate)` を直接実行）
  - 取得結果を `evm-engine` / `evm-assignees` / `evm-trend` / `evm-fever` / `evm-tasks` / `evm-gantt` に渡し、`EvmCalculateOutput` を組み立てる
  - `projectId` 未存在時に `TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCode.PROJ_NOT_FOUND) })` をスローする
  - `EVM_INVALID_BASE_DATE` を `BAD_REQUEST` に、`EVM_INVALID_AVAILABILITY_RATE` / `EVM_CIRCULAR_DEPENDENCY` を `INTERNAL_SERVER_ERROR` に変換する
  - pino で `{ projectId, baseDate, durationMs }` を info ログとして出力する（個人情報は含めない）
  - 動作確認: `curl` or `tRPC client` で `evm.calculate({ projectId: 1, baseDate: '2026-05-13' })` を呼び出し、レスポンスに `summary` / `prevDay` / `assignees` / `alerts` / `spiTrend` / `fever` / `tasks` / `gantt` の全キーが含まれることで完了を確認できる
  - _Requirements: 9.1-9.6, 11.5, 12.1, 12.2_
  - _Boundary: EvmRouter_
  - _Depends: 2.2, 2.3, 3.1, 3.2, 4.1, 5.1, 6.1, 6.2, 6.3, 7.1, 8.1_

- [ ] 9. 統合テストと性能検証
- [ ] 9.1 `evm.calculate` 統合テストを実装する
  - `server/src/api/evm.test.ts` を新規作成する
  - モックアップ `mockup/projects-data.jsx` の `PROJECT_DATA[0]`（NXP-002）相当のフィクスチャを `__fixtures__/nxp-002.ts` に配置する（プロジェクト・タスク・メンバー・スナップショット・休日）
  - `evm.calculate({ projectId: 1, baseDate: '2026-05-13' })` の出力に `summary` / `prevDay` / `assignees` / `alerts` / `spiTrend` / `fever` / `tasks` / `gantt` の全キーが含まれることを assert する
  - `summary.spi` / `summary.cpi` / `summary.spiDelta` がモックアップ期待値と `± 0.005` 以内で一致することを assert する
  - `prevDay` 存在時に `prevDay.summary` / `prevDay.assignees`（`AssigneePrevDay[]`）/ `prevDay.tasks`（`TaskPrevDiff[]`）の 3 キーが全て揃い、`prevDay.assignees[].spi` と `prevDay.tasks[].progress` が baseDate 時点の値と異なることを assert する
  - `prevDay` 不在時に `prevDay === null` かつ `summary.spiDelta === 0` / `summary.cpiDelta === 0` であることを assert する
  - `npm test -- evm` で 2 ケース以上が緑になることで完了を確認できる
  - _Requirements: 13.6, 9.4_
  - _Boundary: EvmRouter_
  - _Depends: 8.2_

- [ ] 9.2 (P) エラー伝搬の統合テストを追加する
  - `evm.calculate` に `baseDate = '2026/05/13'`（フォーマット不正）を渡し `BAD_REQUEST` が返ることを検証する
  - `projectId = 99999`（未存在）を渡し `NOT_FOUND` が返り `cause.code === 'PROJ_NOT_FOUND'` であることを検証する
  - 2 ケースが緑になることで完了を確認できる
  - _Requirements: 9.2, 9.3, 11.5_
  - _Boundary: EvmRouter_
  - _Depends: 8.2_

- [ ] 9.3 (P) パフォーマンスベンチを追加する
  - `server/src/api/evm.bench.ts` を作成し、100 タスク・5 メンバー・60 日分スナップショットの入力で `evm.calculate` を 50 回実行する
  - p95 が 200ms 以内であることを Vitest `bench` で assert する
  - 計測結果が CI ログに出力されることで完了を確認できる
  - _Requirements: 12.1_
  - _Boundary: EvmRouter_
  - _Depends: 8.2_

- [ ] 9.4 `npm test` をフルパスさせる
  - すべての新規・既存テストが `npm test` で緑になることを確認する
  - 失敗テストがあればモジュール単位で原因を切り分けて修正する
  - `npm test` のサマリーで合計テスト件数とパス件数が一致することで完了を確認できる
  - _Requirements: 13.7_
  - _Boundary: TestSuite_
  - _Depends: 9.1, 9.2, 9.3_
