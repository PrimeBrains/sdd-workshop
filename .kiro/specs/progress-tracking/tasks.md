# Implementation Plan

## Tasks

- [ ] 1. 基盤: tRPC サーバーセットアップとエラーコード追加
- [ ] 1.1 tRPC サーバーと appRouter を構成する
  - `server/src/router.ts` を新規作成し、`createTRPCRouter` で `appRouter` を定義してエクスポートする
  - `server/src/index.ts` に `@hono/trpc-server` アダプターをインポートし、tRPC ハンドラーを `/trpc` パスにマウントする
  - `AppRouter` 型を `server/src/router.ts` からエクスポートし、クライアントが参照できるようにする
  - `curl http://localhost:3001/trpc/health` に相当するヘルスチェックが通ること、または tRPC ルーターが Hono に正しくマウントされることを確認できること
  - _Requirements: 6.1, 6.2_
  - _Boundary: HonoServer, TRPCHandler_

- [ ] 1.2 SNAP_TASK_NOT_FOUND エラーコードを追加する
  - `server/src/errors/codes.ts` の `ErrorCode` オブジェクトに `SNAP_TASK_NOT_FOUND: 'SNAP_TASK_NOT_FOUND'` を追加する
  - TypeScript の型推論で `ErrorCode` 型に `SNAP_TASK_NOT_FOUND` が含まれることを確認する
  - _Requirements: 6.3_
  - _Boundary: ErrorCodes_

- [ ] 2. Core: progress tRPC ルーター実装
- [ ] 2.1 progress.record プロシージャを実装する
  - `server/src/api/progress.ts` を新規作成し、`recordProgressSchema`（taskId・snapshotDate・progressPct・acDays）を Zod で定義する
  - `progressPct` は 0〜100 の整数、`acDays` は 0 以上の数値として Zod バリデーションを設定する
  - `snapshotDate` は `/^\d{4}-\d{2}-\d{2}$/` の正規表現バリデーションを設定する
  - タスク存在確認: `db.select().from(tasks).where(eq(tasks.id, input.taskId))` で存在チェックし、未存在時に `AppError(SNAP_TASK_NOT_FOUND, ...)` を throw する
  - Drizzle `insert(progressSnapshots).values(...).onConflictDoUpdate({ target: [progressSnapshots.taskId, progressSnapshots.snapshotDate], set: { progressPct, acDays } })` で upsert する
  - 保存された `ProgressSnapshot` レコードを返す
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - _Depends: 1.1, 1.2_
  - _Boundary: ProgressRouter_

- [ ] 2.2 (P) progress.getByDate プロシージャを実装する
  - `progress.getByDate({ projectId, snapshotDate })` を実装する
  - `tasks` テーブルと JOIN し `tasks.projectId = input.projectId` AND `progressSnapshots.snapshotDate = input.snapshotDate` でフィルタするクエリを記述する
  - 結果を `task_id` 昇順でソートして返す
  - `GET progress.getByDate({ projectId: 1, snapshotDate: '2026-05-12' })` が指定日付のスナップショット配列を返すこと
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Depends: 1.1_
  - _Boundary: ProgressRouter_

- [ ] 2.3 (P) progress.getLatest プロシージャを実装する
  - `progress.getLatest({ projectId })` を実装する
  - `tasks` テーブルと JOIN し、各タスクの `MAX(snapshot_date)` を持つスナップショットのみを返す相関サブクエリを Drizzle `sql` ヘルパーで記述する
  - `GET progress.getLatest({ projectId: 1 })` が各タスク 1 件ずつ（最新日付のもの）を返すこと
  - 同一タスクに複数スナップショットが存在しても最新のみ返すことを確認できること
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Depends: 1.1_
  - _Boundary: ProgressRouter_

- [ ] 2.4 (P) progress.getHistory プロシージャを実装する
  - `progress.getHistory({ taskId })` を実装する
  - `progressSnapshots.taskId = input.taskId` でフィルタし、`snapshot_date` 昇順でソートするクエリを記述する
  - 存在しない `taskId` の場合は空配列を返す（エラーなし）
  - `GET progress.getHistory({ taskId: 1 })` が当該タスクのスナップショット履歴を昇順で返すこと
  - _Requirements: 4.1, 4.2, 4.3_
  - _Depends: 1.1_
  - _Boundary: ProgressRouter_

- [ ] 2.5 progress ルーターを appRouter にマウントする
  - `server/src/router.ts` の `appRouter` に `progress: progressRouter` をマウントする
  - `server/src/api/progress.ts` から `progressRouter` をインポートして統合する
  - tRPC クライアントから `trpc.progress.record` が型補完で見えること
  - _Requirements: 6.1_
  - _Depends: 1.1, 2.1, 2.2, 2.3, 2.4_
  - _Boundary: HonoServer, ProgressRouter_

- [ ] 3. Core: クライアント tRPC インフラ構築
- [ ] 3.1 tRPC クライアント設定を作成する
  - `client/src/lib/trpc.ts` を新規作成し、`createTRPCReact<AppRouter>()` で `trpc` クライアントをエクスポートする
  - `client/src/lib/trpc.ts` に `QueryClient` インスタンスとデフォルト設定をエクスポートする
  - `client/src/App.tsx` に `QueryClientProvider` と `trpc.Provider` をラップして追加する（API URL: `http://localhost:3001/trpc`）
  - `trpc.progress.record.useMutation()` が TypeScript エラーなしで呼び出せること
  - _Requirements: 5.1_
  - _Depends: 2.5_
  - _Boundary: TRPCClient_

