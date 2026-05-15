# 要件定義書: dashboard

## Introduction

EVM Studio のフロントエンドを、モックアップ `mockup/variation-a.jsx` を正典とする「単一ワークベンチ画面」へ再構築する。これまでの 3 画面構成（`/` / `/dashboard` / `/progress`）を廃止し、`WorkbenchPage`（`/` 直下の唯一のページ）に TopBar・ProjectRail・SummaryStrip・AlertStrip・GanttChart・SpiTrendChart・FeverChart・Inspector（Task / Member / Team モード）と、`GanttFullscreen`（中に `ProgressInputPanel` を内包）/ `ChartFullscreen` の 2 モーダルを実装する。

プロジェクトマネージャー（PM）は基準日を切り替えながらワークベンチ内で前日比 SPI/CPI を即時確認し、ガント全画面モーダルから対象タスクをクリックして進捗入力サブパネルを右側に開き、画面遷移を伴わずに進捗反映までを完結できる。

データは tRPC `evm.calculate({ projectId, baseDate, options? })` の 1 リクエストで `summary` / `prevDay` / `assignees` / `alerts` / `spiTrend` / `fever` / `tasks` / `gantt` を一括取得し、`useEvm` フックから子コンポーネントへ top-down に流す。チャートはすべて SVG 直書きで実装し、Recharts への依存を廃止する。

## Boundary Context

- **In scope（本スペックで実装する画面・コンポーネント・状態）**:
  - 単一ルート `/` で動作する `WorkbenchPage`
  - `TopBar` / `ProjectRail` / `SummaryStrip`（前日比トグル付き）/ `AlertStrip` / `GanttChart`（中央埋め込み）/ `SpiTrendChart` / `FeverChart` / `Inspector`（Task / Member / Team モード）
  - `GanttFullscreen` モーダル（タスク検索 / 担当者フィルター / 状態フィルター / 進捗入力サブパネル）と `ChartFullscreen` モーダル
  - `ProgressInputPanel` を `GanttFullscreen` 内にホストする統合
  - デザイントークン定義 `client/src/tokens/evm-tokens.ts`（モックアップ `EVM` オブジェクトの完全移植）
  - 原子コンポーネント `components/atoms/{Card,Pill,Dot,Eyebrow,Avatar,BrandMark,FilterChip,Chevron}.tsx`
  - データフェッチフック `useEvm({ projectId, baseDate })`
  - 旧 `pages/DashboardPage.tsx` / `pages/ProgressInputPage.tsx` および既存 `components/{AlertBanner,AssigneeTable,FeverChart,GanttChart,ProjectSummaryCards,SpiTrendChart}.tsx` の削除・置換
  - ルーティング設定の更新（`/progress` ルート撤去）
  - Esc キーによるモーダル閉鎖と `createPortal` での body 直下レンダリング
- **Out of scope（本スペックでは実装しない）**:
  - `evm.calculate` レスポンスの計算ロジックそのもの（→ `evm-engine` spec）
  - スナップショット保存 API・`ProgressInputPanel` コンポーネント本体の実装（→ `progress-tracking` spec）
  - SQLite スキーマ・WBS YAML インポーター・シードデータ（→ `core-data-model` spec）
  - 朝報レポート出力・認証認可・xlsm インポート（将来対応）
  - 横幅 1280px 未満のレスポンシブ対応（モックアップは 1280px 以上を前提とする）
- **Adjacent expectations（隣接スペックへ求める前提）**:
  - `evm-engine`: tRPC `evm.calculate` が `{ summary, prevDay, assignees, alerts, spiTrend, fever, tasks, gantt }` の構造で 1 リクエスト集約レスポンスを返す
  - `progress-tracking`: `ProgressInputPanel` コンポーネント・`useProgressLatest` / `useRecordProgress` フックを `client/src/components/gantt/` と `client/src/hooks/` に提供する。props 契約は `progress-tracking/design.md` の `ProgressInputPanelProps` に従う
  - `core-data-model`: `Project.status` / `Project.code` / `Member.role` / `Member.initials` が `evm.calculate` レスポンスの `project` / `members` に含まれる

## Requirements

### Requirement 1: ワークベンチ画面の単一ページ構成

