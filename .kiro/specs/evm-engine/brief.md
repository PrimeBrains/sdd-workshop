# Brief: evm-engine

## Problem
PV / EV / AC / SPI / CPI / EAC などの EVM メトリクスを正確に算出するエンジンが存在しない。CCPM バッファ消費率の計算とクリティカルパス特定も未実装。これらは仕様化なしに実装すると計算の境界条件（PV=0、稼働率考慮、休日除外等）でバグが発生しやすい。

## Current State
core-data-model によりデータは DB に格納されているが、EVM 計算を担うサービス層が存在しない。

## Desired Outcome
- 全 EVM メトリクス（PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI）を純粋関数として実装
- 日次 PV 配賦（稼働率 × 休日考慮）が正確に動作する
- クリティカルパスをタスク依存グラフのトポロジカルソートで算出できる
- CCPM フィーバーチャート用のバッファ消費率が算出できる
- 全計算関数が単体テストで検証済みである

## Approach
`server/src/services/evm-engine.ts` に副作用なしの純粋関数群を実装する。DB アクセスは持たず、引数としてスナップショットデータを受け取る設計にする。

## Scope
- **In**: PV/EV/AC/SPI/CPI/EAC/VAC/ETC/TCPI 計算、日次 PV 配賦、クリティカルパス、バッファ消費率、アラート判定
- **Out**: DB アクセス、UI 表示、tRPC ルーター、レポートフォーマット

## Boundary Candidates
- `server/src/services/evm-engine.ts` — 全 EVM 計算関数
- `server/src/services/critical-path.ts` — クリティカルパス算出
- `server/src/services/evm-engine.test.ts` — 境界値・エラーケースの単体テスト

## Out of Boundary
- 進捗データの永続化（progress-tracking が担う）
- グラフ描画・アラート表示（dashboard が担う）

## Upstream / Downstream
- **Upstream**: core-data-model（Task / Member / Holiday エンティティの型）
- **Downstream**: dashboard（SPI トレンド・アラート表示）、reporting（朝報データ生成）
