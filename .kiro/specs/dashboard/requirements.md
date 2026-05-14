# 要件定義書: dashboard

## Introduction

EVM Studio のダッシュボード機能は、プロジェクト管理者・担当者が EVM メトリクスを一画面で視覚的に把握できる可視化レイヤーである。
evm-engine が算出した SPI/CPI・CCPM バッファ・担当者別進捗を時系列チャート・フィーバーチャート・サマリーストリップ・アラートバナー・Inspector パネルとして表示する。
基準日とプロジェクトを選択するだけでリアルタイムに近い形でメトリクスが更新され、遅延タスクをアラートで見落とさないようにする。
Inspector パネル（Task / Member / Team の 3 モード）でタスク・担当者の詳細を右ペインで確認でき、前日比モードで前営業日との差分を全体的に確認できる。

## Boundary Context

- **In scope**: SPI/CPI トレンドチャート表示、CCPM フィーバーチャート表示、Inspector パネル（Task/Member/Team モード）、プロジェクトサマリーストリップ表示、アラートバナー表示、プロジェクト選択、基準日選択、前日比モード、GanttFullscreen、ChartFullscreen、`evm.calculate` tRPC エンドポイント、TanStack Query キャッシュ管理
- **Out of scope**: EVM メトリクスの計算ロジック（evm-engine が担う）、進捗データの永続化・入力（progress-tracking が担う）、認証・認可
- **Adjacent expectations**: evm-engine の `calculateEvmMetrics` / `calculateFeverChart` / `findCriticalPath` を呼び出してデータを集約する。progress-tracking の `progress.getLatest` で最新スナップショットを取得する。`evm.calculate` のレスポンスに `prevDay`（前営業日スナップショット集計）を含める。

## Requirements

### Requirement 1: プロジェクト・基準日の選択

**Objective:** プロジェクト管理者として、表示対象のプロジェクトと基準日を選択したい。そうすることで、任意の時点の EVM メトリクスを確認できる。

#### Acceptance Criteria

1. When the Dashboard page is rendered, the Dashboard shall display the project list as a dropdown.
   *ダッシュボードページが表示されると、プロジェクト一覧をドロップダウンとして表示する。*
2. When the user selects a project, the Dashboard shall load the EVM data for the selected project.
   *ユーザーがプロジェクトを選択すると、選択されたプロジェクトの EVM データを読み込む。*
3. The Dashboard shall display a base date picker with today's date as the default value.
   *基準日ピッカーを表示し、デフォルト値を今日の日付に設定する。*
4. When the user changes the base date, the Dashboard shall re-fetch EVM data using the new base date.
   *ユーザーが基準日を変更すると、新しい基準日で EVM データを再取得する。*
5. While data is being fetched, the Dashboard shall display a loading indicator.
   *データ取得中は、ローディングインジケータを表示する。*
6. If data fetching fails, the Dashboard shall display an error message.
   *データ取得に失敗した場合、エラーメッセージを表示する。*

---

### Requirement 2: アラートバナー

**Objective:** プロジェクト管理者として、SPI が閾値を下回るタスクをページ上部のバナーで即座に確認したい。そうすることで、遅延タスクの見落としを防げる。

#### Acceptance Criteria

1. When there are tasks with SPI < 0.8, the Dashboard shall display a red (critical) alert banner at the top of the page.
   *SPI < 0.8 のタスクが存在する場合、赤色（critical）のアラートバナーをページ上部に表示する。*
2. When there are tasks with 0.8 ≤ SPI < 0.9, the Dashboard shall display a yellow (warning) alert banner at the top of the page.
   *0.8 ≤ SPI < 0.9 のタスクが存在する場合、黄色（warning）のアラートバナーをページ上部に表示する。*
3. The Dashboard shall display the task name, assignee name, and SPI value for each entry in the alert banner.
   *アラートバナーにタスク名・担当者名・SPI 値を一覧表示する。*
4. When no critical or warning alerts exist, the Dashboard shall display a green "HEALTHY" status banner in place of the alert banner.
   *critical/warning アラートが存在しない場合、アラートバナーの代わりに緑色の "HEALTHY" バナーを表示する。*
5. Where a task has PV = 0 and SPI cannot be calculated, the Dashboard shall exclude that task from alert evaluation and treat it as grey (N/A).
   *PV = 0 のタスクは SPI が算出不能であるため、アラート評価から除外しグレー（N/A）として扱う。*
