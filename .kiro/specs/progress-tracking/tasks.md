# Implementation Plan

## Tasks

- [x] 1. 基盤: スキーマ拡張とエラーコード追加
- [x] 1.1 progress_snapshots テーブルに note カラムを追加する
  - `evm-studio/server/src/db/schema.ts` の `progressSnapshots` テーブル定義に `note: text('note')` を追加する（NULL 許容、デフォルト値なし、既存列は変更しない）
  - Drizzle 推論型 `ProgressSnapshot` に `note: string | null` が含まれることを TypeScript で確認する
  - `npx drizzle-kit check` が新しいスキーマと既存マイグレーションの整合性チェックを通すこと（または手動レビューで差分が note 列追加のみであること）
  - _Requirements: 1.1_
  - _Boundary: DBSchema_

- [x] 1.2 マイグレーション 0002 を生成して note 列を追加する
  - `npx drizzle-kit generate` を実行し、`evm-studio/server/src/db/migrations/0002_add_progress_snapshot_note.sql` を生成する
  - 生成された SQL を手動レビューし、`ALTER TABLE progress_snapshots ADD COLUMN note TEXT;` の 1 行のみであることを確認する。テーブル再作成方式になっていたら ALTER TABLE 形式に書き換える
  - `npx drizzle-kit migrate` を実行 → 既存 `evm.db` の `progress_snapshots` テーブルに `note` カラムが追加され、既存レコードの `note` が `NULL` になっていることを `sqlite3` CLI で確認できること
  - _Requirements: 1.2, 1.3_
  - _Depends: 1.1_
  - _Boundary: DBMigration_

- [x] 1.3 (P) SNAP_* エラーコードを 3 件追加する
  - `evm-studio/server/src/errors/codes.ts` の `ErrorCode` オブジェクトに `SNAP_TASK_NOT_FOUND: 'SNAP_TASK_NOT_FOUND'` / `SNAP_FUTURE_DATE: 'SNAP_FUTURE_DATE'` / `SNAP_NOTE_TOO_LONG: 'SNAP_NOTE_TOO_LONG'` を追加する
  - TypeScript の型推論で `ErrorCode` 型が 3 つの新コードを含むこと、既存コード（`EVM_*` / `PROJ_*` / `TASK_*` / `IMPORT_*` 等）が削除されていないことを確認する
  - _Requirements: 9.3_
  - _Boundary: ErrorCodes_

- [x] 2. Core: progress tRPC ルーター再実装
- [x] 2.1 recordProgressSchema と record プロシージャを実装する
  - `evm-studio/server/src/api/progress.ts` を再実装する。`recordProgressSchema` を Zod で定義する: `taskId: z.number().int().positive()`, `snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`, `progressPct: z.number().int().min(0).max(100)`, `acDays: z.number().min(0)`, `note: z.string().max(1000).nullable().optional()`
  - `progress.record` プロシージャを実装する:
    - サーバー側 `today = new Date().toISOString().slice(0, 10)` を取得し、`input.snapshotDate > today` の場合 `AppError(ErrorCode.SNAP_FUTURE_DATE, '未来日付は指定できません')` を throw する
    - `db.select().from(tasks).where(eq(tasks.id, input.taskId))` でタスク存在確認、未存在で `AppError(ErrorCode.SNAP_TASK_NOT_FOUND, ...)` を throw する
    - note の正規化: `note === '' || note === undefined ? null : note`
    - Drizzle `insert(progressSnapshots).values({...}).onConflictDoUpdate({ target: [progressSnapshots.taskId, progressSnapshots.snapshotDate], set: { progressPct, acDays, note, updatedAt: new Date() } }).returning()` で upsert
    - 戻り値: 保存後のレコード 1 件
  - `progress.record` をマウントする `progressRouter` を `createTRPCRouter` で生成する
  - 同一 `(taskId, snapshotDate)` で 2 回呼び出すと 2 回目で値が更新され、レコード数が増えないことを単体テストで確認できること（テストは 4.1 で実装）
  - _Requirements: 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 9.1, 9.2_
  - _Depends: 1.1, 1.2, 1.3_
  - _Boundary: ProgressRouter_

