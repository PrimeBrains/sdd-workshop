# Implementation Plan

## Task Format Template

- [ ] 1. 基盤整備: エラーコード追加とルーターマウント
- [ ] 1.1 REPORT_* エラーコードを `errors/codes.ts` に追加する
  - `REPORT_NO_SNAPSHOT` と `REPORT_PROJ_NOT_FOUND` を `ErrorCode` オブジェクトに追加する
  - 既存の `SNAP_TASK_NOT_FOUND` 等のコードと命名規則（`DOMAIN_REASON` 形式）を統一する
  - `codes.ts` にコードを追加後、TypeScript コンパイルがエラーなく通ること
  - _Requirements: 6.3_
  - _Boundary: ErrorCodes_

- [ ] 1.2 `router.ts` に reports ルーターのマウントプレースホルダーを追加する
  - `server/src/router.ts` を更新して `reportsRouter` のインポートと `appRouter` へのマウントを追加する
  - `reports.ts` がまだ存在しないためスタブで仮マウントし、後続タスクで実実装に差し替える
  - サーバーが起動してエラーなく `/trpc/reports.*` のパスが認識されること
  - _Requirements: 6.1_
  - _Boundary: ReportsRouter_
  - _Depends: 1.1_

- [ ] 2. コアサービス: report-generator.ts の実装
- [ ] 2.1 `report-generator.ts` のファイルを作成してインターフェース型を定義する
  - `ReportInput`, `TaskSummary`, `DelayedTaskSummary`, `AlertSummary`, `MorningReportData`, `MorningReportResult`, `EvmSummary` を定義してエクスポートする
  - evm-engine の `ProjectEvmMetrics`・`TaskEvmMetrics` 型をインポートする
  - TypeScript strict モードでコンパイルエラーゼロが確認できること
  - _Requirements: 1.1, 4.1_
  - _Boundary: ReportGenerator_
  - _Depends: 1.1_

- [ ] 2.2 `generateEvmSummary` 関数を実装する
  - `ReportInput` を受け取り `calculateEvmMetrics` を呼び出して `EvmSummary` を返す
  - `is_buffer = true` タスクは `calculateEvmMetrics` が除外することを確認する（二重除外しない）
  - PV=0 の場合 SPI=null、AC=0 の場合 CPI=null が正しく返ること
  - `generateEvmSummary` の単体テストが Vitest でパスすること
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: ReportGenerator_
  - _Depends: 2.1_

- [ ] 2.3 `extractDelayedTasks` 関数を実装する
  - `calculateEvmMetrics` の `taskMetrics` を利用して各タスクの SPI を取得する
  - 遅延条件: `spi < minSpi`（省略時 0.9）OR（`task.plannedEnd < baseDate` AND `progressPct < 100`）の OR 評価
  - `task.isBuffer === true` のタスクを結果から除外する
  - `assigneeName` は `members` 配列から `task.assigneeId` で検索し、未割当の場合は null を返す
  - `extractDelayedTasks` の単体テスト（SPI 閾値・overdue・is_buffer 除外・minSpi カスタム）がパスすること
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Boundary: ReportGenerator_
  - _Depends: 2.1_

- [ ] 2.4 `renderMorningMarkdown` 関数を実装する
  - `MorningReportData` とプロジェクト名を受け取り Markdown 文字列を返す純粋関数
  - 出力構造: `# 朝報 {projectName} - {date}` → プロジェクトサマリー表 → 完了タスク → 進捗タスク → 遅延タスク表 → アラート集計
  - 外部ライブラリ不使用の文字列テンプレートのみで実装する
  - `renderMorningMarkdown` 呼び出し時に必要なセクション（プロジェクトサマリー・遅延タスク表・アラート集計）が全て含まれる Markdown が返ること
  - _Requirements: 4.2, 4.3_
  - _Boundary: ReportGenerator_
  - _Depends: 2.1_

