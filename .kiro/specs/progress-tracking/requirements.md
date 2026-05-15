# 要件定義書: progress-tracking

## Introduction

EVM Studio のプロジェクト管理者・担当者が、特定タスクの実績工数（`ac_days`、MD 単位）・完了率（`progress_pct`、0〜100）・任意メモ・スナップショット日付（過去日付可、未来日付不可）を 1 タスク単位で記録できる API とデータ層を提供する。

本スペックはモックアップ `mockup/variation-a.jsx` の `ProgressInputPanel`（GanttFullscreen 内サブパネル）を支える API/データ層と、UI コンポーネントの **形状（props 契約）** を所有する。実際にこのコンポーネントをホストして画面に表示する責務は `dashboard` スペックが担うため、本スペックでは「ページ」を設計せず、API + データ + コンポーネント形状に閉じる。旧 `ProgressInputPage` は `dashboard` スペックの責務として削除される。

`progress.record` は冪等な upsert（同一 `(taskId, snapshotDate)` への上書き）として動作し、`progress.getLatest(taskId)` は前回累積 AC をパネルの「前回累積」表示に供給する。`progress_snapshots` テーブルに新規 `note` カラム（nullable text、≤ 1000 文字）を追加するマイグレーションも本スペックの責務とする。

## Boundary Context

- **In scope**:
  - `progress_snapshots` テーブルへの `note` カラム追加マイグレーション（nullable text、文字数上限はアプリ層で 1000 文字）
  - `progress.record` プロシージャの拡張（`note` 入力受け入れ、未来日付の reject、過去日付の許容、upsert 冪等性）
  - `progress.getLatest(taskId)` プロシージャの再設計（単一タスクに対する最新スナップショット 1 件返却、`ProgressInputPanel` の「前回累積 AC」表示用）
  - `progress.getByDate({ projectId, snapshotDate })` プロシージャ（特定日付のスナップショット一括取得）
  - `progress.getByDateRange({ projectId, startDate, endDate })` プロシージャ（指定期間内のスナップショット一括取得。`evm-engine` の prevDay / spiTrend / fever trail 計算用）
  - `progress.getHistory({ taskId })` プロシージャ（単一タスクの履歴取得）
  - `ProgressInputPanel` コンポーネントの props 契約・public 振る舞い（`client/src/components/gantt/ProgressInputPanel.tsx` に新設）
  - 計画線比較（plannedPct）算出ロジック（クライアント側純関数）
  - MD ↔ h 単位変換ロジック（クライアント側純関数）
  - クライアントフック `useProgress` の拡張（`useRecordProgress` / `useProgressByDate` / `useProgressLatest`）
  - エラーコード追加: `SNAP_TASK_NOT_FOUND`、`SNAP_FUTURE_DATE`、`SNAP_NOTE_TOO_LONG`
- **Out of scope**:
  - `ProgressInputPanel` を画面にマウントする `GanttFullscreen` 側のレイアウト・モーダル制御（`dashboard` スペック）
  - 旧 `ProgressInputPage` の削除実行（`dashboard` スペックが旧ファイルを除去）
  - EVM メトリクス（PV / EV / SPI / CPI / EAC）の計算（`evm-engine` スペック）
  - 進捗履歴のグラフ表示・SPI トレンド（`dashboard` スペック）
  - WBS YAML インポート時の初回スナップショット作成（`core-data-model` スペック）
  - 進捗の一括 CSV / xlsm インポート（将来対応）
  - 認証・認可（ローカル限定のため対象外）
- **Adjacent expectations**:
  - `core-data-model` が `progress_snapshots` / `tasks` / `projects` テーブル・`AppError` / `ErrorCode` 基盤・tRPC `appRouter` のセットアップを提供済みであること
  - `evm-engine` が `progress.getLatest({ projectId })` 形式の「プロジェクト全タスク最新一覧」も別途必要とする可能性があるため、`getLatest` には `taskId` 単体版とプロジェクト一括版の 2 つのオーバーロードを用意する
  - `dashboard` スペックは本スペックの `ProgressInputPanel` を `GanttFullscreen` 内にスライドインさせて表示し、選択中タスクの `Task` オブジェクト・閉じる callback・保存成功後の callback を props として渡す
  - `client/src/components/gantt/` ディレクトリは `dashboard` スペックと共有するが、`ProgressInputPanel.tsx` は本スペックが所有する

