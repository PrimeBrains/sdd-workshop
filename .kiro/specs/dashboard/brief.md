# Brief: dashboard

## Problem
EVM メトリクス（SPI/CPI トレンド、フィーバーチャート、担当者別進捗）を視覚的に確認できる画面がない。数値だけでは傾向把握が困難で、アラートの見落としリスクもある。

## Current State
evm-engine が計算関数を提供しており progress-tracking が進捗データを保持しているが、これらを統合して表示する UI コンポーネントが存在しない。

## Desired Outcome
- SPI/CPI のトレンドチャートが時系列で表示される
- CCPM フィーバーチャート（Green/Yellow/Red ゾーン）が確認できる
- プロジェクト全体・担当者別の EVM サマリーが表示される
- SPI < 0.8（critical）/ < 0.9（warning）のアラートバナーが表示される
- データはリアルタイムに近い形で反映される（TanStack Query のキャッシュ活用）

## Approach
tRPC エンドポイント（`evm.calculate`）を呼び出し、TanStack Query でキャッシュ管理する。チャートは recharts または軽量な SVG 手書きで実装。アラートは SPI 閾値判定結果をバナーとして表示。

## Scope
- **In**: SPI/CPI トレンドチャート、フィーバーチャート、担当者別 EVM テーブル、アラートバナー、プロジェクト選択
- **Out**: EVM 計算ロジック（evm-engine が担う）、進捗入力（progress-tracking が担う）、レポート出力（reporting が担う）

## Boundary Candidates
- `client/src/pages/DashboardPage.tsx` — メインダッシュボード
- `client/src/components/SpiTrendChart.tsx` — SPI/CPI トレンドチャート
- `client/src/components/FeverChart.tsx` — CCPM フィーバーチャート
- `client/src/components/AlertBanner.tsx` — アラート表示
- `server/src/api/evm.ts` — evm.calculate tRPC ルーター（dashboard 向け集約エンドポイント）

## Out of Boundary
- EVM メトリクスの計算ロジック（evm-engine が担う）
- 進捗データの永続化（progress-tracking が担う）

## Upstream / Downstream
- **Upstream**: evm-engine（計算関数）、progress-tracking（スナップショットデータ）
- **Downstream**: なし（最終表示層）
