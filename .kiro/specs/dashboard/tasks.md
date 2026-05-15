# 実装計画: dashboard

本計画は `.kiro/specs/dashboard/design.md` の Migration Strategy（Phase 1–8）に従い、ビルドが通る状態を毎コミット維持しながら旧 3 画面 SPA から単一ワークベンチへ移行する。

各タスクは `evm-studio/client/` 配下を対象とする（相対パス基準）。`progress-tracking` spec が所有する `ProgressInputPanel.tsx` および `hooks/useProgress.ts` は別スペックで先行実装される前提で、本計画では「import して利用する」のみ。

## Phase 1: 基盤（tokens + atoms + formatters）

- [ ] 1. 基盤レイヤーを追加
- [ ] 1.1 デザイントークン `tokens/evm-tokens.ts` を追加 (P)
  - `client/src/tokens/evm-tokens.ts` を新規作成
  - モックアップ `mockup/shared.jsx` 行 24–50 の `EVM` 定数を完全移植
  - `EvmToken` 型をエクスポート
  - `import { EVM } from '@/tokens/evm-tokens'` で参照可能になる *(observable: TypeScript 型補完が効く)*
  - _Requirements: 14.1_
  - _Boundary: tokens/evm-tokens.ts_

- [ ] 1.2 グローバル CSS `styles/workbench.css` を追加 (P)
  - `client/src/styles/workbench.css` を新規作成
  - モックアップ `mockup/shared.jsx` 行 8–19 の hover / popover アニメーション CSS を移植
  - `main.tsx` で `import '@/styles/workbench.css'` する
  - ホバー時に `.evm-gantt-row` / `.evm-project-btn` / `.evm-btn` 等が想定どおりの背景色変化を示す *(observable: ブラウザ DevTools で hover style が反映される)*
  - _Requirements: 14.5_
  - _Boundary: styles/workbench.css_

- [ ] 1.3 Google Fonts CDN を `index.html` に追加 (P)
  - `client/index.html` の `<head>` に Cinzel / Source Serif 4 / JetBrains Mono / Inter の `<link rel="preconnect">` + `<link rel="stylesheet">` を追加
  - 4 種類のフォントがネットワークタブで読み込まれる *(observable: DevTools Network タブで woff2 が 200 で返る)*
  - _Requirements: 14.2_
  - _Boundary: index.html_

- [ ] 1.4 フォーマッタ純関数 `lib/formatters.ts` を追加 (P)
  - `client/src/lib/formatters.ts` を新規作成
  - `fmtMD` / `fmtPct` / `fmtNum` / `fmtSignedMD` / `fmtDeltaIdx` / `fmtDeltaMD` / `fmtDeltaPct` / `deltaTone` / `statusColor` / `spiTone` / `statusJp` / `initialsOf` / `dateOffsetToISO` を実装
  - すべて純関数で副作用なし
  - 別ファイルから import して関数呼び出しが TypeScript エラーなく完結する *(observable: tsc で型エラーが出ない)*
  - _Requirements: 4.7, 6.4, 11.2, 11.3_
  - _Boundary: lib/formatters.ts_

- [ ] 1.5 原子コンポーネント 8 種を追加 (P)
  - `client/src/components/atoms/` を新規作成し、`Card.tsx` / `Pill.tsx` / `Dot.tsx` / `Eyebrow.tsx` / `Avatar.tsx` / `BrandMark.tsx` / `FilterChip.tsx` / `Chevron.tsx` を追加
  - モックアップ `mockup/shared.jsx` 行 157–230 と `variation-a.jsx` 行 1471–1511 から 1:1 で TSX 移植
  - 各コンポーネントの props 型を export
  - `React.memo` でメモ化
  - Storybook 等は導入しないが、Vite の `npm run build` が型エラーなく成功する *(observable: tsc + vite build 成功)*
  - _Requirements: 14.5, 15.8_
  - _Boundary: components/atoms/_