- [x] 2.2 (P) getLatest プロシージャを実装する
  - `progress.getLatest({ taskId: z.number().int().positive() })` を実装する
  - `db.select().from(progressSnapshots).where(eq(progressSnapshots.taskId, input.taskId)).orderBy(desc(progressSnapshots.snapshotDate)).limit(1)` でクエリし、結果配列が空なら `null`、1 件なら最初の要素を返す
  - 戻り値型は `ProgressSnapshot | null` として TypeScript で推論されること（クライアント側 `useProgressLatest` の型確認で検証）
  - 同一タスクに複数スナップショットが存在する場合、`snapshotDate` 最大の 1 件のみが返ることを単体テストで確認できること
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Depends: 2.1_
  - _Boundary: ProgressRouter_

- [x] 2.3 (P) getByDate プロシージャを実装する
  - `progress.getByDate({ projectId: z.number().int().positive(), snapshotDate: z.string().regex(...) })` を実装する
  - `db.select({...}).from(progressSnapshots).innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id)).where(and(eq(tasks.projectId, input.projectId), eq(progressSnapshots.snapshotDate, input.snapshotDate))).orderBy(asc(progressSnapshots.taskId))` でクエリ
  - select 句で `progressSnapshots` の全カラム（`note` を含む）を返すこと
  - 指定 `projectId` に該当タスクが存在しない場合に空配列を返すことを単体テストで確認できること
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Depends: 2.1_
  - _Boundary: ProgressRouter_

- [x] 2.4 (P) getHistory プロシージャを実装する
  - `progress.getHistory({ taskId: z.number().int().positive() })` を実装する
  - `db.select().from(progressSnapshots).where(eq(progressSnapshots.taskId, input.taskId)).orderBy(asc(progressSnapshots.snapshotDate))` でクエリ
  - 未存在 `taskId` に対して空配列を返すこと（エラーは投げない）を単体テストで確認できること
  - _Requirements: 5.1, 5.2, 5.3_
  - _Depends: 2.1_
  - _Boundary: ProgressRouter_

- [x] 2.4b (P) getByDateRange プロシージャを実装する
  - `progress.getByDateRange({ projectId: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })` を実装する
  - クエリ: `db.select({ taskId: progressSnapshots.taskId, snapshotDate: progressSnapshots.snapshotDate, progressPct: progressSnapshots.progressPct, acDays: progressSnapshots.acDays }).from(progressSnapshots).innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id)).where(and(eq(tasks.projectId, input.projectId), gte(progressSnapshots.snapshotDate, input.startDate), lte(progressSnapshots.snapshotDate, input.endDate))).orderBy(asc(progressSnapshots.snapshotDate), asc(progressSnapshots.taskId))`
  - select 句では `note`・`id`・`createdAt`・`updatedAt` を返さず、`{ taskId, snapshotDate, progressPct, acDays }` の 4 フィールドに絞る（ペイロード軽量化）
  - 戻り値型は `Array<{ taskId: number, snapshotDate: string, progressPct: number, acDays: number }>` として TypeScript で推論されること
  - 単体テストで以下を確認: (1) 期間内のスナップショットのみが返ること、(2) `snapshotDate` ASC → `taskId` ASC でソートされること、(3) `startDate > endDate` で空配列、(4) 未存在 `projectId` で空配列、(5) 戻り値に `note` などの内部フィールドが含まれないこと
  - 用途: `evm-engine` の prevDay（前日比）・spiTrend（SPI 推移）・fever trail（フィーバー軌跡）計算のための単一リクエスト一括取得
  - _Requirements: 4.5.1, 4.5.2, 4.5.3, 4.5.4, 4.5.5, 4.5.6_
  - _Depends: 2.1_
  - _Boundary: ProgressRouter_

