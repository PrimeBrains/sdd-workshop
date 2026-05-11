# Brief: reporting

## Problem
毎朝の進捗報告（前日比差分・遅延タスク一覧・EVM サマリー）を手動で集計する作業が発生している。定型フォーマットの自動生成がなければ報告コストが高く、抜け漏れのリスクもある。

## Current State
evm-engine が EVM 計算を提供し progress-tracking が進捗履歴を保持しているが、これらを結合してレポートフォーマットに整形するサービス層が存在しない。

## Desired Outcome
- 指定日の朝報（前日比 SPI/CPI 変化・完了タスク・遅延タスク）が生成できる
- 遅延タスク一覧（SPI < 0.9 または完了予定日超過）が抽出できる
- プロジェクト全体の EVM サマリー（BAC/EAC/VAC/ETC）が出力できる
- レポートは JSON および Markdown 形式で取得できる

## Approach
`server/src/services/report-generator.ts` にレポート生成ロジックを実装する。evm-engine の純粋関数を組み合わせて差分計算・集約を行い、tRPC エンドポイント（`reports.morning`）で提供する。

## Scope
- **In**: 朝報生成（前日比差分付き）、遅延タスク一覧、EVM サマリー、JSON/Markdown 出力
- **Out**: EVM 計算ロジック（evm-engine が担う）、UI 表示（dashboard が担う）、メール送信・外部連携

## Boundary Candidates
- `server/src/services/report-generator.ts` — レポート生成ロジック
- `server/src/api/reports.ts` — tRPC ルーター（reports.morning / reports.delayed / reports.summary）
- `client/src/pages/ReportPage.tsx` — レポート表示・Markdown ダウンロード

## Out of Boundary
- EVM 計算ロジック（evm-engine が担う）
- 進捗データの永続化（progress-tracking が担う）
- メール送信・Slack 通知（スコープ外）

## Upstream / Downstream
- **Upstream**: evm-engine（計算関数）、progress-tracking（スナップショット履歴）
- **Downstream**: なし（最終出力層）