## Phase 2: 部品（shell / summary / alerts / gantt / charts / inspector）

- [ ] 2. 中央領域・シェル・Inspector の各コンポーネントを追加
- [ ] 2.1 `components/shell/TopBar.tsx` を追加 (P)
  - 横並びヘッダー（ブランド + プロジェクトピッカー + 基準日ピッカー + 通知 + アバター）
  - プロジェクトピッカーは popover 開閉と prop で受領した `projectMenuOpen` を反映
  - 基準日ピッカーは `<input type="date">` + 3 プリセットチップ
  - Esc キーで開いている popover を閉じる
  - props: `projects`, `activeProjectId`, `baseDate`, `projectMenuOpen`, `datePickerOpen`, `onProjectChange`, `onBaseDateChange`, `onToggleProjectMenu`, `onToggleDatePicker`
  - 単体で表示確認時にモックアップと視覚的にほぼ一致する *(observable: Vite 上で TopBar 単体ストーリーを作らずとも、Phase 3 で WorkbenchPage マウント時に見た目が一致)*
  - _Requirements: 2.1-2.8, 17.3_
  - _Boundary: components/shell/TopBar.tsx_
  - _Depends: 1.1, 1.4, 1.5_

- [ ] 2.2 `components/shell/ProjectRail.tsx` を追加 (P)
  - 左レール 232px 固定。Projects セクション + Members セクション
  - props: `projects`, `activeProjectId`, `members`, `assignees`, `alertCountByProject`, `inspectorMode`, `inspectorMemberId`, `onProjectChange`, `onMemberSelect`
  - アクティブ行は brand wash 背景 + 3px brand-deep 左ボーダー
  - SPI tone は `spiTone()` で算出
  - _Requirements: 3.1-3.7_
  - _Boundary: components/shell/ProjectRail.tsx_
  - _Depends: 1.1, 1.4, 1.5_

- [ ] 2.3 `components/summary/{SummaryStrip,SummaryStat}.tsx` を追加 (P)
  - `SummaryStat.tsx`: label / value / sub / tone を props で受領し、モックアップ通りに表示する小コンポーネント
  - `SummaryStrip.tsx`: プロジェクトメタ + SPI/CPI/BAC/EV/AC/VAC + 前日比トグル
  - `compareMode` true/false で表示モード切替（current 値 ↔ 前日比 delta）
  - トグル UI は 36×20px の switch（モックアップ準拠）
  - props: `project`, `summary`, `prevDay`, `compareMode`, `onCompareModeChange`
  - _Requirements: 4.1-4.7_
  - _Boundary: components/summary/_
  - _Depends: 1.1, 1.4, 1.5_

- [ ] 2.4 `components/alerts/AlertStrip.tsx` を追加 (P)
  - props: `alerts`, `onJump`
  - 最高重大度に応じて background / heading を切替
  - 各チップクリックで `onJump(alert)` を呼ぶ
  - `alerts.length === 0` の HEALTHY 表示は親 (`WorkbenchPage`) が担当（本コンポーネントは描画しない）
  - _Requirements: 5.1-5.4_
  - _Boundary: components/alerts/AlertStrip.tsx_
  - _Depends: 1.1, 1.4, 1.5_

- [ ] 2.5 `components/gantt/GanttChart.tsx` を追加 (P)
  - モックアップ `mockup/shared.jsx` 行 487–747 の `Gantt` 関数を TSX 化
  - props: `tasks`, `gantt` (range), `selectedTaskId`, `onTaskClick`, `onFullscreen`, `width`, `labelW`, `rowH`, `showInfoCols`
  - 基準日縦線・雷線・SPI トーン色分けバー・WBS インデントを実装
  - 「全画面で見る」ボタン押下で `onFullscreen()` 発火
  - `tasks.length === 0` の場合「タスクがありません」を表示
  - _Requirements: 6.1-6.8, 18.3_
  - _Boundary: components/gantt/GanttChart.tsx_
  - _Depends: 1.1, 1.4, 1.5_

