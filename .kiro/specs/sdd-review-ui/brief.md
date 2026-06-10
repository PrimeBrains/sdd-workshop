# Brief: sdd-review-ui

## Problem

cc-sdd の承認フェーズで、レビュアーは requirements.md / design.md / tasks.md をエディタで直接読むしかなく可読性が低い。Req 番号と design セクション・タスクの対応関係を目視で突き合わせる必要があり、レビュー速度と品質が落ち、トレーサビリティの抜け（未カバー要件・リンク切れ）にも気づけない。

## Current State

- スペックの閲覧手段は md 直読みのみ。トレーサビリティ確認は完全に手作業
- validation レポート（ギャップ分析・設計検証・実装検証）は表示手段がない（validate-output 直接実装でファイル化される前提）

## Desired Outcome

- requirements / design / tasks が構造化ビューアで表示され、**元ファイルの情報が一切欠落しない**（パース失敗箇所は生 markdown フォールバック表示）
- **相互リンクナビゲーション**: Req 番号クリック → design の該当セクションへジャンプ、design → tasks、およびすべての逆方向。どこにいても出自へ戻れる
- サイドバイサイド表示（例: 左 requirements / 右 design）で対応箇所をハイライトし、突き合わせレビューができる
- トレーサビリティマトリクス: Req × Design × Task のカバレッジ一覧。未カバー要件・リンク切れ参照がハイライトされる
- validation-*.md（ギャップ分析等）の構造化表示
- ファイル変更時に SSE で自動更新され、**AI が生成中のスペックをブラウザでリアルタイムに閲覧できる**

## Approach

React 19 + Vite の SPA（sdd-dashboard クライアント内の画面群）。sdd-core の API から構造化データを取得し、TanStack Query でキャッシュ、SSE イベントで無効化して再取得。markdown 由来の構造化ノードは専用 UI コンポーネント（Requirement カード、受け入れ基準リスト、トレーサビリティチップ等）で描画する。

## Scope

- **In**: スペックドキュメントビューア（requirements / design / tasks / brief / research）、相互リンクナビゲーション、サイドバイサイド比較、トレーサビリティマトリクス、validation レポート表示
- **Out**: 承認・手戻りの操作 UI（sdd-workflow-ui がこの画面に統合する）、フロー俯瞰・ヘルプ・steering/スキル/ADR 閲覧（同）、パース処理・グラフ構築（sdd-core）

## Boundary Candidates

- ドキュメントレンダラ（構造化ノード → UI コンポーネント + 生 markdown フォールバック）
- リンクナビゲーション（アンカー解決・遷移履歴・パンくず）
- サイドバイサイド比較ビュー
- トレーサビリティマトリクス
- validation レポートビュー

## Out of Boundary

- 書込操作（承認ボタン等は workflow-ui が本画面に重ねる。本スペックは読み取り専用画面として完結する）
- トレーサビリティの解釈ロジック（core のグラフをそのまま描画する。独自解釈をしない）

## Upstream / Downstream

- **Upstream**: sdd-core（構造化 API・SSE・トレーサビリティグラフ）
- **Downstream**: sdd-workflow-ui（本レビュー画面へ承認操作を統合する）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: sdd-workflow-ui（同一 SPA。レイアウトシェル・ルーティングの分担を design で明確化すること）

## Constraints

- `sdd-dashboard/client/` 配下。React 19 + Vite + TailwindCSS、TypeScript strict、`any` 禁止
- `dangerouslySetInnerHTML` 禁止（生 markdown フォールバックも React 要素として安全にレンダリング）
- **情報無欠落原則が最優先要件**: 描画できない要素を黙って落とすことを禁止
- ローカル完結（外部 CDN・外部 API に依存しない）