---

## Requirements

### Requirement 1: progress_snapshots テーブルへの note カラム追加

**Objective:** 担当者として、進捗を記録する際に状況・課題・次のアクションを自由文で残したい。そうすることで、PM がスナップショットを後で見返したときに数値だけでは伝わらない文脈を把握できる。

#### Acceptance Criteria

1. The EVM Studio Schema shall `progress_snapshots` テーブルに `note` カラム（テキスト、NULL 許容）を保持する。
2. When 既存マイグレーション適用済みの DB に本スペックのマイグレーションを適用する、 the Migration shall `ALTER TABLE progress_snapshots ADD COLUMN note TEXT` を実行し、既存レコードの `note` を NULL のままにする。
3. If マイグレーション SQL 実行中にエラーが発生する、 the Migration Runner shall トランザクションをロールバックし変更前の状態を維持する。
4. The Progress Tracking Service shall `note` を 1000 文字以下の文字列として受け入れ、1001 文字以上が指定された場合は `SNAP_NOTE_TOO_LONG` エラーコードでバリデーションエラーを返す。
5. The Progress Tracking Service shall `note` が `null` または省略された場合、`progress_snapshots.note` カラムに `NULL` を保存する。
6. The Progress Tracking Service shall `note` が空文字列 `""` で渡された場合、`progress_snapshots.note` カラムに `NULL` を保存する（空文字列を NULL に正規化）。

### Requirement 2: 進捗スナップショット記録 API（progress.record）

**Objective:** プロジェクト管理者・担当者として、特定タスクの実績工数・完了率・スナップショット日付・メモを 1 タスク単位で記録したい。そうすることで、EVM 計算と前日比に必要な日次データを蓄積できる。

#### Acceptance Criteria

1. When `progress.record` is called with `taskId`・`snapshotDate`・`progressPct`・`acDays`・`note`、 the Progress Tracking Service shall 同一 `(taskId, snapshotDate)` のレコードが存在すれば上書き、存在しなければ新規作成する（upsert）。
2. The Progress Tracking Service shall `progressPct` を 0 以上 100 以下の整数として受け入れ、範囲外または非整数が指定された場合は Zod バリデーションエラーを返す。
3. The Progress Tracking Service shall `acDays` を 0 以上の数値（小数を含む）として受け入れ、負の値が指定された場合は Zod バリデーションエラーを返す。
4. The Progress Tracking Service shall `snapshotDate` を `YYYY-MM-DD` 形式の文字列として受け入れ、形式不正の場合は Zod バリデーションエラーを返す。
5. When `snapshotDate` が現在の `BASE_DATE`（プロジェクトの基準日 = 今日扱い）以下の日付を指す、 the Progress Tracking Service shall その日付を受け入れて保存する（過去日付の許容）。
6. If `snapshotDate` が現在の `BASE_DATE` より後の日付を指す、 the Progress Tracking Service shall `SNAP_FUTURE_DATE` エラーコードでバリデーションエラーを返し、DB への書き込みを行わない。`snapshotDate` は `baseDate` 以下でなければならない（`snapshotDate > baseDate` は `AppError(SNAP_FUTURE_DATE)` を throw）。クライアントは date input に `max={baseDate}` を設定して防御的に弾く。
7. The Progress Tracking Service shall `note` を Requirement 1.4–1.6 の制約に従って受け入れる。
8. If 指定された `taskId` が DB に存在しない、 the Progress Tracking Service shall `SNAP_TASK_NOT_FOUND` エラーコードで NOT_FOUND エラーを返す。
9. When `progress.record` が正常に完了する、 the Progress Tracking Service shall 保存された `ProgressSnapshot` レコード（`id`・`taskId`・`snapshotDate`・`progressPct`・`acDays`・`note`・`createdAt`・`updatedAt`）を返す。
10. The Progress Tracking Service shall `progress.record` の処理対象外である他の `(taskId, snapshotDate)` のスナップショットを変更・削除しない（スナップショット蓄積の保証）。