**Objective:** PM として、毎日の状況確認・進捗反映を画面遷移なしで完結したい。そのため、トップバー・左レール・中央・右 Inspector が同一画面に常時表示されるワークベンチ UI が必要である。

#### Acceptance Criteria

1. The WorkbenchPage shall render at the root path `/` as the only page-level route in the client application.
2. The WorkbenchPage shall render four persistent regions in a single viewport: TopBar (top), ProjectRail (left, 232px fixed width), Center (flexible main area), and Inspector (right, 380px fixed width).
3. When the WorkbenchPage mounts, the WorkbenchPage shall fetch `evm.calculate({ projectId, baseDate })` once and pass the response down to child components as props.
4. If the viewport width is less than 1280px, the WorkbenchPage shall still render the four regions in their fixed widths and allow horizontal scrolling without collapsing or rearranging the layout.
5. The WorkbenchPage shall remove any references to legacy routes `/dashboard` and `/progress` and shall not register them in the client router.
6. While the WorkbenchPage owns the page-level state machine (projectId, baseDate, selectedTaskId, inspectorMode, inspectorMemberId, compareMode, filter, ganttFull, chartFull, datePickerOpen, projectMenuOpen), the WorkbenchPage shall pass each piece of state down via props and never duplicate state across child components.

### Requirement 2: TopBar とプロジェクト・基準日ピッカー

**Objective:** PM として、ブランド表示・プロジェクト切替・基準日切替・通知・自分のアバターを画面上部から常時操作したい。

#### Acceptance Criteria

1. The TopBar shall render the Prime Brains brand mark, the "EVM STUDIO" wordmark, the active project picker, the base date picker, a notification bell, and the user avatar in a single horizontal row.
2. When the user clicks the project picker, the TopBar shall open a popover listing all projects with status dot, project name, project code, SPI value, and task count.
3. When the user selects a different project from the popover, the WorkbenchPage shall update `projectId`, close the popover, refetch `evm.calculate`, and reset the selected task to the first leaf task with progress between 0 and 100 (falling back to the first leaf task, then the first task) if the previous selection does not exist in the new project.
4. When the user clicks the base date picker, the TopBar shall open a popover containing a native `<input type="date">` and three preset chips ("今日" / "1週前" / "月初").
5. When the user changes the base date via the date input or a preset chip, the WorkbenchPage shall update `baseDate` and refetch `evm.calculate`.
6. While a popover is open, if the user clicks outside the popover, the TopBar shall close the popover without changing the underlying value.
7. The TopBar shall display the active project status as a colored Dot (active = green, paused = yellow, draft / archived = gray) next to the project name.
8. The TopBar shall render the avatar with the active user's initials (placeholder `"田美"` is acceptable until authentication is introduced).

### Requirement 3: ProjectRail（左レール）

**Objective:** PM として、全プロジェクトとメンバーを左レールから常時確認・切替したい。

#### Acceptance Criteria

1. The ProjectRail shall render a "Projects" section listing all projects returned by the API, each row showing the status Dot, project name, project code, task count, SPI value, and a warning count badge when `alerts.length > 0`.
2. While the active project is selected, the ProjectRail shall highlight that row with brand wash background and a 3px brand-deep left border.
3. When the user clicks a project row, the ProjectRail shall call the `onProjectChange(projectId)` callback supplied by the WorkbenchPage.
4. The ProjectRail shall render a "Members" section below the Projects section, listing the active project's members with avatar (initials), name, role, and SPI value.
5. When the user clicks a member row whose name matches an entry in `assignees`, the ProjectRail shall call `onMemberSelect(assigneeId)` and the WorkbenchPage shall switch the Inspector mode to "member" with `inspectorMemberId` set to that assignee.
6. While the Inspector is in "member" mode for a member, the ProjectRail shall highlight that member row with brand wash background and a 3px brand-deep left border.
7. The ProjectRail shall use SPI tone colors (`spi < 0.8` critical / `0.8 ≤ spi < 0.9` warning / `spi ≥ 0.9` normal / `spi == null` na) for the SPI value displayed in each row.

### Requirement 4: SummaryStrip と前日比トグル

**Objective:** PM として、プロジェクトの主要メトリクスを上部で一望し、前日比モードへワンクリックで切り替えたい。

