# Brief: dashboard

## Problem

PM がプロジェクトの遅延兆候を即時検知し、対象タスクへドリルダウンして進捗を反映するまでに、現状実装は `/`, `/dashboard`, `/progress` の3画面遷移を必要としている。モックアップ `mockup/variation-a.jsx` の単一ワークベンチ UI（プロジェクトレール / Inspector / GanttFullscreen / 前日比トグル）と乖離が大きく、毎日の状況確認・進捗反映のフリクションが高い。

## Current State

- `DashboardPage` は単独画面で、プロジェクト選択 → 基準日入力 → 計算実行 → 縦並びカード表示の構成
- `ProgressInputPage` は別画面・別ルート
- `ProjectRail` / `Inspector` / `GanttFullscreen` / `ChartFullscreen` / 前日比トグル / `SummaryStrip` / `AlertStrip` が **未実装**
- 既存コンポーネント: AlertBanner / ProjectSummaryCards / SpiTrendChart / FeverChart / AssigneeTable / GanttChart は流用可能だが、ワークベンチへの再配置が必要

## Desired Outcome

- 単一ワークベンチ画面 `WorkbenchPage` で全機能が完結する
- 左レールでプロジェクト・メンバーを常時切替可能
- 中央のサマリストリップで SPI/CPI/BAC/EV/AC/VAC を前日比トグル付きで表示
- ガント全画面モーダルから直接タスクの進捗入力が可能（スナップショット日付指定・本日のAC追加・計画線比較・メモ）
- Inspector が Task / Member / Team の3モードで切替可能
- モックアップと視覚的にほぼ一致する（フォント・色・余白・トランジション）

## Approach

`mockup/variation-a.jsx` を TSX に移植する形で実装する。

- **トークン化**: `client/src/tokens/evm-tokens.ts` にモックアップ `EVM` オブジェクトの色・フォント定数を移す
- **コンポーネント分割**: モックアップのセクション境界をそのままコンポーネント境界とする（TopBar / ProjectRail / SummaryStrip / AlertStrip / GanttChart / ChartCard / Inspector / GanttFullscreen / ChartFullscreen / ProgressInputPanel）
- **状態**: 選択プロジェクト ID / 基準日 / 選択タスク ID / Inspector モード / メンバー ID / compareMode / filter / ganttFull / chartFull を WorkbenchPage 内 useState で保持（軽量グローバル化は段階的に）
- **データフェッチ**: 既存 tRPC `evm.calculate` を拡張し、`summary / prevDay / assignees / alerts / spiTrend / fever / tasks` を一括返却する形に集約。TanStack Query でキャッシュ
- **チャート**: SVG 直書き（Recharts 撤去）。`SpiTrendChart` / `FeverChart` / `Sparkline` / `Gantt` をモックアップから移植

## Scope

- **In**:
  - WorkbenchPage（単一ルート `/`）
  - TopBar（ブランド / プロジェクトピッカー / 基準日ピッカー / 通知ベル / アバター）
  - ProjectRail（Projects + Members）
  - SummaryStrip（前日比トグル付き）
  - AlertStrip（critical / warning / HEALTHY）
  - GanttChart（中央埋め込み版） + GanttFullscreen（モーダル + 検索 + 担当者 + 状態フィルター + 進捗入力サブパネル）
  - SpiTrendChart + FeverChart + ChartFullscreen
  - Inspector（Task / Member / Team モード）
  - Esc キーでモーダル閉じる
  - レスポンシブは横幅 1280px 以上を前提（モックアップに準拠）
- **Out**:
  - 朝報レポート出力（将来）
  - 認証・認可
  - WBS 編集 UI（インポートのみ対応）

## Boundary Candidates

- **shell**: TopBar / ProjectRail / Inspector — 永続表示の枠
- **summary**: SummaryStrip / AlertStrip — 上部の数値帯
- **gantt**: GanttChart / GanttFullscreen / ProgressInputPanel — タスク表示と進捗入力
- **charts**: SpiTrendChart / FeverChart / Sparkline / ChartFullscreen
- **inspector**: InspectorTaskMode / InspectorMemberMode / InspectorTeamMode

## Out of Boundary

- 前日比の計算ロジックそのもの（→ `evm-engine` spec）
- スナップショットの永続化・取得（→ `progress-tracking` spec）
- プロジェクト / メンバー / タスクの永続化（→ `core-data-model` spec）

## Upstream / Downstream

- **Upstream**:
  - `evm-engine`: `evm.calculate` が `summary / prevDay / assignees / alerts / spiTrend / fever / tasks` を返す前提
  - `progress-tracking`: `progress.record(input)` に `snapshotDate / progressPct / acDays / note` を渡せる前提
  - `core-data-model`: `Project.status` / `Member.role` / `Task.assignee` が取得できる前提
- **Downstream**:
  - 将来の朝報エクスポート機能はワークベンチからトリガーする予定

## Existing Spec Touchpoints

- **Extends**: 既存の dashboard spec を全面書き直し
- **Adjacent**: progress-tracking（進捗入力モーダルの実装で密結合）, evm-engine（前日比 API で密結合）

## Constraints

- モックアップ `mockup/variation-a.jsx` の見た目とインタラクションを正典とする。設計判断に迷ったらモックアップに従う
- チャートは SVG 直書き（Recharts 撤去）
- フォントは Google Fonts から CDN ロード（Cinzel / Source Serif 4 / JetBrains Mono / Inter）
- モーダルは `createPortal` で body 直下にレンダリングし、Esc で閉じる
- 既存 client コードは段階的に置き換える（突然削除しない）
