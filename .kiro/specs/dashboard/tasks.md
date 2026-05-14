# Implementation Plan: dashboard

## Task Format

- `(P)` = 並列実行可能（依存タスクが完了済みであれば他タスクと同時実行可能）
- `_Boundary:_` = コンポーネント境界
- `_Depends:_` = 非自明な依存関係
- `_Requirements:_` = 対応要件 ID

---

- [ ] 1. Foundation: tRPC evm ルーター基盤のセットアップ
- [x] 1.1 `evm.calculate` tRPC ルーターのスケルトン作成と router.ts へのマウント
  - `server/src/api/evm.ts` を新規作成し、`z.object({ projectId, baseDate })` を入力とする `evm.calculate` クエリプロシージャのスケルトンを定義する
  - `server/src/router.ts` に `evm: evmRouter` を追加してマウントする
  - Zod 入力スキーマ（`calculateInputSchema`）を定義し、projectId は正整数・baseDate は `YYYY-MM-DD` 形式の正規表現バリデーションを設定する
  - tRPC クライアントで `trpc.evm.calculate` が型安全に呼び出せる状態になっていることを確認する
  - _Requirements: 8.1, 8.4_

- [x] 1.2 プロジェクト未存在エラー処理と出力型の定義
  - `server/src/errors/codes.ts` の既存 `PROJ_NOT_FOUND` を使用する（変更不要）
  - `EvmSummaryOutput`, `AssigneeEvmOutput`, `AlertOutput`, `SpiTrendPoint`, `FeverChartOutput`, `EvmCalculateOutput` 型を `server/src/api/evm.ts` に定義してエクスポートする
  - `evm.calculate` でプロジェクト未存在時に `TRPCError({ code: 'NOT_FOUND', ... })` を throw するロジックを実装する
  - `evm.calculate` にプロジェクト未存在ケースのサーバー単体テスト（Vitest）を追加する
  - _Requirements: 8.3_

---

- [ ] 2. Core: evm.calculate ルーターの本体実装
- [x] 2.1 DB クエリ集約と EVM メトリクス計算の実装
  - `evm.calculate` 内で `tasks`, `members`, `holidays`, `progressSnapshots`（最新スナップショット）を Drizzle で取得する
  - `calculateEvmMetrics(input)` を呼び出してプロジェクト全体の `ProjectEvmMetrics` を取得する
  - `summary` フィールド（BAC/PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI）を `EvmSummaryOutput` に変換して格納する
  - `evm.calculate` の正常系でレスポンスの `summary` フィールドが正しく返ることをテストする
  - _Requirements: 8.2, 8.5, 3.1_

- [x] 2.2 担当者別 EVM 集計の実装
  - `tasks` を `assigneeId` でグループ化し、各担当者のタスクのみを対象に `calculateEvmMetrics` を呼び出す
  - `members` テーブルから担当者名を解決して `AssigneeEvmOutput[]` を構築する
  - SPI 閾値に基づいて `status`（`critical` / `warning` / `normal` / `na`）を設定する（SPI < 0.8: critical、0.8 ≤ SPI < 0.9: warning、≥ 0.9: normal、PV=0: na）
  - `assignees` フィールドが担当者ごとに正しい SPI・status を返すことをテストする
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2.3 アラート生成の実装
  - `taskMetrics` の各タスクに対して `evaluateAlertLevel` を呼び出し、`CRITICAL_DELAY` / `WARNING_DELAY` のタスクを抽出する
  - タスク名・担当者名（`members` テーブルから解決）・SPI 値・レベルを `AlertOutput[]` に変換する
  - SPI < 0.8 → level: `critical`、0.8 ≤ SPI < 0.9 → level: `warning` として正しくアラートが生成されることをテストする
  - PV=0（SPI=null）のタスクはアラート対象外となることをテストする
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 2.4 CCPM フィーバーチャートデータの生成
  - `findCriticalPath` でクリティカルパスのタスク ID を特定する
  - `is_buffer=true` のタスクを抽出してバッファ総日数を算出する
  - バッファタスクが存在しない場合は `feverChart: null` を返す
  - バッファタスクが存在する場合は `calculateFeverChart` を呼び出して `FeverChartOutput` を構築する
  - バッファなしプロジェクトで `feverChart = null` が返ることをテストする
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.5 SPI トレンドデータの生成
  - `progressSnapshots` の `snapshot_date` の一意リストを取得し、各日付ごとに `calculateEvmMetrics` を呼び出して SPI/CPI 時系列データ `SpiTrendPoint[]` を構築する
  - SPI または CPI が null の時点（PV=0）もそのまま `null` として含める（フロントエンドが除外処理を行う）
  - `spiTrend` フィールドが日付昇順で返ることをテストする
  - _Requirements: 4.1, 4.2, 4.4, 7.3_

