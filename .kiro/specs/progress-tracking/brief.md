# Brief: progress-tracking

## Problem
タスクの実績工数・完了率を日次で記録する手段がない。EVM 計算に必要な EV（Earned Value）は完了率から算出されるため、時系列での進捗スナップショットが蓄積できなければ SPI/CPI トレンドが追跡できない。

## Current State
core-data-model によりタスク・メンバーは DB に格納されているが、進捗記録（実績工数・完了率）の入力エンドポイントもスナップショット管理の仕組みも存在しない。

## Desired Outcome
- 担当者・日付・タスク単位で実績工数と完了率を記録できる
- 日次スナップショットとして履歴が蓄積される（過去データを上書きしない）
- 最新スナップショットを取得して EVM エンジンに渡せる
- 入力 UI（tRPC クライアント）からワンアクションで記録できる

## Approach
`ProgressSnapshot` エンティティを新設し、(task_id, date) をキーとして実績を積み上げる。tRPC ルーターで記録・取得エンドポイントを提供する。UI は最小限のフォームで日次入力を可能にする。

## Scope
- **In**: ProgressSnapshot の CRUD（tRPC）、日次スナップショット取得、最新スナップショット一括取得
- **Out**: EVM 計算（evm-engine が担う）、グラフ描画（dashboard が担う）、レポート生成（reporting が担う）

## Boundary Candidates
- `server/src/db/schema.ts` — progress_snapshots テーブル追加
- `server/src/api/progress.ts` — tRPC ルーター（record / getByDate / getLatest）
- `client/src/pages/ProgressInputPage.tsx` — 日次入力フォーム

## Out of Boundary
- EVM メトリクスの計算（evm-engine が担う）
- 進捗グラフの描画（dashboard が担う）

## Upstream / Downstream
- **Upstream**: core-data-model（Task / Member エンティティ）
- **Downstream**: evm-engine（スナップショットを引数として受け取る）、dashboard（表示用データ取得）、reporting（レポート生成に使用）