- [x] 2.5 ログ出力を pino で記録する
  - `progress.record` の成功時に `logger.info({ taskId, projectId, snapshotDate, progressPct }, 'progress recorded')` を出力する
  - `progress.record` の失敗時に `logger.warn` でエラーコードと taskId を記録する
  - 個人名（`Member.name`）はログに含めないこと
  - 実装後にローカルで `progress.record` を呼び出して、pino のログに `taskId` のみが出力されることを確認できること
  - _Requirements: 9.4_
  - _Depends: 2.1_
  - _Boundary: ProgressRouter_

- [x] 2.6 progress ルーターを appRouter に再マウントする
  - `evm-studio/server/src/router.ts` の `appRouter` で `progress: progressRouter` がマウントされていることを確認する（既存マウントを利用、ファイル所有権は core-data-model）
  - tRPC クライアントから `trpc.progress.record` / `getLatest` / `getByDate` / `getByDateRange` / `getHistory` が TypeScript 型補完で見えること
  - _Requirements: 7.*_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 2.4b_
  - _Boundary: HonoServer, ProgressRouter_

- [x] 3. Core: クライアント純関数とフック実装
- [x] 3.1 (P) calculatePlannedPct 純関数を実装する
  - `evm-studio/client/src/services/planned-comparison.ts` を新規作成する
  - 関数シグネチャ: `export function calculatePlannedPct(input: { projectStartISO: string; snapshotDate: string; taskPlannedStart: string; taskPlannedEnd: string }): number`
  - ISO-8601 日付文字列を `Date` に変換 → ミリ秒差分を 86400000 で割って日数オフセット算出 → `Math.round((snapshotOffset - taskStartOffset) / Math.max(1, taskDuration) * 100)` を `Math.min(100, Math.max(0, ...))` でクランプ
  - 特殊ケース: `snapshotDate < taskPlannedStart` → 0、`snapshotDate >= taskPlannedEnd` → 100、`taskDuration === 0` → 1 として扱う
  - 純関数として副作用を持たないこと、4 ケース（開始前 / 中間 / 終了後 / duration=0）のユニットテスト（タスク 4.2）でグリーンであること
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: PlannedComparison_

- [x] 3.2 (P) mdToHours / hoursToMd 純関数を実装する
  - `evm-studio/client/src/services/ac-unit.ts` を新規作成する
  - `export function mdToHours(md: number): number { return md * 8 }`
  - `export function hoursToMd(h: number): number { return h / 8 }`
  - 純関数として副作用を持たないこと、往復変換 `hoursToMd(mdToHours(x)) === x` がパスすること（タスク 4.3）
  - _Requirements: 8.4, 8.5, 8.6_
  - _Boundary: AcUnit_

- [x] 3.3 useProgress フックを更新する
  - `evm-studio/client/src/hooks/useProgress.ts` を更新する
  - `useProgressLatest(taskId: number | null)`: `trpc.progress.getLatest.useQuery({ taskId: taskId! }, { enabled: !!taskId })` を返す
  - `useProgressByDate(projectId: number | null, snapshotDate: string | null)`: `trpc.progress.getByDate.useQuery({ projectId: projectId!, snapshotDate: snapshotDate! }, { enabled: !!projectId && !!snapshotDate })` を返す
  - `useProgressHistory(taskId: number | null)`: `trpc.progress.getHistory.useQuery({ taskId: taskId! }, { enabled: !!taskId })` を返す
  - `useRecordProgress()`: `trpc.progress.record.useMutation` を返し、`onSuccess` で `utils.progress.getLatest.invalidate()` / `utils.progress.getByDate.invalidate()` / `utils.progress.getHistory.invalidate()` を実行する
  - 各フックが型推論されたデータを返すこと（`useProgressLatest` の `data` 型が `ProgressSnapshot | null | undefined`、`useProgressByDate` の `data` 型が `ProgressSnapshot[] | undefined` で TypeScript エラーなし）
  - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - _Depends: 2.6_
  - _Boundary: useProgress_