---

- [ ] 3. Core: フロントエンド基盤（useEvm フック + DashboardPage 骨格）
- [x] 3.1 useEvm フックの実装
  - `client/src/hooks/useEvm.ts` を新規作成し、`trpc.evm.calculate.useQuery` を `staleTime: 5 * 60 * 1000`（5 分）で呼び出す `useEvmCalculate` フックを実装する
  - `projectId` または `baseDate` が null のとき `enabled: false` でクエリを無効化する
  - `client/src/App.tsx` に `/dashboard` ルートと `DashboardPage` コンポーネントを追加する
  - _Requirements: 7.1, 7.2, 7.3_
  - _Depends: 1.1_

- [x] 3.2 DashboardPage のプロジェクト・基準日選択 UI の実装
  - `client/src/pages/DashboardPage.tsx` を新規作成し、`projects.list` クエリでプロジェクト一覧を取得してドロップダウンに表示する
  - `selectedProjectId: number | null` と `baseDate: string`（初期値: today の ISO 形式）のステート管理を実装する
  - 基準日ピッカー（`<input type="date">`）を配置し、変更時に `baseDate` ステートを更新する
  - `useEvmCalculate` でデータ取得中はローディングスピナーを表示し、エラー時はエラーメッセージを表示する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - _Depends: 3.1_

---

- [ ] 4. Core: UI コンポーネント実装（並列可能）
- [x] 4.1 (P) AlertBanner コンポーネントの実装
  - `client/src/components/AlertBanner.tsx` を新規作成し、`alerts: AlertOutput[]` props を受け取る
  - `alerts` が空配列の場合はコンポーネントを非表示にする（要件 2.4）
  - critical アラートを赤背景、warning アラートを黄背景で表示し、各行にタスク名・担当者名・SPI 値を表示する
  - アラートリストが表示され各行の情報が正しく含まれることを目視確認できる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: AlertBanner_

- [x] 4.2 (P) ProjectSummaryCards コンポーネントの実装
  - `client/src/components/ProjectSummaryCards.tsx` を新規作成し、`summary: EvmSummaryOutput` props を受け取る
  - BAC・EAC・VAC・ETC・TCPI・全体 SPI・全体 CPI を数値カードとして表示する
  - SPI カードに閾値連動の色付けを実装する（SPI < 0.8: 赤、0.8–0.9: 黄、≥ 0.9: 緑）
  - `spi = null` / `cpi = null` は "N/A" と表示する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Boundary: ProjectSummaryCards_

- [x] 4.3 (P) SpiTrendChart コンポーネントの実装
  - `client/src/components/SpiTrendChart.tsx` を新規作成し、`data: SpiTrendPoint[]` props を受け取る
  - recharts の `LineChart` + 2 本の `Line`（SPI: 青・CPI: 橙）で折れ線チャートを描画する
  - `ReferenceLine y={1.0}` で基準線を表示する（要件 4.3）
  - `null` 値のデータポイントで折れ線が途切れる（`connectNulls={false}` または null を除外する）
  - `Tooltip` カスタマイザーでスナップショット日・SPI・CPI の値を表示する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Boundary: SpiTrendChart_

- [x] 4.4 (P) FeverChart コンポーネントの実装
  - `client/src/components/FeverChart.tsx` を新規作成し、`data: FeverChartOutput | null` props を受け取る
  - recharts の `ScatterChart` で X 軸にクリティカルチェーン完了率・Y 軸にバッファ消費率をプロットする
  - `ReferenceArea` を 3 つ重ねて Green/Yellow/Red ゾーンの背景色を描画する
  - プロットをゾーンに応じた色（Green: green-600・Yellow: yellow-500・Red: red-600）で着色する
  - `data = null` のとき "バッファデータなし" の代替 UI を表示する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: FeverChart_

- [x] 4.5 (P) AssigneeTable コンポーネントの実装
  - `client/src/components/AssigneeTable.tsx` を新規作成し、`assignees: AssigneeEvmOutput[]` props を受け取る
  - 担当者名・BAC・EV・PV・SPI・AC・CPI・ステータスの列を持つテーブルを表示する
  - `status` に応じた行の背景色（critical: 赤・warning: 黄・normal: 緑・na: デフォルト）を TailwindCSS で適用する
  - `spi = null` / `cpi = null` は "N/A" と表示する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: AssigneeTable_

---