#### Acceptance Criteria

1. The SummaryStrip shall render the project name, status label (`active` → `稼働中`, `paused` → `一時停止`, `draft` → `計画中`, `archived` → `アーカイブ`), planned period, remaining days, and overall progress percentage on the left.
2. While `compareMode === false`, the SummaryStrip shall render SPI, CPI, BAC, EV, AC, VAC as `SummaryStat` blocks using the current-day values from `summary`.
3. While `compareMode === true`, the SummaryStrip shall replace each SummaryStat value with the signed delta vs. previous business day (`spi` / `cpi` formatted as `▲0.02` / `▼0.03` / `±0.00`, `ev` / `pv` / `ac` / `vac` formatted as `+1.5 MD` / `−0.8 MD` / `±0.0 MD`) and show the current value in the sub-line.
4. While `compareMode === true`, the SummaryStrip shall color each delta with status tone (positive-good metrics like SPI / CPI / EV / VAC use green for positive deltas and red for negative; PV / AC are tone-neutral `na`).
5. The SummaryStrip shall render a toggle switch on the right end labeled "前日比"; when clicked, the toggle shall flip `compareMode` and shall visually indicate the active state by changing the track color to brand-deep and the thumb position.
6. If `summary.spiDelta` or `summary.cpiDelta` is 0 and `compareMode === false`, the SummaryStrip shall display the sub-line as "横ばい"; otherwise it shall display `vs先週 +0.02` style text.
7. The SummaryStrip shall format all MD values using the `fmtMD` helper (`(n / 1_000_000).toFixed(1) + ' MD'`) and signed MD values using `fmtSignedMD`.

### Requirement 5: AlertStrip

**Objective:** PM として、警告タスクの一覧を中央上部で即時把握し、該当タスクへワンクリックで遷移したい。

#### Acceptance Criteria

1. While `alerts.length > 0`, the AlertStrip shall render with warning soft background when only `warning` alerts exist and with critical soft background when at least one `critical` alert exists.
2. The AlertStrip shall display the alert count and a heading ("CRITICAL · 即時対応が必要なタスク" or "WARNING · 遅延の兆候") that matches the highest-severity alert level present.
3. The AlertStrip shall render each alert as a clickable chip containing the task name, assignee name, and SPI value.
4. When the user clicks an alert chip, the AlertStrip shall call `onJump(alert)` and the WorkbenchPage shall set `selectedTaskId = alert.taskId` and `inspectorMode = 'task'`.
5. While `alerts.length === 0`, the WorkbenchPage shall render a green "HEALTHY" banner in place of the AlertStrip with the message "遅延・警告は検出されていません".

### Requirement 6: 中央埋め込み版 GanttChart

**Objective:** PM として、中央メイン領域で WBS と進捗バーをミニ表示し、必要に応じて全画面表示できるようにしたい。

#### Acceptance Criteria

1. The GanttChart shall render the WBS hierarchy with one row per task, including a level-indented label, task code, task name, optional assignee, and a Gantt bar positioned by `task.start` / `task.end` offsets relative to project start.
2. The GanttChart shall draw a dashed vertical line at `range.baseDay` labeled "基準日" overlaying all rows.
3. The GanttChart shall overlay a "thunder line" SVG path connecting the current progress position of each incomplete leaf task (excluding `buffer` and `progress === 100` tasks); segments to the left of the base-date line shall be colored orange (delayed), segments to the right shall be colored green (ahead).
4. The GanttChart shall color the Gantt bar based on SPI tone (critical = red, warning = yellow, normal = blue, na = gray); buffer tasks shall render a diagonal-stripe pattern with a gray border.
5. When the user clicks a Gantt row, the GanttChart shall call `onTaskClick(task)` and the WorkbenchPage shall set `selectedTaskId = task.id` and `inspectorMode = 'task'`.
6. While `selectedTaskId === task.id`, the GanttChart shall highlight that row with brand wash background, a 3px brand-deep left bar, and a brand-deep outline.
7. The GanttChart shall render a "全画面で見る" button in its header; when clicked, the WorkbenchPage shall set `ganttFull = true` to open the GanttFullscreen modal.
8. The GanttChart shall render a legend strip showing the SPI tone colors and the buffer pattern.