- [x] 4. Validation: 単体テスト実装
- [x] 4.1 progress ルーターの Vitest 単体テストを実装する
  - `evm-studio/server/tests/api/progress.test.ts`（または既存ファイル）を新仕様に書き換える
  - 以下のテストケースを実装する:
    - record 正常系: 新規スナップショットが返却され、入力値を保持していること（要件 2.1, 2.9）
    - record upsert: 同一 (taskId, snapshotDate) で 2 回呼ぶと値が更新され、レコード数が増えないこと（要件 2.1, 2.10）
    - record 過去日付許容: `snapshotDate = today - 7日` で正常保存（要件 2.5）
    - record 未来日付 reject: `snapshotDate = today + 1日` で `BAD_REQUEST` + `SNAP_FUTURE_DATE`（要件 2.6）
    - record タスク未存在: 不存在 taskId で `NOT_FOUND` + `SNAP_TASK_NOT_FOUND`（要件 2.8）
    - record note 1001 文字: Zod または `SNAP_NOTE_TOO_LONG` で `BAD_REQUEST`（要件 1.4, 2.7）
    - record note 正規化: `note: ''` / `note: null` で DB に NULL が保存される（要件 1.5, 1.6）
    - record progressPct 範囲外: `progressPct = 101` で Zod の `BAD_REQUEST`（要件 2.2）
    - record acDays 負値: `acDays = -1` で Zod の `BAD_REQUEST`（要件 2.3）
    - getLatest 1 件返却: 同一タスクに 3 日分保存 → 最大 snapshotDate の 1 件が返る（要件 3.1, 3.4）
    - getLatest null: 未記録タスク・未存在 taskId に対して null（要件 3.2, 3.3）
    - getByDate フィルタ + ソート: 指定日付のみ、taskId 昇順（要件 4.1, 4.2, 4.4）
    - getByDate 未存在 projectId: 空配列（要件 4.3）
    - getByDate note 含む: 戻り値の各要素に note フィールドが含まれる（要件 4.5）
    - getByDateRange 期間フィルタ: 複数日付のスナップショットを投入 → `[startDate, endDate]` 内のもののみが返ること（要件 4.5.1）
    - getByDateRange ソート: snapshotDate ASC → taskId ASC でソートされること（要件 4.5.4）
    - getByDateRange 軽量ペイロード: 戻り値の各要素が `{ taskId, snapshotDate, progressPct, acDays }` の 4 フィールドのみで、`note`・`id`・`createdAt`・`updatedAt` を含まないこと（要件 4.5.3）
    - getByDateRange 逆転日付: `startDate > endDate` で空配列が返ること（要件 4.5.6）
    - getByDateRange 未存在 projectId: 空配列（要件 4.5.5）
    - getHistory 昇順: snapshotDate 昇順で全件返る（要件 5.1, 5.3）
    - getHistory 空配列: 未存在 taskId で空配列（要件 5.2）
  - `npm test` で `progress.test.ts` が全件 PASS すること
  - _Requirements: 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.5.1, 4.5.3, 4.5.4, 4.5.5, 4.5.6, 5.1, 5.2, 5.3_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 2.4b_
  - _Boundary: ProgressRouter_

- [x] 4.2 (P) planned-comparison 純関数の単体テストを実装する
  - `evm-studio/client/src/services/planned-comparison.test.ts` を新規作成する
  - 以下のテストケースを実装する:
    - タスク開始前: `snapshotDate = taskPlannedStart - 5日` → `0`（要件 8.2）
    - タスク中間: `taskPlannedStart='2026-04-01'`, `taskPlannedEnd='2026-04-11'`, `snapshotDate='2026-04-06'` → 約 `50`（要件 8.1）
    - タスク終了後: `snapshotDate = taskPlannedEnd + 5日` → `100`（要件 8.3）
    - duration = 0: `taskPlannedStart === taskPlannedEnd` で例外なく動作（ゼロ除算回避、要件 8.1）
    - クランプ動作: 結果が常に 0〜100 の範囲内（要件 8.1）
  - `npm test` で `planned-comparison.test.ts` が全件 PASS すること
  - _Requirements: 8.1, 8.2, 8.3, 10.6_
  - _Depends: 3.1_
  - _Boundary: PlannedComparison_