- [ ] 2.5 `generateMorningReport` 関数を実装する
  - `currentInput`・`prevSnapshots`・`prevDate` を受け取り `MorningReportResult` を返す
  - `calculateEvmMetrics` を current・prev それぞれで呼び出して差分（deltaSpi・deltaEv）を算出する
  - prev snapshot と current snapshot を比較してタスクを「完了」「進捗あり」に分類する
  - `extractDelayedTasks` で遅延タスクを取得し、`evaluateAlertLevel` でアラート件数を集計する
  - `renderMorningMarkdown` を呼び出して markdown フィールドに文字列を格納する
  - `generateMorningReport` の単体テスト（差分計算・タスク分類・アラート集計・Markdown 出力）が全てパスすること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - _Boundary: ReportGenerator_
  - _Depends: 2.2, 2.3, 2.4_

- [ ] 3. API レイヤー: reports tRPC ルーターの実装
- [ ] 3.1 `reports.summary` プロシージャを実装する
  - `summarySchema`（projectId・baseDate）で入力バリデーションを行う
  - プロジェクト存在確認 → 未存在で `AppError(REPORT_PROJ_NOT_FOUND)` → `TRPCError(NOT_FOUND)`
  - tasks・members・holidays・snapshots を Drizzle でクエリして `ReportInput` を組み立てる
  - `generateEvmSummary` を呼び出して `EvmSummary` を返す
  - `reports.summary` を呼び出した際に `EvmSummary` オブジェクトが返ること
  - _Requirements: 3.1, 3.5, 6.1, 6.2, 6.4_
  - _Boundary: ReportsRouter_
  - _Depends: 2.2_

- [ ] 3.2 `reports.delayed` プロシージャを実装する
  - `delayedSchema`（projectId・baseDate・minSpi?）で入力バリデーションを行う
  - プロジェクト存在確認 → 未存在でエラー
  - tasks・members・holidays・snapshots を Drizzle でクエリして `extractDelayedTasks` を呼び出す
  - `reports.delayed` を呼び出した際に `DelayedTaskSummary[]` が返ること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.4_
  - _Boundary: ReportsRouter_
  - _Depends: 2.3_

- [ ] 3.3 `reports.morning` プロシージャを実装する
  - `morningReportSchema`（projectId・date・prevDate?）で入力バリデーションを行う
  - プロジェクト存在確認 → 未存在で `TRPCError(NOT_FOUND)`
  - `date` のスナップショット取得 → 空なら `AppError(REPORT_NO_SNAPSHOT)` → `TRPCError(NOT_FOUND)`
  - `prevDate` 省略時: `SELECT MAX(snapshot_date) FROM progress_snapshots JOIN tasks WHERE project_id = ? AND snapshot_date < ?` で直近日を取得
  - 全データを集約して `generateMorningReport` を呼び出し `MorningReportResult` を返す
  - pino で `{ projectId, date }` をログ出力（個人名なし）
  - `reports.morning` を呼び出した際に `MorningReportResult`（data + markdown）が返ること
  - `prevDate` 省略時に直近スナップショット日が自動選択されること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 4.1, 4.2, 4.3, 6.1, 6.2, 6.4_
  - _Boundary: ReportsRouter_
  - _Depends: 2.5, 3.1, 3.2_

- [ ] 3.4 `router.ts` を更新して `reportsRouter` を本番マウントする
  - タスク 1.2 で追加したスタブを実際の `reportsRouter` インポートに差し替える
  - `npm run dev:server` でサーバーが起動し `/trpc/reports.morning` が 400 バリデーションエラーを返すこと（ルートが認識されている確認）
  - _Requirements: 6.1_
  - _Boundary: ReportsRouter_
  - _Depends: 3.3_

- [ ] 4. フロントエンド: useReports フックの実装 (P)
- [ ] 4.1 (P) `useReports.ts` フックを実装する
  - `useMorningReport(projectId, date, prevDate?)`: `trpc.reports.morning.useQuery` を `enabled: !!projectId && !!date` 条件付きで使用
  - `useDelayedTasks(projectId, baseDate, minSpi?)`: `trpc.reports.delayed.useQuery` を使用
  - `useEvmSummary(projectId, baseDate)`: `trpc.reports.summary.useQuery` を使用
  - `useProjects()`: `trpc.projects.list.useQuery` を使用（既存 hook があれば再利用）
  - TypeScript 推論で `MorningReportResult`・`DelayedTaskSummary[]`・`EvmSummary` の型が利用できること
  - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - _Boundary: useReports_
  - _Depends: 3.3_