### Requirement 7: GanttFullscreen モーダル

**Objective:** PM として、ガントを全画面で開いてタスクをフィルタ・検索し、行クリックで進捗を入力したい。

#### Acceptance Criteria

1. While `ganttFull === true`, the WorkbenchPage shall mount `GanttFullscreen` via `ReactDOM.createPortal` to `document.body` with a blurred dark backdrop covering the viewport.
2. The GanttFullscreen shall render an enlarged Gantt with WBS info columns (工数 / 予定期間 / 実績期間 / 進捗) on the left of the timeline.
3. The GanttFullscreen header shall include the brand mark, project name, base date, an assignee `<select>` dropdown (with each option showing assignee name and incomplete leaf-task count), a search input ("コード / タスク名"), filter chips (すべて / 遅延 / 完了以外 / 未着手 / 進行中 / 完了), and a close button.
4. When the user changes the assignee filter, the GanttFullscreen shall display tasks whose `assignee` matches the selection plus all ancestor rows; tasks whose `assignee` differs shall be hidden.
5. When the user types in the search input, the GanttFullscreen shall include tasks where `task.code.startsWith(query) || task.name.includes(query)` plus their ancestors.
6. When the user clicks a filter chip, the GanttFullscreen shall apply the corresponding status filter (`delayed` = spi != null && spi < 0.9; `notdone` = (leaf || buffer) && progress < 100; `todo` = (leaf || buffer) && progress === 0; `inprogress` = (leaf || buffer) && 0 < progress < 100; `done` = (leaf || buffer) && progress === 100; `all` = no filter) and each chip shall display the matching task count.
7. When the user clicks a leaf task (non-buffer) row in the GanttFullscreen, the GanttFullscreen shall open the ProgressInputPanel as a right-side panel (440px) for that task; if a buffer or summary task is clicked, only `selectedTaskId` shall change.
8. While the ProgressInputPanel is open, if the user presses the Esc key, the GanttFullscreen shall close only the ProgressInputPanel (not the modal); if the ProgressInputPanel is not open and the user presses Esc, the GanttFullscreen shall close the modal.
9. When the user clicks the close button or the backdrop, the GanttFullscreen shall close the modal and reset `ganttFull = false`.
10. While the GanttFullscreen is mounted, the GanttFullscreen shall set `document.body.style.overflow = 'hidden'` and restore the original value when unmounted.
11. If `displayTasks.length === 0` after filtering, the GanttFullscreen shall render the message "該当するタスクはありません" in the Gantt area instead of an empty grid.

### Requirement 8: ProgressInputPanel の GanttFullscreen への統合

**Objective:** PM として、ガント全画面から対象タスクの進捗をその場で記録したい。

#### Acceptance Criteria

1. When the user clicks a leaf task in the GanttFullscreen, the GanttFullscreen shall mount the `ProgressInputPanel` component (provided by the `progress-tracking` spec) on the right side of the modal body with width 440px.
2. The GanttFullscreen shall pass to the ProgressInputPanel the following props: `task` (mapped to `ProgressInputTask` including `id`, `code`, `name`, `assigneeName`, `plannedStart`, `plannedEnd`, `bac`, `spi`, `ancestors`), `projectStartISO`, `baseDate`, `snapshotDate`, `onSnapshotDateChange`, `onClose`, and `onSaved`.
3. The GanttFullscreen shall maintain `snapshotDate` state local to the modal (initial value = `baseDate`); when the user changes the snapshot date inside the ProgressInputPanel, the GanttFullscreen shall update its local state via the `onSnapshotDateChange` callback.
4. When `onSaved` is invoked by the ProgressInputPanel after a successful save, the GanttFullscreen shall invalidate the `evm.calculate` query cache via TanStack Query so the parent WorkbenchPage refetches up-to-date metrics.
5. When the user changes the assignee filter, the GanttFullscreen shall reset `progressTask = null` (close the panel) before applying the new filter.
6. The GanttFullscreen shall NOT re-implement the form internals of the ProgressInputPanel; it shall consume the component as-is from `client/src/components/gantt/ProgressInputPanel.tsx`.
7. 進捗入力パネルの `snapshotDate` は `baseDate` を超えてはならない。GanttFullscreen は ProgressInputPanel 内の `<input type="date">` に `max={baseDate}` を設定して未来日付の選択を防ぎ、サーバー側 (`progress-tracking`) も同等のバリデーションを実施する。