6. Each alert entry in the banner shall be a clickable button; when clicked, the Dashboard shall select the corresponding task in the Inspector panel and switch the Inspector to Task mode.
   *アラートバナーの各エントリはクリック可能なボタンとする。クリックすると Inspector パネルで該当タスクを選択し、Inspector を Task モードに切り替える。*

---

### Requirement 3: プロジェクトサマリーストリップ

**Objective:** プロジェクト管理者として、プロジェクト全体の EVM 指標と前週比をページ上部のストリップで確認したい。そうすることで、プロジェクト全体の健全性を把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a summary strip with SPI, CPI (each with "vs先週 ±N.NN" sub-label), BAC, EV (with PV sub-label), AC (with 残ETC sub-label), and VAC (with EAC sub-label) as numeric stat cells.
   *サマリーストリップに SPI・CPI（各「vs先週 ±N.NN」サブラベル付き）・BAC・EV（PV サブラベル）・AC（残 ETC サブラベル）・VAC（EAC サブラベル）を数値セルとして表示する。*
2. When overall SPI < 0.8, the Dashboard shall highlight the SPI stat in red.
   *全体 SPI < 0.8 の場合、SPI セルを赤色で強調表示する。*
3. When 0.8 ≤ overall SPI < 0.9, the Dashboard shall highlight the SPI stat in yellow.
   *0.8 ≤ 全体 SPI < 0.9 の場合、SPI セルを黄色で強調表示する。*
4. When overall SPI ≥ 0.9, the Dashboard shall display the SPI stat in the brand color (on-track).
   *全体 SPI ≥ 0.9 の場合、SPI セルをブランドカラー（正常）で表示する。*
5. If PV = 0 and SPI cannot be calculated, the Dashboard shall display "N/A" for the SPI and CPI values.
   *PV = 0 で SPI が算出不能の場合、SPI/CPI の値を "N/A" と表示する。*

---

### Requirement 4: SPI/CPI トレンドチャート

**Objective:** プロジェクト管理者として、SPI と CPI の時系列推移を折れ線グラフで確認したい。そうすることで、効率の改善・悪化トレンドを視覚的に把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a line chart with snapshot_date on the horizontal axis and SPI/CPI values on the vertical axis.
   *横軸を snapshot_date（日付）・縦軸を SPI/CPI 値とする折れ線チャートを表示する。*
2. The Dashboard shall render SPI and CPI as separate lines in distinct colors overlaid on the same chart.
   *SPI と CPI をそれぞれ別色の折れ線で重ねて表示する。*
3. The Dashboard shall display a reference line at SPI = 1.0 on the chart.
   *チャート上に SPI = 1.0 を示す基準線を表示する。*
4. When a data point has SPI or CPI of null (PV = 0), the Dashboard shall exclude that data point from the chart.
   *SPI または CPI が null の時点（PV = 0）がある場合、その時点をチャートから除外する。*
5. The Dashboard shall display a tooltip showing the snapshot date, SPI, and CPI values when the user hovers over a data point.
   *各データポイントにホバーした際にスナップショット日・SPI・CPI の値をツールチップで表示する。*

---

### Requirement 5: CCPM フィーバーチャート

**Objective:** プロジェクト管理者として、クリティカルチェーンのバッファ消費状況を CCPM フィーバーチャートで確認したい。そうすることで、プロジェクトの危険度を直感的に把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a scatter plot with critical chain completion ratio (0–1) on the horizontal axis and buffer consumption ratio (0–1) on the vertical axis.
   *横軸をクリティカルチェーン完了率（0〜1）・縦軸をバッファ消費率（0〜1）とする散布図を表示する。*
2. The Dashboard shall render three background zones in Green, Yellow, and Red (Green: consumption ratio < completion ratio × 0.67; Yellow: completion ratio × 0.67 ≤ consumption ratio < completion ratio × 1.0; Red: consumption ratio ≥ completion ratio × 1.0).
   *Green/Yellow/Red の 3 ゾーンを背景色として図示する（Green: 消費率 < 完了率 × 0.67、Yellow: 完了率 × 0.67 ≤ 消費率 < 完了率 × 1.0、Red: 消費率 ≥ 完了率 × 1.0）。*
3. The Dashboard shall display a data point representing the current project state.
   *現在のプロジェクト状態を示すデータポイント（プロット）を表示する。*
4. The Dashboard shall color the data point according to the zone it falls in (Green, Yellow, or Red).
   *データポイントのゾーンに応じた色（Green/Yellow/Red）でプロットを着色する。*
5. If no buffer task exists, the Dashboard shall hide or disable the fever chart and display "No buffer data".
   *バッファタスクが存在しない場合、フィーバーチャートを "バッファデータなし" として非表示または無効化する。*