### Requirement 3: 単一タスクの最新スナップショット取得 API（progress.getLatest）

**Objective:** 進捗入力パネルとして、対象タスクの最新スナップショット 1 件を取得したい。そうすることで「前回累積 AC」「現在の進捗率」「直近のメモ」をパネルに初期表示できる。

#### Acceptance Criteria

1. When `progress.getLatest` is called with a single `taskId`、 the Progress Tracking Service shall 指定タスクのスナップショットのうち `snapshotDate` 最大の 1 件を返す。
2. If 指定 `taskId` のスナップショットが 1 件も存在しない、 the Progress Tracking Service shall `null` を返す（エラーは投げない）。
3. If 指定 `taskId` が DB に存在しない、 the Progress Tracking Service shall `null` を返す（エラーは投げない）。
4. When `progress.getLatest` が結果を返す、 the Progress Tracking Service shall `id`・`taskId`・`snapshotDate`・`progressPct`・`acDays`・`note`・`createdAt`・`updatedAt` を含める。

### Requirement 4: 指定日付のスナップショット一括取得 API（progress.getByDate）

**Objective:** プロジェクト管理者として、特定プロジェクトの特定日付に記録された全タスクのスナップショットを取得したい。そうすることで、その日の進捗状況を一覧できる（EVM エンジン・ダッシュボードからの参照に使う）。

#### Acceptance Criteria

1. When `progress.getByDate` is called with `projectId` and `snapshotDate`、 the Progress Tracking Service shall 指定プロジェクト内の全タスクのうち、指定日付に記録されたスナップショットの一覧を返す。
2. The Progress Tracking Service shall 指定日付にスナップショットが存在しないタスクを結果に含めない。
3. If 指定 `projectId` が DB に存在しない、 the Progress Tracking Service shall 空配列を返す（プロジェクト存在確認は不要）。
4. When `progress.getByDate` が結果を返す、 the Progress Tracking Service shall 結果を `taskId` 昇順でソートする。
5. When `progress.getByDate` が各スナップショットを返す、 the Progress Tracking Service shall `id`・`taskId`・`snapshotDate`・`progressPct`・`acDays`・`note`・`createdAt`・`updatedAt` を含める。

### Requirement 4.5: 指定期間のスナップショット一括取得 API（progress.getByDateRange）

**Objective:** `evm-engine` スペックとして、特定プロジェクトの指定期間 `[startDate, endDate]` 内に記録された全タスクのスナップショットを軽量ペイロードで取得したい。そうすることで、prevDay（前日比）・spiTrend（SPI 推移）・fever trail（フィーバーチャート軌跡）の各メトリクスを 1 リクエストで計算できる。

#### Acceptance Criteria

1. When `progress.getByDateRange` is called with `projectId`・`startDate`・`endDate`、 the Progress Tracking Service shall 指定プロジェクト配下の全タスクのうち、`snapshotDate` が `[startDate, endDate]`（両端含む）に含まれるスナップショットを返す。
2. The Progress Tracking Service shall `startDate` / `endDate` を `YYYY-MM-DD` 形式の文字列として受け入れ、形式不正の場合は Zod バリデーションエラーを返す。
3. The Progress Tracking Service shall ペイロード軽量化のため、各スナップショット要素を `{ taskId: number, snapshotDate: string, progressPct: number, acDays: number }` のみに絞って返し、`note` および `id`・`createdAt`・`updatedAt` 等の内部フィールドは含めない。
4. When `progress.getByDateRange` が結果を返す、 the Progress Tracking Service shall 結果を `snapshotDate` 昇順、同日内では `taskId` 昇順でソートする。
5. If 指定 `projectId` が DB に存在しない、 the Progress Tracking Service shall 空配列を返す（プロジェクト存在確認は不要）。
6. If `startDate > endDate` の場合、 the Progress Tracking Service shall 空配列を返す（エラーは投げない）。