- [ ] 2.6 `components/charts/{SpiTrendChart,FeverChart,Sparkline}.tsx` を追加 (P)
  - `SpiTrendChart.tsx`: モックアップ `shared.jsx` 行 233–336 を TSX 化、`React.memo`
  - `FeverChart.tsx`: モックアップ `shared.jsx` 行 339–452 を TSX 化、`data === null` 時は「バッファタスク未定義」表示
  - `Sparkline.tsx`: モックアップ `shared.jsx` 行 455–467 を TSX 化
  - props: `data`, `w`, `h`, `color`（Sparkline のみ）
  - _Requirements: 9.1-9.6, 19.4_
  - _Boundary: components/charts/_
  - _Depends: 1.1, 1.5_

- [ ] 2.7 `components/inspector/{InspectorTaskMode,InspectorMemberMode,InspectorTeamMode}.tsx` を追加 (P)
  - 3 ファイルそれぞれモックアップ `variation-a.jsx` 行 626–897 の Task / Member / Team ブロックを 1:1 で移植
  - 各モードは props で全データを受領（自前のデータフェッチなし）
  - `compareMode === true` のとき各メトリクスは `prevDay` 比較に切り替わる
  - 担当者カードクリックで `onSwitchMember(assignee)` を呼ぶ
  - _Requirements: 11.2-11.7_
  - _Boundary: components/inspector/_
  - _Depends: 1.1, 1.4, 1.5, 2.6_

- [ ] 2.8 `components/shell/Inspector.tsx` シェルを追加
  - 上部に `TabBar` をレンダリングし、`mode` に応じて `InspectorTaskMode` / `InspectorMemberMode` / `InspectorTeamMode` のいずれかを描画
  - props: `mode`, `task`, `taskMetrics`, `taskTone`, `project`, `memberId`, `compareMode`, `onSwitchTask`, `onSwitchMember`, `onSwitchTeam`
  - _Requirements: 11.1, 11.4, 11.8_
  - _Boundary: components/shell/Inspector.tsx_
  - _Depends: 2.7_

## Phase 3: ページ統合（hooks/useEvm + WorkbenchPage + App.tsx 差し替え）

- [ ] 3. データフェッチフックとページを統合
- [ ] 3.1 `hooks/useEvm.ts` を追加
  - `trpc.evm.calculate.useQuery` をラップ
  - 入力 `{ projectId: number | null, baseDate: string }`、`enabled: projectId !== null && validIsoDate(baseDate)`
  - 戻り値 `{ data, isLoading, error, refetch }`
  - TypeScript の `EvmCalculateOutput` 型を tRPC から推論
  - `useEvm` を呼んだ別ファイルで `data.summary.spi` などの型補完が効く *(observable: tsc で型エラーが出ない)*
  - _Requirements: 13.1-13.4_
  - _Boundary: hooks/useEvm.ts_

- [ ] 3.2 `pages/WorkbenchPage.tsx` を追加
  - 11 個の `useState` で全状態スロットを保持（projectId / baseDate / selectedTaskId / inspectorMode / inspectorMemberId / compareMode / filter / ganttFull / chartFull / datePickerOpen / projectMenuOpen）
  - `useEvm({ projectId, baseDate })` を呼び、`data` を取得
  - 初期値: `projectId=1`, `baseDate=TODAY_ISO`, `selectedTaskId=null`, `inspectorMode='task'`, `inspectorMemberId=null`, `compareMode=false`, `filter='all'`, `ganttFull=false`, `chartFull=null`, `datePickerOpen=false`, `projectMenuOpen=false`
  - `useEffect([projectId, data])` で `selectedTaskId` を初期化（最初の `0 < progress < 100` の葉タスク → 最初の葉 → 最初のタスクの順）
  - レイアウト: TopBar + 3 カラム body（ProjectRail / Center / Inspector）
  - Center: SummaryStrip → AlertStrip or HEALTHY → GanttChart → 2 並びチャート（SpiTrendChart / FeverChart）
  - Inspector はモードに応じた表示
  - `useEvm` の `isLoading` / `error` 時はレイアウト殻 + 中央領域の placeholder/error カード
  - GanttFullscreen / ChartFullscreen は条件付きでマウント（次フェーズで実装）
  - 各子コンポーネントへのコールバックは `useCallback` でメモ化
  - _Requirements: 1.1-1.6, 12.1-12.5, 13.5-13.7, 18.1-18.5, 19.2_
  - _Boundary: pages/WorkbenchPage.tsx_
  - _Depends: 2.1-2.8, 3.1_

