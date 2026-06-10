# Brief: sdd-workflow-ui

## Problem

cc-sdd のフロー（Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装）は初見の開発者に分かりづらく、各スペックの現在地（承認状況・実装進捗）も spec.json を直接開かないと分からない。手戻り（実装中の追加要件でスペックへ戻る）は CLI とファイル手編集が必要で直感的でなく、下流フェーズへの影響範囲も見えない。steering・スキル・ADR といったプロジェクト知識も GUI から参照できない。

## Current State

- 進捗確認は /kiro-spec-status か spec.json 直読みのみ
- 承認は spec.json の手編集 or CLI。手戻りの定型操作は存在しない
- フロー解説のオンボーディング資料はリポジトリ内にない
- スキルは英語のみ（skill-ja 直接実装で SKILL.ja.md が併置される前提）。ADR は adr-notation で整備される前提

## Desired Outcome

- **パイプライン俯瞰ボード**: 全スペックのフェーズ進行と承認状態（spec.json の phase / approvals）がグラフィカルに一目で分かる
- **承認操作**: レビュー画面（sdd-review-ui）から「承認」を実行すると spec.json が更新され、次フェーズへ進める
- **手戻り操作**: 任意フェーズへの巻き戻しを、影響範囲（下流フェーズの再承認が必要になること）を可視化した確認ダイアログ付きで実行できる。実行後に次に打つべき CLI コマンド（例: /kiro-spec-requirements）が案内される
- **ヘルプ/オンボーディング**: 初見開発者向けに cc-sdd フロー全体を解説する画面
- **ナレッジ閲覧**: steering 一覧・スキル一覧（英/日タブ切替）・ADR 一覧の表示

## Approach

React 19 + Vite（sdd-dashboard クライアント内の画面群）。フロー可視化は @xyflow/react ^12.11（MIT、Pro 機能不使用）。承認・手戻りは sdd-core の書込 API を呼び、SSE 反映で全画面が即時更新される。

## Scope

- **In**: パイプライン俯瞰ボード、承認/手戻り操作 UI（影響範囲の可視化付き）、ヘルプ/オンボーディング、steering / スキル（英日）/ ADR ビューア
- **Out**: スペックドキュメントの精読・トレーサビリティ表示（sdd-review-ui）、ファイル書込の実処理・バリデーション（sdd-core）、AI 実行連携（Claude Code 起動。将来候補）

## Boundary Candidates

- パイプライン俯瞰ボード（フローグラフ + スペック現在地）
- 承認・手戻り操作フロー（確認ダイアログ・影響範囲表示・完了後の次アクション案内）
- ヘルプ/オンボーディングコンテンツ
- ナレッジビューア（steering / skills 英日切替 / ADR）

## Out of Boundary

- 手戻り時のスペック再生成そのもの（CLI スキルが担う。GUI は spec.json の状態変更と次アクション案内まで）
- 承認可否の判断ロジック（人間が判断する。GUI は操作手段を提供するのみ）

## Upstream / Downstream

- **Upstream**: sdd-core（API・書込・SSE）、sdd-review-ui（承認操作を統合する先のレビュー画面）
- **Downstream**: なし（将来候補: Claude Code 実行連携）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: sdd-review-ui（同一 SPA。レイアウトシェル・ルーティングの分担を design で明確化すること）

## Constraints

- `sdd-dashboard/client/` 配下、sdd-review-ui と同一 SPA 内の別画面群
- @xyflow/react ^12.11 使用（MIT。Pro 機能は使わない）
- 承認・手戻りは必ず確認ステップを挟む（誤操作で承認フラグが変わらないこと）
- ローカル完結（外部 CDN・外部 API に依存しない）