### Requirement 9: SpiTrendChart と FeverChart

**Objective:** PM として、SPI/CPI 推移と CCPM フィーバーチャートを中央下部で確認し、必要に応じて全画面拡大したい。

#### Acceptance Criteria

1. The SpiTrendChart shall render the SPI line (solid, brand-deep color) and the CPI line (dashed, ink2 color) over the snapshot dates returned in `spiTrend`, with y-axis ticks at 0.8 / 0.9 / 1.0 / 1.1 and the 1.0 tick drawn as a dashed reference line.
2. The SpiTrendChart shall show a hover tooltip with the snapshot date, SPI value, and CPI value when the user hovers over an invisible vertical hit area at each data point.
3. The SpiTrendChart shall annotate the latest data point with a small open circle and the text `SPI {value}` in brand-deep color when not currently hovered.
4. The FeverChart shall render a 4-zone triangular polygon background (green / yellow / red), the trail path (dashed) of past `(criticalChainCompletion, bufferConsumption)` points, and the current dot with a soft halo.
5. The FeverChart shall display the zone label (GREEN / YELLOW / RED) next to the current dot and as a `Pill` in the chart card header.
6. While `fever === null`, the chart card shall render the message "バッファタスク未定義 / CCPM プロジェクトのみ表示" instead of the chart.
7. Each chart card shall render a "全画面で見る" button in its header; when clicked, the WorkbenchPage shall set `chartFull = 'trend'` or `chartFull = 'fever'` to open the ChartFullscreen modal.

### Requirement 10: ChartFullscreen モーダル

**Objective:** PM として、SPI トレンドと CCPM フィーバーチャートを全画面で大きく観察したい。

#### Acceptance Criteria

1. While `chartFull !== null`, the WorkbenchPage shall mount `ChartFullscreen` via `ReactDOM.createPortal` to `document.body` with a blurred dark backdrop.
2. The ChartFullscreen shall render the chart specified by the `type` prop (`'trend'` or `'fever'`) at a size derived from the viewport (`availW = innerWidth − 160`, height ≈ availW × 0.38 for trend; square ≈ min(availW × 0.72, availH) for fever).
3. The ChartFullscreen header shall include the brand mark, eyebrow label, chart title, project name, snapshot count (trend) or zone Pill (fever), and a close button.
4. When the user presses the Esc key, the user clicks the close button, or the user clicks the backdrop, the ChartFullscreen shall close the modal and reset `chartFull = null`.
5. While the ChartFullscreen is mounted, the ChartFullscreen shall set `document.body.style.overflow = 'hidden'` and restore the original value when unmounted.

### Requirement 11: Inspector の 3 モード

**Objective:** PM として、選択中のタスク・メンバー・チーム全体を右ペインで切り替え閲覧したい。

#### Acceptance Criteria

1. The Inspector shall render a tab bar at the top with three tabs: "Task", "Member", "Team"; the active tab shall be underlined with a 2px brand-deep border and bold uppercase text.
2. While `inspectorMode === 'task'`, the Inspector shall render the selected task's code, name, status pill (On Track / Watch / Delayed / N/A based on SPI tone), progress percentage, planned start/end dates, SPI / CPI / EV / PV / AC / BAC metrics, a 6-point SPI sparkline, and the assignee card.
3. While `inspectorMode === 'task'` and `compareMode === true`, the Inspector shall replace each metric value with its signed delta vs `prevDay.tasks.find(t => t.id === selectedTaskId)` using the same delta-format helpers as the SummaryStrip; if no prev-day entry exists, the Inspector shall show "N/A".
4. When the user clicks the assignee card in Task mode, the Inspector shall switch to Member mode for that assignee.
5. While `inspectorMode === 'member'` and `inspectorMemberId !== null`, the Inspector shall render the member's avatar, name, role, aggregate SPI / CPI / EV / PV / BAC / AC metrics, a 6-point SPI sparkline, and the list of tasks assigned to that member.
6. While `inspectorMode === 'member'` and `inspectorMemberId === null`, the Inspector shall render an empty state with the message "左レールまたはタスクの担当者カードからメンバーを選択してください".
7. While `inspectorMode === 'team'`, the Inspector shall render a scrollable list of all assignees with avatar, name, role, and (when `compareMode === false`) the SPI value, or (when `compareMode === true`) the SPI / CPI / EV deltas vs `prevDay.assignees`.
8. When the user clicks an assignee row in Team mode, the Inspector shall switch to Member mode for that assignee.