### Requirement 5: 単一タスクのスナップショット履歴取得 API（progress.getHistory）

**Objective:** プロジェクト管理者として、特定タスクの進捗履歴を時系列で確認したい。そうすることで、タスクの進捗推移と過去メモを把握できる。

#### Acceptance Criteria

1. When `progress.getHistory` is called with a `taskId`、 the Progress Tracking Service shall 指定タスクのすべてのスナップショットを `snapshotDate` 昇順で返す。
2. If 指定 `taskId` が DB に存在しない、 the Progress Tracking Service shall 空配列を返す（エラーは投げない）。
3. When `progress.getHistory` が各スナップショットを返す、 the Progress Tracking Service shall `id`・`taskId`・`snapshotDate`・`progressPct`・`acDays`・`note`・`createdAt`・`updatedAt` を含める。

### Requirement 6: ProgressInputPanel コンポーネント形状（props 契約）

**Objective:** dashboard スペックの実装者として、`GanttFullscreen` 内にスライドインさせる `ProgressInputPanel` を再利用可能なコンポーネントとしてマウントしたい。そうすることで、選択中タスクの進捗をモックアップ `mockup/variation-a.jsx` と同等の UX で入力できる。

#### Acceptance Criteria

1. The Progress Input Panel Component shall props として `task: ProgressInputTask`（タスク情報）・`projectStartISO: string`（プロジェクト開始日）・`baseDate: string`（プロジェクト基準日 / 「今日」扱い）・`snapshotDate: string`（現在選択中のスナップショット日）・`onSnapshotDateChange: (date: string) => void`・`onClose: () => void`・`onSaved?: (snapshot: ProgressSnapshot) => void` を受け入れる。
2. The Progress Input Panel Component shall props の `ProgressInputTask` 型として `id: number`・`code: string`・`name: string`・`assigneeName: string | null`・`plannedStart: string`・`plannedEnd: string`・`bac: number`（estimateDays）・`spi: number | null`・`ancestors: Array<{ id: number; name: string }>` を定義する。
3. When `task` props が変更される、 the Progress Input Panel Component shall 内部編集ステート（進捗率・AC 追加・メモ・AC 単位）を新しいタスクの最新スナップショット値で再初期化する。
4. The Progress Input Panel Component shall マウント時および `task` / `snapshotDate` が変更されたタイミングで `progress.getLatest({ taskId })` を呼び出し、戻り値の `progressPct` を進捗率の初期値、`acDays` を「前回累積 AC」の表示値、`note` の有無を「過去メモ」の表示に用いる。
5. The Progress Input Panel Component shall スナップショット日付ピッカー（`<input type="date">`）を表示し、`max` 属性に `baseDate` を設定して未来日付の選択を UI レベルで防ぐ。
6. When `snapshotDate` が `baseDate` 未満を指す、 the Progress Input Panel Component shall 警告色（黄色: `EVM.warnSoft` 背景・`EVM.warn` ボーダー）でスナップショット日付エリアを表示し、`baseDate` との差分日数（例: `3日前`）を表示する。
7. The Progress Input Panel Component shall 進捗率入力をレンジスライダー（step 5、0〜100）と数値入力（step 1、0〜100）の両方で表示し、相互に連動させる。
8. The Progress Input Panel Component shall 進捗バーに現在の進捗率塗りと、計画線マーカー（`plannedPct`）を縦線として重ねて表示する。`plannedPct` は `Math.min(100, Math.max(0, Math.round((snapshotOffset - taskStartOffset) / taskDuration * 100)))` で算出する。`snapshotOffset` は `projectStartISO` から `snapshotDate` までの日数、`taskStartOffset` は `projectStartISO` から `task.plannedStart` までの日数、`taskDuration` は `task.plannedEnd - task.plannedStart` 日数。
9. The Progress Input Panel Component shall 進捗率と計画線の差分（`diffPct = progress - plannedPct`）を表示し、`diffPct ≥ 0` の場合「+N% 先行」（緑）、`-10 ≤ diffPct < 0` の場合「N% 遅延」（黄）、`diffPct < -10` の場合「N% 遅延」（赤）の 3 段階の色分けを行う。
10. The Progress Input Panel Component shall AC 入力に MD / h 単位トグルを設け、内部状態は常に MD で保持し、表示時のみ `× 8`（MD → h）の換算を行う。単位切替時は本日入力中の値を 0 にリセットする。
11. The Progress Input Panel Component shall AC 入力エリアに「前回累積」（getLatest の `acDays`）・「本日追加分」（編集中の値）・「累積合計」（前回 + 本日）の 3 値を表示する。
12. The Progress Input Panel Component shall 任意メモ欄を `<textarea>` で表示し、入力中の文字数を 1000 文字以内に制限する（1001 文字目以降は入力を受け付けない、または視覚的な警告を出す）。
13. When ユーザーが編集中、 the Progress Input Panel Component shall 入力値に基づく EV・AC・CPI のリアルタイムプレビューを表示する（EV = `task.bac × progressPct / 100`、AC = `累積合計 × ratePerMd` を用いる。`ratePerMd` は本スペックでは固定値プレースホルダとして扱い、UI は `formatMoney` ユーティリティに委譲する）。
14. The Progress Input Panel Component shall 保存ボタンを「初期状態から変更がない場合」（dirty = false）は無効化し、「変更がある場合」（dirty = true）に有効化する。
15. When ユーザーが保存ボタンをクリックする、 the Progress Input Panel Component shall `progress.record` を呼び出し、成功時に `onSaved` callback を実行してパネルを閉じる（`onClose` を実行）。
16. If 保存中にエラーが発生する、 the Progress Input Panel Component shall パネル内にエラーメッセージを表示し、パネルを閉じない。
17. The Progress Input Panel Component shall タスク祖先パンくず（`ancestors`）・タスクコード・タスク名・担当者名・計画開始/終了日・SPI ステータス Pill（`On Track` / `Watch` / `Delayed` / `N/A`）を表示する。