---

### Requirement 6: 左レール — メンバーセクション

**Objective:** プロジェクト管理者として、左レールからメンバーを選択して Inspector で詳細を確認したい。そうすることで、誰がどれだけ遅延しているかを素早く把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a Members section at the bottom of the left rail, listing each project member with their name, role, and SPI value.
   *左レール下部にメンバーセクションを表示し、各メンバーの名前・役割・SPI 値を一覧表示する。*
2. The Dashboard shall color-code each member's SPI value using the same thresholds as the alert system (< 0.8: red, 0.8–0.9: yellow, ≥ 0.9: on-track color).
   *各メンバーの SPI 値をアラートと同じ閾値（< 0.8: 赤、0.8–0.9: 黄、≥ 0.9: 正常色）で色分けする。*
3. When a member row is clicked, the Dashboard shall switch the Inspector panel to Member mode for that member.
   *メンバー行をクリックすると、Inspector パネルを当該メンバーの Member モードに切り替える。*
4. The Dashboard shall highlight the active member row (currently shown in Inspector) with a left-border accent.
   *現在 Inspector に表示中のメンバー行を左ボーダーアクセントでハイライトする。*

---

### Requirement 7: データキャッシュとパフォーマンス

**Objective:** プロジェクト管理者として、ダッシュボードデータが適切にキャッシュされ、不要な再取得を避けたい。そうすることで、快適に操作できる。

#### Acceptance Criteria

1. The Dashboard shall use TanStack Query to cache EVM data with a staleTime of 5 minutes.
   *TanStack Query を使用して EVM データをキャッシュし、staleTime を 5 分に設定する。*
2. When the user navigates back to the same project and base date within 5 minutes, the Dashboard shall return data from cache without making a new server request.
   *ユーザーが同一のプロジェクト・基準日に 5 分以内に戻った場合、キャッシュからデータを返しサーバーへの再リクエストを行わない。*
3. The Dashboard shall fetch data by calling the tRPC `evm.calculate` endpoint with projectId and baseDate as inputs.
   *tRPC `evm.calculate` エンドポイントを呼び出してデータを取得する（入力: projectId と baseDate）。*

---

### Requirement 8: tRPC エンドポイント（evm.calculate）

**Objective:** フロントエンドとして、プロジェクト ID と基準日を渡すだけで全 EVM データを一括取得したい。そうすることで、複数エンドポイントへの並列リクエストを避けられる。

#### Acceptance Criteria

1. The Dashboard shall implement the `evm.calculate` tRPC query procedure with `{ projectId: number, baseDate: string }` as input.
   *`evm.calculate` tRPC クエリプロシージャを実装し、`{ projectId: number, baseDate: string }` を入力とする。*
2. The Dashboard shall return `{ summary, tasks[], assignees[], alerts[], feverChart, spiTrend[] }` as the response from `evm.calculate`.
   *`evm.calculate` のレスポンスとして `{ summary, tasks[], assignees[], alerts[], feverChart, spiTrend[] }` を返す。*
3. If the projectId does not exist, the Dashboard shall return a `PROJ_NOT_FOUND` error.
   *projectId が存在しない場合、`PROJ_NOT_FOUND` エラーを返す。*
4. If the baseDate format is invalid, the Dashboard shall return a validation error.
   *baseDate のフォーマットが不正の場合、バリデーションエラーを返す。*
5. The Dashboard shall call evm-engine pure functions and fetch the latest snapshot from the DB in the server-side implementation of `evm.calculate`.
   *`evm.calculate` のサーバー実装で evm-engine の純粋関数を呼び出し、DB から最新スナップショットを取得して計算を実行する。*

---

### Requirement 9: レスポンシブレイアウト

**Objective:** プロジェクト管理者として、ダッシュボードがモバイル〜デスクトップの画面サイズで適切に表示されたい。そうすることで、様々なデバイスから確認できる。

#### Acceptance Criteria

1. The Dashboard shall implement a responsive layout using TailwindCSS 4.
   *TailwindCSS 4 を使用してレスポンシブレイアウトを実装する。*
2. The Dashboard shall arrange content in a grid layout with 2 or more columns on desktop (lg:).
   *デスクトップ（lg:）ではグリッドレイアウト（2 カラム以上）でコンテンツを配置する。*
3. The Dashboard shall switch to a single-column stacked layout on mobile (sm:).
   *モバイル（sm:）では 1 カラムのスタック表示に切り替える。*

---

