---
id: 1
title: SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する
status: accepted
date: 2026-06-10
specs: [sdd-core, sdd-review-ui, sdd-workflow-ui]
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0001: SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する

## Context

cc-sdd の成果物（`.kiro/` 配下の spec / steering / ADR）を GUI でレビュー・操作するダッシュボードが必要になった。要件として (1) 承認・手戻り操作を GUI から行える、(2) CLI / AI エージェントによるファイル変更が即座に画面へ反映される、(3) 任意のリポジトリに向けて使える汎用ツールである、ことが求められた。

## Decision

Hono 4 + React 19 + Vite によるローカル Web アプリとし、**データベースを持たない**。サーバーは対象リポジトリの `.kiro/` をファイルシステムから直接読み、remark (mdast) で構造化パースして API で返す。chokidar v4 でファイルを監視し SSE でクライアントへプッシュする。書き込み（承認フラグ・手戻り・ADR 作成）もファイルを直接更新する。

理由: ファイルを唯一の真実とすることで、CLI・AI・GUI のどこから変更しても同期問題が原理的に発生しない。EVM Studio で実績のあるスタックの薄い構成で済む。

## Consequences

- 正: 同期機構・マイグレーション・キャッシュ無効化の設計が不要。`npx` 起動だけで任意リポジトリに使える
- 正: スペック生成中のリアルタイム閲覧（ホットリロード）が SSE だけで実現できる
- 負: markdown パースの頑健性が品質の生命線になる。対策としてトレーサビリティ表記法を steering で正規化し（trace-notation.md）、パース失敗時は生 markdown へフォールバックして情報欠落を防ぐ
- 負: chokidar v4 は glob 非対応（ignored フィルタで代替）、Hono SSE は onAbort 後始末と keepalive ping が必須

## Alternatives

- 静的サイト生成（CLI → JSON → 静的 SPA）— 書き込み操作ができず承認・手戻り要件と矛盾するため棄却
- VS Code 拡張 — Webview の UI 制約でトレーサビリティグラフ等のリッチな表現が困難、配布コストも高いため棄却
- SQLite 等へのインデックス保存 — ファイルとの二重管理になり同期問題を持ち込むため棄却