### Requirement 7: クライアントフック useProgress 拡張

**Objective:** クライアント開発者として、`ProgressInputPanel` および将来の dashboard コンポーネントから tRPC エンドポイントを型安全に呼び出したい。

#### Acceptance Criteria

1. The useProgress Hook Module shall `useProgressLatest(taskId: number | null)` を提供し、`trpc.progress.getLatest.useQuery({ taskId })` を `enabled: !!taskId` で呼び出す。
2. The useProgress Hook Module shall `useProgressByDate(projectId: number | null, snapshotDate: string | null)` を提供し、`trpc.progress.getByDate.useQuery({ projectId, snapshotDate })` を `enabled: !!projectId && !!snapshotDate` で呼び出す。
3. The useProgress Hook Module shall `useRecordProgress()` を提供し、`trpc.progress.record.useMutation` を返す。成功後に `progress.getLatest` および `progress.getByDate` のクエリキャッシュを invalidate する。
4. The useProgress Hook Module shall `useProgressHistory(taskId: number | null)` を提供し、`trpc.progress.getHistory.useQuery({ taskId })` を `enabled: !!taskId` で呼び出す。

### Requirement 8: 計画線比較 / 単位変換ロジック

**Objective:** 開発者として、計画線比較（plannedPct）と MD ↔ h 単位変換を独立した純関数として持ちたい。そうすることで、`ProgressInputPanel` から切り離してテストできる。

#### Acceptance Criteria