- [x] 4.3 (P) ac-unit 純関数の単体テストを実装する
  - `evm-studio/client/src/services/ac-unit.test.ts` を新規作成する
  - 以下のテストケースを実装する:
    - `mdToHours(1) === 8`、`mdToHours(2.5) === 20`、`mdToHours(0) === 0`（要件 8.4）
    - `hoursToMd(8) === 1`、`hoursToMd(20) === 2.5`、`hoursToMd(0) === 0`（要件 8.5）
    - 往復: `hoursToMd(mdToHours(2.5))` が `2.5` と近似一致（浮動小数精度を考慮して `toBeCloseTo`）（要件 10.7）
  - `npm test` で `ac-unit.test.ts` が全件 PASS すること
  - _Requirements: 8.4, 8.5, 10.7_
  - _Depends: 3.2_
  - _Boundary: AcUnit_

- [x] 5. Core: ProgressInputPanel コンポーネント実装
- [x] 5.1 ProgressInputPanel の型定義を作成する
  - `evm-studio/client/src/components/gantt/progress-input-panel-types.ts` を新規作成する
  - `ProgressInputTask` interface を定義する: `id: number; code: string; name: string; assigneeName: string | null; plannedStart: string; plannedEnd: string; bac: number; spi: number | null; ancestors: Array<{ id: number; name: string }>`
  - `ProgressInputPanelProps` interface を定義する: `task: ProgressInputTask; projectStartISO: string; baseDate: string; snapshotDate: string; onSnapshotDateChange: (date: string) => void; onClose: () => void; onSaved?: (snapshot: ProgressSnapshot) => void`
  - `ProgressSnapshot` 型は tRPC 推論型から import すること（`type RouterOutput = inferRouterOutputs<AppRouter>; type ProgressSnapshot = RouterOutput['progress']['getLatest']` を非 null 化したもの）
  - 型ファイルが `tsc --noEmit` を通ること
  - _Requirements: 6.1, 6.2_
  - _Boundary: ProgressInputPanelTypes_

- [x] 5.2 ProgressInputPanel コンポーネントの骨格と初期化を実装する
  - `evm-studio/client/src/components/gantt/ProgressInputPanel.tsx` を新規作成する
  - props として `ProgressInputPanelProps` を受け入れる関数コンポーネントを定義する
  - 内部 `useState`: `progress: number`、`acDaysToday: number`、`note: string`、`acUnit: 'MD' | 'h'`、`saveError: string | null`
  - `useProgressLatest(task.id)` の戻り値 `latest` から初期値を派生する: `prevAcDays = latest?.acDays ?? 0`、`prevProgress = latest?.progressPct ?? 0`、`prevNote = latest?.note ?? ''`
  - `useEffect`: `task.id` または `snapshotDate` が変更されたとき、`latest` から内部ステートを再初期化する（`setProgress(prevProgress)` / `setAcDaysToday(0)` / `setNote(prevNote)`）
  - 派生値: `isPast = snapshotDate < baseDate`、`plannedPct = calculatePlannedPct({ projectStartISO, snapshotDate, taskPlannedStart: task.plannedStart, taskPlannedEnd: task.plannedEnd })`、`diffPct = progress - plannedPct`
  - コンポーネントが `task` props を受け取って React DevTools で props を確認でき、`useProgressLatest` の fetching 中はパネルが空状態（または skeleton）で表示できること
  - _Requirements: 6.3, 6.4, 6.5_
  - _Depends: 3.1, 3.3, 5.1_
  - _Boundary: ProgressInputPanel_