### Requirement 12: WorkbenchPage 状態管理

**Objective:** 実装者として、画面全体の状態を一箇所で管理し、子コンポーネントが自身の状態を持たないことで、デバッグと一貫性確保を容易にしたい。

#### Acceptance Criteria

1. The WorkbenchPage shall maintain the following state slots via `useState`: `projectId`, `baseDate`, `selectedTaskId`, `inspectorMode` ('task' | 'member' | 'team'), `inspectorMemberId`, `compareMode`, `filter` ('all' | 'delayed' | 'notdone' | 'todo' | 'inprogress' | 'done'), `ganttFull`, `chartFull` (null | 'trend' | 'fever'), `datePickerOpen`, `projectMenuOpen`.
2. The WorkbenchPage shall initialize `projectId = 1`, `baseDate = TODAY_ISO`, `selectedTaskId = null`, `inspectorMode = 'task'`, `inspectorMemberId = null`, `compareMode = false`, `filter = 'all'`, `ganttFull = false`, `chartFull = null`, `datePickerOpen = false`, `projectMenuOpen = false`.
3. When `projectId` changes, the WorkbenchPage shall reset `selectedTaskId` to the first leaf task with `0 < progress < 100` (falling back to the first leaf, then the first task), reset `inspectorMode = 'task'`, and reset `inspectorMemberId = null`.
4. The WorkbenchPage shall pass each state slot down to child components only as the minimum required props (e.g., `ProjectRail` receives `projectId` and `onProjectChange`; `Inspector` receives `mode`, `memberId`, and the corresponding callbacks).
5. The WorkbenchPage shall NOT introduce a global state management library (Zustand / Redux); React `useState` and prop drilling are the only allowed state primitives within this spec.

### Requirement 13: データフェッチ層 (useEvm)

**Objective:** 実装者として、`evm.calculate` の呼び出しを単一フックに集約し、キャッシュ管理と再フェッチを統一したい。

#### Acceptance Criteria

1. The `useEvm({ projectId, baseDate })` hook shall call `trpc.evm.calculate.useQuery({ projectId, baseDate })` via TanStack Query and return `{ data, isLoading, error, refetch }`.
2. While `projectId === null` or `baseDate` is malformed, the `useEvm` hook shall skip the query (`enabled: false`) and return `data: undefined`.
3. The WorkbenchPage shall consume `useEvm` exactly once and pass `data` to all child components; child components shall NOT call `useEvm` independently.
4. When `projectId` or `baseDate` changes, the `useEvm` hook shall refetch automatically via the TanStack Query key.
5. When the ProgressInputPanel saves a snapshot successfully, the GanttFullscreen shall call `utils.evm.calculate.invalidate()` so the next render fetches updated metrics.
6. While `isLoading === true` and no previous data is cached, the WorkbenchPage shall render a minimal loading placeholder in the central area (the layout shell shall remain visible).
7. If `error !== undefined`, the WorkbenchPage shall render the error message in the central area without crashing the layout shell.

### Requirement 14: デザイントークンと SVG チャート

**Objective:** 実装者として、モックアップ `mockup/variation-a.jsx` の色・タイポグラフィ・余白と完全に一致する見た目を再現したい。

#### Acceptance Criteria