- [ ] 3.2 useProgress フックを実装する
  - `client/src/hooks/useProgress.ts` を新規作成する
  - `useProgressByDate(projectId: number | null, snapshotDate: string)`: `trpc.progress.getByDate.useQuery` で既存スナップショットを取得する（`enabled: !!projectId && !!snapshotDate`）
  - `useRecordProgress()`: `trpc.progress.record.useMutation` を返す。成功後に `progress.getByDate` クエリを invalidate する
  - `useProjects()`: `trpc.projects.list.useQuery` でプロジェクト一覧を取得する
  - `useTasksByProject(projectId: number | null)`: `trpc.tasks.listByProject.useQuery` でタスク一覧を取得する（`enabled: !!projectId`）
  - 各フックが型推論されたデータを返すこと
  - _Requirements: 5.1, 5.2, 5.3, 5.8_
  - _Depends: 3.1_
  - _Boundary: useProgress_

- [ ] 4. Core: ProgressInputPage UI 実装
- [ ] 4.1 ProgressInputPage コンポーネントを実装する
  - `client/src/pages/ProgressInputPage.tsx` を新規作成する
  - プロジェクトセレクト・日付インプット（初期値: 今日の日付）を実装する（要件 5.1）
  - プロジェクトと日付が選択されたとき、`useTasksByProject` で取得した is_leaf=true のタスク一覧を表示し、各行に `progressPct`（0-100）と `acDays`（≥0）の入力フィールドを表示する（要件 5.2）
  - `useProgressByDate` で取得した既存スナップショットを入力フィールドの初期値として設定する（要件 5.8）
  - `inputs` ステートで各タスクの入力値を管理し、`progressPct` は 0 未満・100 超でインラインエラーを表示する（要件 5.6）
  - `acDays` が負の値のときインラインエラーを表示する（要件 5.7）
  - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8_
  - _Depends: 3.2_
  - _Boundary: ProgressInputPage_

- [ ] 4.2 保存処理とフィードバックを実装する
  - 「保存」ボタン押下時にクライアントバリデーションを実行し、エラーがなければ全タスクの `useRecordProgress().mutateAsync` を `Promise.all` で並列送信する（要件 5.3）
  - 保存成功時に成功通知（簡易トースト or 画面上部メッセージ）を表示する（要件 5.4）
  - 保存中にエラーが発生した場合にエラーメッセージを表示する（要件 5.5）
  - 保存ボタンがブラウザ上でクリックでき、成功・失敗それぞれのフィードバックがユーザーに表示されること
  - _Requirements: 5.3, 5.4, 5.5_
  - _Depends: 4.1_
  - _Boundary: ProgressInputPage_

- [ ] 4.3 App.tsx にルートを追加する
  - `client/src/App.tsx` に `/progress` ルートを追加し、`ProgressInputPage` を表示する（React Router または条件付きレンダリング）
  - ブラウザで `/progress` にアクセスしたとき `ProgressInputPage` が表示されること
  - _Requirements: 5.1_
  - _Depends: 4.1, 4.2_
  - _Boundary: ProgressInputPage_

- [ ] 5. Validation: テスト実装
- [ ] 5.1 progress ルーターの Vitest 単体テストを実装する
  - `server/src/api/progress.test.ts` を作成し、Vitest でテストを記述する
  - `progress.record` 正常系: 新規スナップショット作成後にレコードが返ること（要件 1.1, 1.6）
  - `progress.record` upsert 検証: 同一 (task_id, snapshotDate) で再度記録すると値が更新され、レコード数が増えないこと（要件 1.1, 1.7）
  - `progress.record` バリデーションエラー: `progressPct=101` で BAD_REQUEST エラーが返ること（要件 1.2）
  - `progress.record` タスク未存在: `SNAP_TASK_NOT_FOUND` を含む NOT_FOUND エラーが返ること（要件 1.5）
  - `progress.getLatest` 最新のみ返す検証: 同一タスクに 2 つの異なる日付スナップショットがある場合、最新の 1 件のみが返ること（要件 3.1, 3.2）
  - `progress.getHistory` 時系列昇順検証: 複数スナップショットが `snapshot_date` 昇順で返ること（要件 4.1）
  - `npm test` で全テストが PASS すること
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 3.1, 3.2, 4.1_
  - _Depends: 2.1, 2.2, 2.3, 2.4_

- [ ]* 5.2 E2E テストを実装する
  - `e2e/progress.spec.ts` を作成し、Playwright で E2E テストを記述する
  - プロジェクト選択 → 日付選択 → progress_pct・ac_days 入力 → 保存 → 成功通知表示のフロー（要件 5.1–5.4）
  - `progressPct=101` で保存ボタン押下 → クライアントバリデーションエラーが表示されること（要件 5.6）
  - `npm run test:e2e` でテストが PASS すること
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  - _Depends: 4.1, 4.2, 4.3_
