# Brief: progress-tracking

## Problem

現状の進捗入力は独立画面 (`/progress`) で、リーフタスクの進捗率と実績工数を一括編集する形式。モックアップ `mockup/variation-a.jsx` の `GanttFullscreen` 内 `ProgressInputPanel` は、対象タスク単体に対して **スナップショット日付（過去日も可）/ 進捗率（計画線との差分表示付き）/ 本日のAC追加（MD・h単位切替）/ メモ** を細粒度に入力するモーダル UI で、現状実装と全く異なる。

## Current State

- `ProgressInputPage` がリーフタスクの一覧テーブルで進捗を編集
- tRPC `progress.record` は `taskId / snapshotDate / progressPct / acDays` を受け取る（メモなし）
- スナップショットの過去日付指定は可能だが、UI で「今日 / N日前」表示・警告色などのフィードバックがない
- AC の MD ↔ h 単位切替が未実装
- 「本日のAC追加」と「累積AC」の区別が UI に出ていない

## Desired Outcome

- 進捗入力は GanttFullscreen のサブパネルとして表示される
- 過去日付選択時に警告色（黄色）でフィードバックする
- 進捗率スライダー + 数値入力に「今日の計画 X%」マーカーを重ね、先行/遅延を即時表示
- 本日のAC追加と前回累積を区別して表示し、合計を算出
- AC は MD / h 単位を切り替え可能
- メモ欄（任意）を保存可能
- 保存時に ProgressSnapshot レコードが追加される（既存スナップショットの更新 or 新規）

## Approach

- スキーマ拡張: `progress_snapshots` テーブルに `note` (text, nullable) カラム追加、`ac_days` は既存
- API 拡張: `progress.record` の入力に `note` を追加。 `progress.getLatest(taskId)` で前回累積 AC を返す
- UI: `ProgressInputPanel` コンポーネントを `client/src/components/gantt/` に新設し、GanttFullscreen 内にスライドイン
- 計画線比較: クライアント側で `(snapshotOffset - task.start) / (task.end - task.start) * 100` を計算

## Scope

- **In**:
  - スナップショット保存 API（note 追加）
  - 前回累積 AC の取得 API
  - ProgressInputPanel コンポーネント
  - 過去日付指定 + 警告色フィードバック
  - 進捗率スライダー + 計画線マーカー
  - AC追加（MD / h トグル）
  - メモ入力
  - 既存 ProgressInputPage は削除（GanttFullscreen に統合）
- **Out**:
  - 進捗一括インポート（YAML / xlsm — 将来）
  - 進捗履歴のグラフ表示（→ dashboard）

## Boundary Candidates

- **snapshot-storage**: ProgressSnapshot の DB I/O
- **input-panel-ui**: ProgressInputPanel コンポーネント（クライアント）
- **planned-comparison**: 計画線との差分計算ロジック
- **unit-conversion**: MD ↔ h 単位変換

## Out of Boundary

- EVM 計算（前日比含む）（→ evm-engine）
- スナップショット履歴を時系列で表示する UI（→ dashboard / Inspector）
- WBS 構造（→ core-data-model）

## Upstream / Downstream

- **Upstream**:
  - `core-data-model`: Task / Project のスキーマ、リーフタスク判定
- **Downstream**:
  - `evm-engine`: ProgressSnapshot を読んで EVM を再計算
  - `dashboard`: GanttFullscreen 内 ProgressInputPanel をマウント

## Existing Spec Touchpoints

- **Extends**: 既存 progress-tracking spec を全面書き直し
- **Adjacent**: dashboard（UI のホスト先）, evm-engine（前日比計算で同じスナップショットを参照）

## Constraints

- `progress.record` は冪等：同じ `(taskId, snapshotDate)` への保存は upsert
- AC は DB 上は MD 単位で保存。h 表示は UI 側で `× 8` 換算
- 過去日付は許容するが、未来日付は弾く（baseDate 以下のみ）
- メモは 1000 文字以内