- [ ] 5. フロントエンド: ReportPage の実装
- [ ] 5.1 ReportPage のレイアウトとセレクター UI を実装する
  - プロジェクトセレクト（`useProjects` から取得）と日付インプット（`<input type="date">`、初期値 today）を実装する
  - `selectedProjectId` と `selectedDate` をコンポーネントローカルステートで管理する
  - ページを `/reports` ルートで `App.tsx` に登録し、ブラウザでアクセスできること
  - _Requirements: 5.1_
  - _Boundary: ReportPage_
  - _Depends: 4.1_

- [ ] 5.2 朝報 Markdown 表示エリアを実装する
  - `useMorningReport` を呼び出して結果を取得する
  - `<pre>` タグ または安全な Markdown レンダラーで朝報 Markdown を表示する（`dangerouslySetInnerHTML` 禁止）
  - `isLoading` 中はローディングインジケーターを表示する
  - プロジェクトと日付を選択後に朝報テキストが表示されること
  - _Requirements: 5.2, 5.6_
  - _Boundary: ReportPage_
  - _Depends: 5.1_

- [ ] 5.3 遅延タスクテーブルを実装する
  - `useMorningReport` の `data.delayedTasks` を使用してテーブルを表示する
  - 列: タスク名・担当者・SPI・planned_end・alert_level
  - `alert_level` に応じた色分け（CRITICAL_DELAY: 赤、WARNING_DELAY: 黄）を TailwindCSS で実装する
  - 遅延タスクが存在する場合、テーブルに行が表示されること
  - _Requirements: 5.4_
  - _Boundary: ReportPage_
  - _Depends: 5.2_

- [ ] 5.4 Markdown ダウンロードボタンを実装する
  - 朝報 Markdown が表示されている状態で「.md としてダウンロード」ボタンを表示する
  - ボタンクリック時: `new Blob([markdown], { type: 'text/markdown' })` → `URL.createObjectURL` → `<a download="morning-report-{date}.md">` をプログラム的にクリック → URL を解放（`URL.revokeObjectURL`）
  - ボタンクリック後にブラウザの `.md` ダウンロードが発生すること
  - _Requirements: 5.3_
  - _Boundary: ReportPage_
  - _Depends: 5.2_

- [ ] 5.5 エラートーストを実装する
  - `useMorningReport.error` を監視して `useEffect` でトーストを表示する
  - TailwindCSS で画面下部に固定表示するシンプルなトーストコンポーネントを実装する（既存のトーストコンポーネントがあれば再利用）
  - `reports.morning` がエラーを返した場合、画面にエラーメッセージが表示されること
  - _Requirements: 5.5_
  - _Boundary: ReportPage_
  - _Depends: 5.2_

- [ ] 6. テストとバリデーション
- [ ] 6.1 (P) `report-generator.test.ts` の単体テストを完成させる
  - `generateEvmSummary`: PV=0→SPI=null、AC=0→CPI=null、通常値計算を検証
  - `extractDelayedTasks`: SPI 閾値・overdue・is_buffer 除外・minSpi カスタムを検証
  - `generateMorningReport`: ΔSPI・ΔEV 差分計算・完了/進捗タスク分類・アラート集計を検証
  - `renderMorningMarkdown`: 必要セクションの存在を検証
  - `npm test` で全テストがパスすること
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4, 3.1, 3.2, 4.2_
  - _Boundary: ReportGenerator_

- [ ]* 6.2 (P) E2E テスト: 朝報表示とダウンロードフローを検証する
  - Playwright で `/reports` にアクセスしてプロジェクト選択 → 日付選択 → 朝報表示を確認する
  - ダウンロードボタンクリック → `.md` ファイルのダウンロードを確認する
  - E2E テストシナリオが `npm run test:e2e` でパスすること
  - _Requirements: 5.1, 5.2, 5.3_
  - _Boundary: ReportPage, useReports_
  - _Depends: 5.4_