- [x] 5.3 ProgressInputPanel のヘッダー部（スナップショット日付 + 過去日警告 + メタ情報）を実装する
  - パネル上部に `<input type="date" value={snapshotDate} max={baseDate} onChange={e => onSnapshotDateChange(e.target.value)} />` を表示する
  - `isPast === true` のとき、日付エリアの背景色を `EVM.warnSoft`、ボーダーを `EVM.warn` にし、`baseDate` との日数差分（例: `3日前`）を表示する
  - `isPast === false` のとき、背景色を `EVM.brandSoft`、ボーダーを `EVM.brand` にし、`今日` ラベルを表示する
  - 祖先パンくず（`task.ancestors`）、タスクコード（`task.code`）、タスク名（`task.name`）、担当者（`task.assigneeName`）、`task.plannedStart → task.plannedEnd` のレンジ、SPI 状態 Pill（`task.spi` から `spiTone` で判定して `On Track` / `Watch` / `Delayed` / `N/A`）を表示する
  - 過去日付を選択するとパネルヘッダーが黄色になり、`今日` テキストが `Nの日前` に切り替わることをブラウザで確認できる
  - _Requirements: 6.5, 6.6, 6.17_
  - _Depends: 5.2_
  - _Boundary: ProgressInputPanel_

- [x] 5.4 進捗率入力（スライダー + 数値 + 進捗バー + 計画線マーカー + 差分色分け）を実装する
  - レンジスライダー `<input type="range" min={0} max={100} step={5} value={progress} onChange={e => setProgress(+e.target.value)} />` と数値入力 `<input type="number" min={0} max={100} step={1} value={progress} onChange={e => setProgress(Math.max(0, Math.min(100, +e.target.value || 0)))} />` を表示し、両者を `progress` ステートで連動させる
  - 進捗バー（高さ 10px の divider）の塗りを `width: ${progress}%` で表示し、塗り色を `diffPct >= 0 ? EVM.brandDeep : diffPct >= -10 ? EVM.warn : EVM.crit` で切り替える
  - 計画線マーカーを `left: calc(${plannedPct}% - 1px); width: 2px` の縦線で重ね、上に「計画 N%」のラベルを表示する（`plannedPct > 0 && plannedPct <= 100` のときのみ表示）
  - 差分表示: `diffPct === 0` → `計画通り`、`diffPct > 0` → `+N% 先行`、`diffPct < 0` → `N% 遅延`。色は緑 / 黄 / 赤を `diffColor` 関数で切り替える
  - スライダーと数値入力を変更すると進捗バーと計画線マーカー、差分テキストが即座に更新されることをブラウザで確認できる
  - _Requirements: 6.7, 6.8, 6.9_
  - _Depends: 5.3_
  - _Boundary: ProgressInputPanel_

- [x] 5.5 AC 入力（MD/h トグル + 前回累積 + 本日追加 + 累積合計 + プレビュー）を実装する
  - MD / h トグルボタン 2 つを表示し、クリックで `setAcUnit('MD' | 'h')` を切り替える。切替時は `setAcDaysToday(0)` で本日入力をリセットする
  - 本日追加分の数値入力 `<input type="number" min={0} step={0.5} value={acDaysToday * factor} onChange={e => setAcDaysToday(Math.max(0, (+e.target.value || 0) / factor))} />` を表示する。`factor = acUnit === 'h' ? 8 : 1`
  - 前回累積 (`prevAcDays * factor`)、本日 (`acDaysToday * factor`)、累積合計 (`(prevAcDays + acDaysToday) * factor`) の 3 値を `.toFixed(1)` で整形して表示する
  - リアルタイム EV / AC / CPI プレビューを表示: `EV = task.bac * progress / 100`、`AC = (prevAcDays + acDaysToday) * ratePerMd`（`ratePerMd` はプレースホルダ定数 600_000 を使用）、`CPI = EV / AC || 0`。それぞれを `formatMoney` 等のユーティリティで整形（既存ユーティリティを使うか、ローカル関数で `(value / 1_000_000).toFixed(2) + 'M'` 形式に整形）
  - MD/h トグルをクリックすると数値表示が `× 8` 倍 / `÷ 8` に切り替わり、本日追加入力が 0 にリセットされることをブラウザで確認できる
  - _Requirements: 6.10, 6.11, 6.13_
  - _Depends: 3.2, 5.4_
  - _Boundary: ProgressInputPanel_