- [ ] 5. Integration: DashboardPage へのコンポーネント統合とレスポンシブレイアウト
- [x] 5.1 DashboardPage に全コンポーネントを組み込む
  - `DashboardPage` に `AlertBanner`, `ProjectSummaryCards`, `SpiTrendChart`, `FeverChart`, `AssigneeTable` を組み込む
  - `useEvmCalculate` の戻り値を各コンポーネントの props に渡す
  - TailwindCSS 4 でレスポンシブグリッドレイアウトを実装する（lg: 2 カラム: SpiTrendChart + FeverChart、sm: 1 カラム）
  - プロジェクト選択 → データ取得 → 全コンポーネント描画の流れが画面上で動作することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 9.1, 9.2, 9.3_
  - _Depends: 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5.2 キャッシュ動作の確認とエラーケースの結合テスト
  - 同一プロジェクト・基準日を 5 分以内に再選択した際にネットワークリクエストが発生しないことをブラウザ DevTools で確認する
  - 存在しないプロジェクト ID でエラーメッセージが DashboardPage 内に表示されることを確認する
  - SPI < 0.8 のテストデータでアラートバナーが critical 表示になることを E2E テスト（Playwright）で検証する
  - _Requirements: 7.1, 7.2, 1.6, 2.1_

---

- [ ] 7. Core: GanttChart コンポーネントの実装
- [x] 7.1 evm.calculate に gantt フィールドを追加
  - `server/src/api/evm.ts` の `EvmCalculateOutput` に `gantt: GanttTaskOutput[]` フィールドを追加する
  - `GanttTaskOutput` 型（`id`, `name`, `assigneeName`, `plannedStart`, `plannedEnd`, `progressPct`, `spi`, `level`, `sortOrder`, `isBuffer`, `isLeaf`）を定義してエクスポートする
  - `evm.calculate` 実装でタスク一覧を `sort_order` 昇順に並べ、各タスクの最新 `progressPct` と `spi`（TaskEvmMetrics から）を解決して `gantt` フィールドを構築する
  - `gantt` フィールドが `sort_order` 昇順でタスクを返すことをサーバー単体テストで確認する
  - _Requirements: 10.1, 10.5_
  - _Depends: 2.1_

- [ ] 7.2 (P) GanttChart コンポーネントの実装
  - `client/src/components/GanttChart.tsx` を新規作成し、`tasks: GanttTaskOutput[]`, `baseDate: string`, `onProgressUpdate?`, `onTaskReschedule?` props を受け取る
  - 横軸タイムラインをプロジェクト内の最小 `plannedStart` ～最大 `plannedEnd` で自動計算し、タスクバーを描画する
  - タスクバーを `progressPct` 割合で塗りつぶし（要件 10.2）、SPI 値に応じた色（赤/黄/青）を適用する（要件 10.4）
  - `baseDate` 位置に垂直の稲妻線を表示する（要件 10.3）
  - 左ラベル列にタスク名・担当者名を表示し、`level` に応じたインデントを適用する（要件 10.5, 10.6）
  - `isBuffer = true` のタスクバーをグレー/縞模様スタイルで描画する（要件 10.7）
  - `onProgressUpdate` / `onTaskReschedule` が `undefined` の場合、編集インタラクションを無効化して読み取り専用で表示する（要件 10.8）
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  - _Boundary: GanttChart_
  - _Depends: 7.1_

- [ ] 7.3 DashboardPage に GanttChart を組み込む
  - `DashboardPage` の UI に `GanttChart` コンポーネントを追加し、`useEvmCalculate` の `gantt` フィールドを props に渡す
  - `baseDate` ステートを `GanttChart` にも渡し、稲妻線がリアルタイムに更新されることを確認する
  - プロジェクト選択 → ガントチャート表示の流れが画面上で動作することを確認する
  - _Requirements: 10.1–10.8_
  - _Depends: 7.2, 5.1_

---

- [ ] 6. Validation: E2E テストとサーバー単体テストの追加
- [ ] 6.1 evm.calculate サーバー単体テスト（Vitest）の完成
  - `server/src/api/evm.test.ts` に以下のテストケースを追加する: 正常系（全フィールド返却）、プロジェクト未存在 → NOT_FOUND、baseDate フォーマット不正 → BAD_REQUEST、バッファなし → feverChart null、SPI < 0.8 → critical アラート、0.8 ≤ SPI < 0.9 → warning アラート
  - `npm test` で全テストが pass することを確認する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 2.1, 2.2, 5.5_

- [ ]* 6.2 E2E テスト（Playwright）の追加
  - `e2e/` に `dashboard.spec.ts` を追加し、以下のフローをテストする: プロジェクト選択 → 基準日設定 → 全コンポーネント表示確認（ダッシュボード表示フロー）
  - バッファタスクなしプロジェクトでフィーバーチャートが "バッファデータなし" と表示されることを確認する
  - ガントチャートが表示され、基準日変更時に稲妻線が更新されることを確認する
  - `npm run test:e2e` で E2E テストが pass することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.5, 10.1, 10.3_