- [ ] 3.3 `App.tsx` のルート `/` を WorkbenchPage に差し替え
  - `client/src/App.tsx` の `<Routes>` から `/` → `DashboardPage` を `/` → `WorkbenchPage` に差し替え
  - `/progress` ルートは残したまま（次フェーズで削除）
  - `npm start` で起動すると `/` が WorkbenchPage を表示する *(observable: ブラウザで `localhost:5173` を開くとモックアップ風の画面が表示される)*
  - _Requirements: 1.1, 1.5, 16.1, 16.2_
  - _Boundary: App.tsx_
  - _Depends: 3.2_

## Phase 4: モーダル統合（GanttFullscreen + ChartFullscreen + ProgressInputPanel ホスト）

- [ ] 4. モーダル群を統合
- [ ] 4.1 `components/charts/ChartFullscreen.tsx` を追加 (P)
  - `ReactDOM.createPortal` で `document.body` 直下にマウント
  - props: `type` (`'trend' | 'fever'`), `project`, `onClose`
  - `type` に応じて `SpiTrendChart` または `FeverChart` を可変サイズで描画
  - Esc キー / 閉じるボタン / 背景クリックで `onClose()`
  - マウント時 `document.body.style.overflow = 'hidden'`、アンマウント時に復元
  - _Requirements: 10.1-10.5, 17.2, 17.4_
  - _Boundary: components/charts/ChartFullscreen.tsx_
  - _Depends: 2.6_

- [ ] 4.2 `components/gantt/GanttFullscreen.tsx` を追加
  - `ReactDOM.createPortal` で body 直下マウント
  - props: `project`, `tasks`, `assignees`, `selectedTaskId`, `filter`, `baseDate`, `onSelectTask`, `onFilterChange`, `onClose`
  - ヘッダー: ブランド + 基準日 + 担当者 `<select>` + 検索 + フィルターチップ + 閉じるボタン
  - 内部 state: `progressTask`, `snapshotDate`, `searchQuery`, `assigneeFilter`, `ganttW`
  - 担当者フィルター + 検索 + ステータスフィルターを `displayTasks` 計算ロジックで適用（モックアップ準拠の親階層含めロジック）
  - 葉タスク行クリックで `progressTask` をセット
  - Esc キー: `progressTask` があれば閉じるだけ、なければ `onClose()`
  - body スクロールロック + アンマウント時復元
  - `tasks` 表示エリアが空なら「該当するタスクはありません」
  - _Requirements: 7.1-7.11, 17.1, 17.4_
  - _Boundary: components/gantt/GanttFullscreen.tsx_
  - _Depends: 2.5_

- [ ] 4.2a `lib/task-tree.ts` に `deriveAncestors` ユーティリティを追加 (P)
  - `client/src/lib/task-tree.ts` を新規作成
  - シグネチャ: `deriveAncestors(task: TaskEvm, allTasks: ReadonlyArray<TaskEvm>): Array<{ id: number; name: string }>`
  - アルゴリズム: `task.code` を `'.'` で分割し、自身を除く各プレフィックス（例 `'1.2.3'` → `['1', '1.2']`）について `allTasks` から `code` が完全一致するタスクを探し、`{ id, name }` をルート → 親の順に積む
  - 一致しないプレフィックスはスキップ（祖先欠落データに対しても安全）
  - Vitest で単体テストを 3 ケース追加: ルートタスク=空配列 / 中間タスク=1 件 / 葉タスク=複数件 *(observable: `npm test -- task-tree` がグリーン)*
  - _Requirements: 8.2_
  - _Boundary: lib/task-tree.ts_
  - _Depends: なし（純関数）_