- [x] 5.6 メモ入力欄を実装する
  - `<textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="進捗の状況・課題・次のアクションなど" />` を表示する
  - `maxLength={1000}` で 1001 文字目以降の入力をブラウザが拒否すること
  - スタイル: モックアップ準拠（`Card` 内、`Eyebrow` で「メモ · 任意」ラベル、`minHeight: 72px`、`resize: vertical`）
  - メモ欄に 1000 文字超を貼り付けようとしてもブラウザ側で先頭 1000 文字までしか入力されないことを確認できる
  - _Requirements: 6.12_
  - _Depends: 5.5_
  - _Boundary: ProgressInputPanel_

- [x] 5.7 保存ボタン・キャンセル・dirty 制御・エラー表示を実装する
  - `dirty = progress !== prevProgress || acDaysToday > 0 || note !== prevNote` を派生
  - 保存ボタン `<button disabled={!dirty || recordMutation.isPending} onClick={handleSave}>保存</button>` を表示する
  - `handleSave`:
    1. `recordMutation.mutateAsync({ taskId: task.id, snapshotDate, progressPct: progress, acDays: prevAcDays + acDaysToday, note: note.trim() === '' ? null : note })` を await
    2. 成功時に `onSaved?.(saved)` → `onClose()` を実行
    3. 失敗時に `setSaveError(getErrorMessage(e))` で `saveError` を設定する。`getErrorMessage` は `error.message ?? '保存に失敗しました'` を返すヘルパー
  - キャンセルボタン `<button onClick={onClose}>キャンセル</button>` を表示する
  - `saveError !== null` のとき、保存ボタンの上にエラーメッセージを赤背景で表示する（バナー or インラインアラート）
  - dirty 状態でないと保存ボタンがクリックできないこと、保存中はボタンが disabled になり、成功するとパネルが閉じることをブラウザで確認できる
  - _Requirements: 6.14, 6.15, 6.16_
  - _Depends: 3.3, 5.6_
  - _Boundary: ProgressInputPanel_

- [x] 6. 統合確認
- [x] 6.1 progress-tracking スペックの全体動作を検証する
  - `npm test`（サーバー単体テスト）を実行し、`progress.test.ts` / `planned-comparison.test.ts` / `ac-unit.test.ts` の全テストが PASS することを確認する
  - `npm start` でサーバー + クライアントを起動し、`evm-studio/server/seeds/seed.ts` 等で投入したテストプロジェクトに対し、ブラウザの DevTools で `trpc.progress.record.useMutation` を直接呼び出して正常応答を確認する（または既存ページから一時的に `ProgressInputPanel` をマウントする検証コードで動作確認）
  - 注: 本スペックでは `GanttFullscreen` への正式マウントは行わないため、本タスクの動作確認は手動で限定的に行う。完全な E2E は `dashboard` スペックの GanttFullscreen フローテストで担保する
  - 検証結果として、未来日付指定で `SNAP_FUTURE_DATE` エラーがクライアントに返ること、過去日付（baseDate 未満）で正常保存できること、note の空文字が DB で NULL になっていることを `sqlite3 evm.db 'SELECT note FROM progress_snapshots LIMIT 5'` で確認できること
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  - _Depends: 2.5, 2.6, 4.1, 4.2, 4.3, 5.7_
  - _Boundary: ProgressRouter, ProgressInputPanel_