1. The client shall expose `client/src/tokens/evm-tokens.ts` exporting an `EVM` constant containing every color (`ink` / `ink2` / `ink3` / `ink4` / `rule` / `ruleSoft` / `paper` / `paperWarm` / `card` / `brand` / `brandDeep` / `brandSoft` / `brandWash` / `ok` / `okSoft` / `warn` / `warnSoft` / `crit` / `critSoft` / `na`) and font stack (`font` / `fontSerif` / `fontBrand` / `fontMono`) defined in `mockup/shared.jsx`.
2. The client shall load Google Fonts (Cinzel, Source Serif 4, JetBrains Mono, Inter) via a `<link>` tag in `index.html` so the brand wordmark and serif numerals render correctly.
3. The client shall implement SpiTrendChart, FeverChart, Sparkline, and the embedded Gantt as pure SVG components without depending on Recharts or any other chart library.
4. The client shall remove Recharts from `package.json` dependencies as part of this spec.
5. The client shall use inline `style={{}}` props referencing `EVM` token constants rather than Tailwind utility classes for the layout-sensitive parts of the workbench (TopBar, SummaryStrip, AlertStrip, Inspector, GanttFullscreen, ChartFullscreen), matching the mockup style; small atom-level styling (e.g., button hover) may use a CSS injection identical to the mockup's `<style>` block.

### Requirement 15: コンポーネント配置と命名

**Objective:** 実装者として、`mockup/variation-a.jsx` のセクション境界がそのままファイル境界となるように、レビュー可能な粒度で分割したい。

#### Acceptance Criteria

1. The client shall place `WorkbenchPage.tsx` under `client/src/pages/` as the only page file.
2. The client shall place shell components under `client/src/components/shell/` as `TopBar.tsx`, `ProjectRail.tsx`, `Inspector.tsx`.
3. The client shall place summary components under `client/src/components/summary/` as `SummaryStrip.tsx`, `SummaryStat.tsx`.
4. The client shall place alert components under `client/src/components/alerts/` as `AlertStrip.tsx`.
5. The client shall place gantt components under `client/src/components/gantt/` as `GanttChart.tsx`, `GanttFullscreen.tsx`; the file `ProgressInputPanel.tsx` is created by the `progress-tracking` spec but lives in this same directory.
6. The client shall place chart components under `client/src/components/charts/` as `SpiTrendChart.tsx`, `FeverChart.tsx`, `Sparkline.tsx`, `ChartFullscreen.tsx`.
7. The client shall place inspector mode components under `client/src/components/inspector/` as `InspectorTaskMode.tsx`, `InspectorMemberMode.tsx`, `InspectorTeamMode.tsx` (the `Inspector.tsx` shell coordinates tab switching and delegates rendering to these three).
8. The client shall place atomic components under `client/src/components/atoms/` as `Card.tsx`, `Pill.tsx`, `Dot.tsx`, `Eyebrow.tsx`, `Avatar.tsx`, `BrandMark.tsx`, `FilterChip.tsx`, `Chevron.tsx`.
9. The client shall use kebab-case for asset paths and PascalCase for component file names per `.kiro/steering/structure.md`.

### Requirement 16: 旧画面・旧コンポーネントの段階的削除

**Objective:** 実装者として、開発サーバーをビルド可能な状態に保ちながら旧 SPA 構成を撤去したい。

#### Acceptance Criteria

1. The client shall add `WorkbenchPage.tsx` and the new component files to the codebase before deleting any legacy files so the dev server can build at every commit boundary.
2. The client shall update `client/src/App.tsx` (or equivalent router root) to render `WorkbenchPage` at `/` and remove the routes `/` → `DashboardPage` and `/progress` → `ProgressInputPage` only after `WorkbenchPage` is wired and renders successfully.
3. The client shall delete `client/src/pages/DashboardPage.tsx` after `WorkbenchPage.tsx` is rendering at `/`.
4. The client shall delete `client/src/pages/ProgressInputPage.tsx` after `GanttFullscreen` mounts `ProgressInputPanel` successfully and the `/progress` route is removed.
5. The client shall delete the legacy components `client/src/components/AlertBanner.tsx`, `AssigneeTable.tsx`, `FeverChart.tsx`, `GanttChart.tsx`, `ProjectSummaryCards.tsx`, `SpiTrendChart.tsx` from the `client/src/components/` root after their replacements under the new sub-directories are in place and pass build.
6. Each step in this migration shall be expressible as a single commit that keeps `npm run build` and `npm start` working.

### Requirement 17: Esc キー処理と body スクロールロック

**Objective:** ユーザーとして、モーダル系 UI をキーボード操作で快適に閉じたい。

