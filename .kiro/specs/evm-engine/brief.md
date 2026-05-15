# Brief: evm-engine

## Problem

現状の `evm.calculate` は基本メトリクス（PV/EV/AC/SPI/CPI/EAC）と一部のチャートデータを返すが、モックアップ `mockup/variation-a.jsx` が必要とする **前日比 (prevDay)**、**担当者別 EVM (assignees)**、**5プロジェクト分の差分データ** を一括返却できない。WorkbenchPage の SummaryStrip 前日比トグル / Inspector Team モード / プロジェクトレールの SPI バッジ が成立しない。

## Current State

- `services/evm-engine.ts` に `calculateEvmMetrics` / `calculateFeverChart` / `countWorkingDays` が存在
- tRPC `evm.calculate` は単一基準日の集計を返す
- assignees / alerts / spiTrend / fever / tasks までは返却可能（実装済）
- **prevDay (前日比) ロジックは未実装**
- 担当者別 EVM の集計（assignees の cpi / status）が一部欠落

## Desired Outcome

- `evm.calculate(projectId, baseDate)` が以下を一括返却する：
  - `summary`: { bac, pv, ev, ac, spi, cpi, eac, vac, etc, tcpi, spiDelta, cpiDelta }
  - `prevDay`: { summary, assignees, tasks } — 前営業日（または baseDate-1）の同等構造
  - `assignees`: 担当者別 EVM + status
  - `alerts`: SPI 閾値ベースのアラート
  - `spiTrend`: 過去 N スナップショットの SPI/CPI 推移
  - `fever`: { bufferConsumption, criticalChainCompletion, zone, trail }
  - `tasks`: WBS ツリー + 各タスクの SPI / progress / bac / assignee
  - `gantt`: { startISO, endISO, totalDays, baseDay, months }
- 純粋関数で構成し、Vitest で境界値テストを通すこと

## Approach

- `services/evm-engine.ts` に `calculatePrevDayDelta` を追加。前営業日のスナップショットを DB から取得し、現在値と差分を算出
- `assignees` 集計は `services/evm-assignees.ts` に分離し、レンジクエリで N+1 を避ける
- `evm.calculate` のレスポンス型を再定義し、クライアントから一括取得できるようにする
- 既存実装は `phase: implemented` 扱いだが、レスポンス拡張のため requirements / design / tasks を再生成する

## Scope

- **In**:
  - PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI 計算（既存）
  - 前日比 (prevDay) 計算 + 差分 (spiDelta / cpiDelta)
  - 担当者別 EVM (assignees) + status 判定
  - SPI/CPI 時系列 (spiTrend) 集計
  - CCPM フィーバーチャート計算（既存）+ trail（過去スナップショット）
  - `evm.calculate` レスポンスの統合
- **Out**:
  - WBS 編集（→ core-data-model）
  - 進捗入力・スナップショット保存（→ progress-tracking）
  - UI（→ dashboard）

## Boundary Candidates

- **core-evm**: PV/EV/AC/SPI/CPI/EAC など基本メトリクス
- **prev-day**: 前日比計算（独立した関数として切り出し）
- **assignee-agg**: 担当者別集計
- **fever**: CCPM 計算 + trail
- **trend**: spiTrend 集計

## Out of Boundary

- DB スキーマ定義（→ core-data-model）
- スナップショットの書き込み（→ progress-tracking）
- アラート UI 表示（→ dashboard）

## Upstream / Downstream

- **Upstream**:
  - `core-data-model`: Project / Task / Member / Holiday / TaskDependency のスキーマと CRUD
  - `progress-tracking`: ProgressSnapshot のレンジクエリ（過去日付分含む）
- **Downstream**:
  - `dashboard`: `evm.calculate` のレスポンスを丸ごと消費

## Existing Spec Touchpoints

- **Extends**: 既存 evm-engine spec を拡張書き直し
- **Adjacent**: progress-tracking（前日スナップショット取得で密結合）

## Constraints

- `services/evm-engine.ts` は純粋関数のみ。DB アクセスを持たない（DB I/O は呼び出し側）
- `any` 禁止、TypeScript strict
- 計算結果は決定論的（同じ入力なら同じ出力）
- ベンチマーク基準: 100 タスクのプロジェクトで `evm.calculate` が 200ms 以内