1. The Planned Comparison Module shall `calculatePlannedPct({ projectStartISO, snapshotDate, taskPlannedStart, taskPlannedEnd }): number` を純関数として提供し、計算式 `Math.min(100, Math.max(0, Math.round((snapshotOffset - taskStartOffset) / Math.max(1, taskDuration) * 100)))` を実装する。`taskDuration` が 0 の場合は 1 として扱う（ゼロ除算回避）。
2. The Planned Comparison Module shall `snapshotDate` が `taskPlannedStart` より前の場合 0 を返す。
3. The Planned Comparison Module shall `snapshotDate` が `taskPlannedEnd` 以降の場合 100 を返す。
4. The Unit Conversion Module shall `mdToHours(md: number): number` で `md * 8` を返す純関数を提供する。
5. The Unit Conversion Module shall `hoursToMd(h: number): number` で `h / 8` を返す純関数を提供する。
6. The Unit Conversion Module shall 単位切替時の値リセットを `ProgressInputPanel` 側で行うため、これらの純関数は副作用を持たない。

### Requirement 9: エラーハンドリングと型安全

**Objective:** システムとして、不正な入力やシステムエラーを適切に処理し、クライアントに明確なエラー情報を返したい。そうすることで、ユーザーは入力ミスを素早く修正できる。

#### Acceptance Criteria

1. The Progress Tracking Service shall すべての tRPC プロシージャで Zod スキーマによる入力バリデーションを実施する。
2. The Progress Tracking Service shall ドメインエラーを `AppError(code: ErrorCode, message)` として throw し、tRPC 境界で `TRPCError` に変換する。`SNAP_TASK_NOT_FOUND` は `NOT_FOUND`、`SNAP_FUTURE_DATE` は `BAD_REQUEST`、`SNAP_NOTE_TOO_LONG` は `BAD_REQUEST` に変換する。
3. The Progress Tracking Service shall `server/src/errors/codes.ts` の `ErrorCode` 定数に `SNAP_TASK_NOT_FOUND` / `SNAP_FUTURE_DATE` / `SNAP_NOTE_TOO_LONG` の 3 コードを追加する（`SNAP_` プレフィックス）。
4. The Progress Tracking Service shall ビジネスロジック層のログに個人名を含めず、`taskId` と `projectId` のみを記録する。

### Requirement 10: テストカバレッジ

**Objective:** EVM Studio 開発者として、進捗記録 API と計画線比較・単位変換ロジックが想定通りであることを単体テストで保証したい。そうすることで、リグレッションを早期に検知できる。

#### Acceptance Criteria

1. The Test Suite shall `progress.record` の正常系（新規作成・upsert で既存レコード上書き）を検証する単体テストを含める。
2. The Test Suite shall `progress.record` の未来日付 reject（`SNAP_FUTURE_DATE`）・タスク未存在（`SNAP_TASK_NOT_FOUND`）・メモ長超過（`SNAP_NOTE_TOO_LONG`）・空文字 note の NULL 正規化を検証する単体テストを含める。
3. The Test Suite shall `progress.getLatest({ taskId })` がスナップショット未記録時に `null` を返すこと、複数スナップショットがある場合に `snapshotDate` 最大のものを返すことを検証する。
4. The Test Suite shall `progress.getByDate` が指定日付未記録タスクを除外し、`taskId` 昇順でソートして返すことを検証する。
5. The Test Suite shall `progress.getHistory` が `snapshotDate` 昇順で返し、未存在 `taskId` に対して空配列を返すことを検証する。
6. The Test Suite shall `calculatePlannedPct` を少なくとも 4 ケース（タスク開始前 = 0、タスク中間 = 50 前後、タスク終了後 = 100、duration = 0 のゼロ除算回避）検証する。
7. The Test Suite shall `mdToHours` / `hoursToMd` の往復変換が元の値を保つことを検証する（精度を考慮した近似比較）。
8. When `npm test` を実行する、 the Vitest Runner shall 上記すべてのテストがパスする。