### Requirement 10: ガントチャートビュー

**Objective:** プロジェクト管理者として、タスクの計画期間・進捗・スケジュール健全性をガントチャートで視覚的に確認したい。そうすることで、遅延タスクの位置と影響範囲を一目で把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a Gantt chart with task bars spanning from planned_start to planned_end on a horizontal timeline.
   *ガントチャートを表示し、各タスクバーは planned_start から planned_end の期間を横軸タイムライン上に描画する。*
2. The Dashboard shall fill each task bar proportionally to the task's progress_pct value to represent work completion.
   *各タスクバーを progress_pct の割合で塗りつぶし、作業完了率を視覚的に表現する。*
3. The Dashboard shall display a vertical line (thunder line) at the base date position on the Gantt chart timeline.
   *ガントチャートのタイムライン上に、基準日の位置に垂直の稲妻線（サンデーライン）を表示する。*
4. The Dashboard shall color-code each task bar based on its SPI value: red for SPI < 0.8, yellow for 0.8 ≤ SPI < 0.9, and blue otherwise (including N/A).
   *各タスクバーを SPI 値に基づいて色分けする（SPI < 0.8: 赤、0.8 ≤ SPI < 0.9: 黄、それ以外（N/A を含む）: 青）。*
5. The Dashboard shall list tasks in WBS sort_order with visual indentation proportional to the task's hierarchy level.
   *タスクを WBS の sort_order 順に並べ、階層レベルに応じたインデントを左ラベル列に適用する。*
6. The Dashboard shall display the task name and assignee name in the left label column of the Gantt chart.
   *ガントチャートの左ラベル列にタスク名と担当者名を表示する。*
7. Where a task has is_buffer = true, the Dashboard shall render that task bar in a visually distinct style (striped or grey) to distinguish it from regular tasks.
   *is_buffer = true のタスクは、通常タスクと区別するため縞模様またはグレーのスタイルでタスクバーを描画する。*
8. The GanttChart component shall accept optional write callbacks (onProgressUpdate, onTaskReschedule) that are undefined in read-only mode; when undefined, the chart shall render as read-only with no interactive edit controls.
   *GanttChart コンポーネントはオプションの書き込みコールバック（onProgressUpdate、onTaskReschedule）を受け取る。未定義の場合は読み取り専用モードで描画し、編集コントロールは表示しない。*
9. When a task row in the Gantt chart is clicked, the Dashboard shall set that task as the selected task and switch the Inspector panel to Task mode.
   *ガントチャートのタスク行がクリックされると、そのタスクを選択状態に設定し、Inspector パネルを Task モードに切り替える。*
10. The Dashboard shall display a "全画面で見る" button on the Gantt chart header that opens GanttFullscreen overlay.
    *ガントチャートヘッダーに「全画面で見る」ボタンを表示し、クリックで GanttFullscreen オーバーレイを開く。*

---

### Requirement 11: Inspector パネル（Task / Member / Team モード）

**Objective:** プロジェクト管理者として、選択中のタスクまたは担当者の詳細を右パネルで確認したい。そうすることで、アラート → タスク → 担当者と素早くドリルダウンできる。

#### Acceptance Criteria

1. The Dashboard shall display an Inspector panel on the right side with three mode tabs: Task, Member, and Team.
   *ダッシュボード右側に Inspector パネルを表示し、Task・Member・Team の 3 モードタブを設ける。*
2. In Task mode, the Inspector shall display the selected task's code, name, status pill (On Track / Watch / Delayed / N/A), progress percentage with progress bar, planned start/end dates, SPI/CPI/EV/PV/AC/BAC metrics in a 2-column grid, a SPI sparkline trend, and the assignee card.
   *Task モードでは、選択タスクのコード・名前・ステータス Pill・進捗%・進捗バー・計画開始/終了日・SPI/CPI/EV/PV/AC/BAC（2カラムグリッド）・SPI スパークライン・担当者カードを表示する。*
3. When the assignee card in Task mode is clicked, the Inspector shall switch to Member mode for that assignee.
   *Task モードの担当者カードをクリックすると、Inspector をその担当者の Member モードに切り替える。*
4. In Member mode, the Inspector shall display the member's avatar, name, role, aggregate EVM metrics (SPI/CPI/EV/BAC), a SPI sparkline trend, and the list of assigned tasks with their progress bars and SPI values.
   *Member モードでは、メンバーのアバター・名前・役割・集計 EVM 指標（SPI/CPI/EV/BAC）・SPI スパークライン・担当タスク一覧（進捗バー・SPI 値付き）を表示する。*