- [ ] 4.3 `GanttFullscreen` 内に `ProgressInputPanel` をホスト
  - `progressTask !== null` のとき右側 440px に `ProgressInputPanel`（`progress-tracking` 提供）をマウント
  - props マッピング: `task` を `ProgressInputTask` 形に変換（`dateOffsetToISO` を使って `plannedStart` / `plannedEnd` を ISO 化、`ancestors` は `lib/task-tree.ts` の `deriveAncestors(t, evm.tasks)` を `useMemo` でラップして算出）
  - `onSnapshotDateChange` で `snapshotDate` 更新、`onClose` で `progressTask=null`
  - 進捗入力サブパネル内の `<input type="date">` には `max={baseDate}` を設定し、未来日付の選択を防ぐ（要件 8.7）
  - `onSaved` で `trpc.useUtils().evm.calculate.invalidate()` を呼んでキャッシュ無効化 → 親 `useEvm` が refetch
  - 担当者フィルター変更時は `progressTask=null` にリセット
  - _Requirements: 7.7, 8.1-8.7, 13.5_
  - _Boundary: components/gantt/GanttFullscreen.tsx_
  - _Depends: 4.2, 4.2a_

- [ ] 4.4 `WorkbenchPage` から `GanttFullscreen` / `ChartFullscreen` をマウント
  - `WorkbenchPage` 末尾で `ganttFull === true` のとき `<GanttFullscreen ... />`、`chartFull !== null` のとき `<ChartFullscreen type={chartFull} ... />` を条件付きレンダリング
  - 各モーダルへ必要な props を渡す
  - GanttChart / SpiTrendChart カード / FeverChart カードの「全画面で見る」ボタン押下で `setGanttFull(true)` / `setChartFull('trend' | 'fever')` を呼ぶ
  - モーダル開閉ともに動作することをブラウザで確認 *(observable: ボタンクリックでモーダルが portal に出現し、Esc で閉じる)*
  - _Requirements: 6.7, 9.7, 10.1, 17.1, 17.2_
  - _Boundary: pages/WorkbenchPage.tsx_
  - _Depends: 3.2, 4.1, 4.2, 4.3_

- [ ] 4.5 `App.tsx` から `/progress` ルートを削除
  - `client/src/App.tsx` の `<Routes>` から `/progress` を削除
  - 旧 `/progress` URL は 404（または `/` リダイレクト）になる *(observable: ブラウザで `/progress` にアクセスすると React Router の NotFound か `/` に飛ぶ)*
  - _Requirements: 1.5, 16.2_
  - _Boundary: App.tsx_
  - _Depends: 4.3, 4.4_

## Phase 5: 旧画面の削除

- [ ] 5. 旧ページファイルを削除
- [ ] 5.1 `pages/DashboardPage.tsx` を削除
  - 削除前に WorkbenchPage が `/` で動作確認済みであること
  - 削除後 `npm run build` が成功する *(observable: tsc + vite build 成功、未参照ファイル削除によるエラーゼロ)*
  - _Requirements: 16.3, 16.6_
  - _Boundary: pages/DashboardPage.tsx_
  - _Depends: 4.4_

- [ ] 5.2 `pages/ProgressInputPage.tsx` を削除
  - 削除前に `/progress` ルートが既に App.tsx から削除済みで、`GanttFullscreen` 経由の進捗入力が動作していること
  - _Requirements: 16.4, 16.6_
  - _Boundary: pages/ProgressInputPage.tsx_
  - _Depends: 4.5_

## Phase 6: 旧コンポーネントの削除