#### Acceptance Criteria

1. While `GanttFullscreen` is open, when the user presses the Esc key, the GanttFullscreen shall close only the ProgressInputPanel if it is open, otherwise close the modal itself.
2. While `ChartFullscreen` is open, when the user presses the Esc key, the ChartFullscreen shall close the modal.
3. While a popover (project picker, date picker) is open, when the user presses the Esc key, the WorkbenchPage shall close the popover.
4. While any of `GanttFullscreen` or `ChartFullscreen` is mounted, the modal shall set `document.body.style.overflow = 'hidden'` and shall restore the previous value when the modal unmounts.
5. The WorkbenchPage shall NOT trap focus inside modals via a focus-trap library in this spec; native browser behavior is acceptable (a focus-trap may be added in a future spec).

### Requirement 18: ロード状態・エラー状態・空データの扱い

**Objective:** ユーザーとして、データ取得中・エラー時・空プロジェクト時にも画面が崩れず原因が分かりたい。

#### Acceptance Criteria

1. While `useEvm` is loading and there is no previously cached data, the WorkbenchPage shall render the layout shell (TopBar / ProjectRail / Inspector with placeholders) and a centered loading indicator in the central area.
2. If `useEvm` returns an error, the WorkbenchPage shall render the error message in the central area as a `Card` with the eyebrow label "Error" and the message body; the TopBar and ProjectRail shall remain interactive so the user can switch projects.
3. While the active project has zero tasks, the GanttChart shall render the message "タスクがありません" in place of the row grid.
4. While the active project has zero assignees, the Inspector in Team mode shall render the message "担当者が割り当てられていません".
5. While the active project has zero alerts, the WorkbenchPage shall render the "HEALTHY" banner per Requirement 5.5 instead of the AlertStrip.

### Requirement 19: 表示パフォーマンスとレンダリング規模

**Objective:** PM として、100 タスク・60 日スナップショット規模のプロジェクトを操作中も体感的に遅延を感じたくない。

#### Acceptance Criteria

1. The WorkbenchPage shall render the initial view (after `evm.calculate` resolves) within 500ms on a developer-class machine for a project with 100 tasks, 60 days of snapshots, and 6 members.
2. The WorkbenchPage shall NOT trigger a refetch of `evm.calculate` when only `selectedTaskId`, `inspectorMode`, `inspectorMemberId`, `compareMode`, `filter`, `ganttFull`, `chartFull`, `datePickerOpen`, or `projectMenuOpen` changes; only `projectId` and `baseDate` changes trigger refetch.
3. The GanttChart and GanttFullscreen shall NOT virtualize rows in this spec; up to 200 tasks shall render in a single SVG / div tree without virtualization (virtualization may be considered in a future spec).
4. The SVG charts (`SpiTrendChart`, `FeverChart`, `Sparkline`) shall be memoized via `React.memo` when their `data` prop is referentially stable across renders, so changing `compareMode` or `inspectorMode` does not trigger chart re-renders.

### Requirement 20: テスト方針

**Objective:** 実装者として、リグレッションを最小コストで防ぎたい。

#### Acceptance Criteria

1. The dashboard spec shall NOT add new server-side unit tests; calculation correctness is covered by `evm-engine` tests.
2. The dashboard spec shall NOT add new React component tests per the project's testing policy (`.kiro/steering/tech.md`).
3. The dashboard spec shall add Playwright E2E tests under `e2e/` covering the following user flows: (a) project switching via TopBar updates SummaryStrip, (b) base date change refetches metrics, (c) compareMode toggle switches SummaryStrip into delta view, (d) GanttChart row click highlights row and updates Inspector, (e) "全画面で見る" opens GanttFullscreen, (f) leaf task click inside GanttFullscreen opens ProgressInputPanel, (g) saving a snapshot in ProgressInputPanel updates the Gantt progress without reload, (h) Esc key closes the modal layer-by-layer (panel → modal → none).
4. The dashboard spec shall verify that the visual snapshot of the WorkbenchPage at a fixed `(projectId=1, baseDate='2026-05-13')` state matches the mockup `mockup/variation-a.jsx` by manual comparison; no automated visual regression tool is required.