5. In Team mode, the Inspector shall display all project members as a scrollable list, each showing their avatar, name, role, and SPI value; clicking a row shall switch to Member mode for that member.
   *Team モードでは、プロジェクトの全メンバーをスクロール可能なリストで表示し（アバター・名前・役割・SPI 値）、行クリックで Member モードに切り替える。*
6. When Member mode is active but no member is selected, the Inspector shall display a prompt to select a member from the left rail or the assignee card.
   *Member モードがアクティブだが対象メンバーが未選択の場合、左レールまたは担当者カードからメンバーを選択するよう促すメッセージを表示する。*

---

### Requirement 12: 前日比モード（compareMode）

**Objective:** プロジェクト管理者として、前営業日との差分を全体的に確認したい。そうすることで、昨日からの変化を即座に把握できる。

#### Acceptance Criteria

1. The Dashboard shall display a "前日比" toggle in the summary strip; clicking it shall switch compareMode on/off.
   *サマリーストリップに「前日比」トグルを表示し、クリックで compareMode を ON/OFF 切り替える。*
2. When compareMode is ON, the summary strip shall replace current values with delta values (ΔSPI, ΔCPI, ΔEV, ΔPV, ΔAC, ΔVAC) with the current value shown as a sub-label.
   *compareMode ON 時、サマリーストリップの各指標をデルタ値（ΔSPI・ΔCPI・ΔEV・ΔPV・ΔAC・ΔVAC）に切り替え、現在値をサブラベルとして表示する。*
3. When compareMode is ON and the Inspector is in Task mode, the Inspector shall display ΔSPI, ΔCPI, ΔEV, ΔPV, ΔAC and a progress delta badge (e.g., "+5pp") alongside the task's current values.
   *compareMode ON かつ Inspector が Task モードの場合、Inspector に ΔSPI・ΔCPI・ΔEV・ΔPV・ΔAC および進捗デルタバッジ（例: "+5pp"）を表示する。*
4. When compareMode is ON and the Inspector is in Member mode, the Inspector shall display ΔSPI, ΔCPI, ΔEV, ΔAC for the selected member.
   *compareMode ON かつ Inspector が Member モードの場合、Inspector に選択メンバーの ΔSPI・ΔCPI・ΔEV・ΔAC を表示する。*
5. When compareMode is ON and the Inspector is in Team mode, the Inspector shall display ΔSPI, ΔCPI, ΔEV per member row instead of the current SPI value.
   *compareMode ON かつ Inspector が Team モードの場合、各メンバー行の SPI 値の代わりに ΔSPI・ΔCPI・ΔEV を表示する。*
6. The `evm.calculate` endpoint shall include `prevDay` data (previous business day snapshot aggregates for summary, assignees, and tasks) in its response to support compareMode.
   *`evm.calculate` エンドポイントは compareMode をサポートするため、前営業日スナップショット集計（summary・assignees・tasks）を `prevDay` として含めてレスポンスを返す。*

---

### Requirement 13: チャート全画面表示（ChartFullscreen）

**Objective:** プロジェクト管理者として、SPI/CPI トレンドチャートと CCPM フィーバーチャートを全画面で確認したい。そうすることで、詳細なトレンドを視認しやすくなる。

#### Acceptance Criteria

1. The Dashboard shall display a "全画面で見る" button on the SPI/CPI trend chart card header.
   *SPI/CPI トレンドチャートカードのヘッダーに「全画面で見る」ボタンを表示する。*
2. The Dashboard shall display a "全画面で見る" button on the CCPM fever chart card header.
   *CCPM フィーバーチャートカードのヘッダーに「全画面で見る」ボタンを表示する。*
3. When a "全画面で見る" button is clicked, the Dashboard shall open a ChartFullscreen overlay modal with the corresponding chart scaled to fill the available screen area.
   *「全画面で見る」ボタンがクリックされると、対応するチャートを画面領域に合わせてスケーリングした ChartFullscreen オーバーレイモーダルを開く。*
4. When the Escape key is pressed while ChartFullscreen is open, the Dashboard shall close the overlay.
   *ChartFullscreen が開いている状態で Escape キーが押されると、オーバーレイを閉じる。*
5. The ChartFullscreen modal shall display the project name, chart title, and snapshot count (for trend chart) or zone pill (for fever chart) in the modal header.
   *ChartFullscreen モーダルのヘッダーにプロジェクト名・チャートタイトル・スナップショット数（トレンドチャート）またはゾーン Pill（フィーバーチャート）を表示する。*