- [ ] 6. 旧 components/ 直下のレガシーファイルを削除
- [ ] 6.1 旧コンポーネント 6 ファイルを削除 (P)
  - `client/src/components/AlertBanner.tsx`
  - `client/src/components/AssigneeTable.tsx`
  - `client/src/components/FeverChart.tsx`
  - `client/src/components/GanttChart.tsx`
  - `client/src/components/ProjectSummaryCards.tsx`
  - `client/src/components/SpiTrendChart.tsx`
  - 各ファイル削除前に全インポート箇所が新コンポーネントに置き換わっていることを `grep` で確認
  - 削除後 `npm run build` が成功する
  - _Requirements: 16.5, 16.6_
  - _Boundary: components/_
  - _Depends: 5.1, 5.2_

## Phase 7: 依存削除

- [ ] 7. recharts 依存をクリーンアップ
- [ ] 7.1 `package.json` から recharts を削除
  - `client/package.json` の `dependencies` から `recharts` を削除
  - `npm install` を実行して `package-lock.json` を更新
  - `npm run build` が成功する *(observable: ビルドが成功し、bundle サイズが減少する)*
  - _Requirements: 14.4_
  - _Boundary: package.json, package-lock.json_
  - _Depends: 6.1_

## Phase 8: E2E テスト追加

- [ ] 8. Playwright E2E テストを追加
- [ ] 8.1 `e2e/workbench.spec.ts` を追加（8 シナリオ）
  - シナリオ 1: TopBar プロジェクトピッカーで切替 → SummaryStrip のプロジェクト名が変わる
  - シナリオ 2: 基準日変更 → SummaryStrip の SPI/CPI 数値が変わる
  - シナリオ 3: 前日比トグル ON → SummaryStat 値が delta 表示になる
  - シナリオ 4: GanttChart 行クリック → 行ハイライト + Inspector が Task モードで更新
  - シナリオ 5: 「全画面で見る」(Gantt) クリック → GanttFullscreen 表示、Esc で閉じる
  - シナリオ 6: GanttFullscreen 内で葉タスク行クリック → ProgressInputPanel 右側展開、Esc でパネルのみ閉じる
  - シナリオ 7: ProgressInputPanel で進捗率変更 → 保存 → モーダル背景の Gantt 行の進捗バーが更新される
  - シナリオ 8: SPI トレンドの「全画面で見る」クリック → ChartFullscreen 表示、背景クリックで閉じる
  - 既存の Playwright 設定 (`evm-studio/playwright.config.ts`) を利用
  - シード DB は `npm run seed` で投入し、`projectId=1`, `baseDate='2026-05-13'` の状態を前提とする
  - `npm run test:e2e` で 8 シナリオすべてグリーン *(observable: Playwright report に 8/8 passed)*
  - _Requirements: 20.3_
  - _Boundary: e2e/workbench.spec.ts_
  - _Depends: 7.1_

- [ ]* 8.2 視覚的なモックアップ準拠を手動で確認
  - `(projectId=1, baseDate='2026-05-13')` で `localhost:5173` を開き、`mockup/evm-app.html` と並べて比較
  - 色・フォント・余白・トランジションの差異を目視で確認し、必要なら微調整
  - _Requirements: 20.4_
  - _Boundary: pages/WorkbenchPage.tsx_
  - _Depends: 8.1_

## 注釈

- すべての P 印のサブタスクは Phase 内で並列実行可能。Phase 間は順序依存があるため必ず順次進める
- 各 Phase の終わりで `npm run build` が成功することを必ず確認する（要件 16.6）
- `progress-tracking` spec の `ProgressInputPanel.tsx` が未実装の場合、Phase 4.3 で一時的なスタブを置き、`progress-tracking` 完成後に置き換える運用も可（ただし最終リリース時には正式版に差し替えること）
- 本計画は 8 Phase / 21 タスクで構成される。一部 (P) 印のタスクは並列実行で実装時間を短縮できる
