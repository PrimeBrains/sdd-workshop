# Brief: sdd-core

## Problem

cc-sdd（Kiro スペック駆動開発）の成果物（spec.json / requirements.md / design.md / tasks.md / steering / ADR / validation レポート）は markdown と JSON のファイル群であり、GUI で表示・操作するための構造化データとして取得する手段がない。トレーサビリティ注記（`Requirements: 1.1-1.6` 等）も文字列のままで、Req ⇄ Design ⇄ Task の対応関係をプログラムから辿れない。レビューする人間は md を直接読んで番号を目視で突き合わせるしかない。

## Current State

- `.kiro/specs/*/` に spec.json + brief / requirements / design / tasks / research の md が存在
- design.md には「Requirements Traceability」テーブル（`Requirements: 1.1-1.6, 12.1-12.5` 形式）、tasks.md には `_Requirements: x.y_` インライン注記が**既に存在する**が、表記の正規化はこれから（直接実装 trace-notation が steering 化する）
- ADR（`.kiro/adr/`）と validation レポート（validation-*.md）は直接実装 adr-notation / validate-output で整備される前提
- GUI 向けの API・ファイル監視・書込操作は存在しない

## Desired Outcome

- 起動引数で指定した**任意リポジトリ**の `.kiro/` を読み、スペック・steering・スキル（SKILL.md / SKILL.ja.md）・ADR・validation レポートを構造化 JSON で返す HTTP API が動く
- requirements / design / tasks の番号体系を解析した**双方向トレーサビリティグラフ**（Req ⇄ Design ⇄ Task。未カバー要件・リンク切れ参照の検出付き）が取得できる。新表記は全列挙が正典だが、approved 済み旧 spec に残る範囲表記（`1.1-1.6`）は後方互換として連番展開する
- chokidar のファイル監視 + SSE により、CLI/AI がファイルを変更した瞬間にクライアントへプッシュ通知される
- 書込 API: spec.json の承認フラグ更新・フェーズ巻き戻し（手戻り）・ADR ファイル作成が、バリデーション付きで実行できる
- 構造化パースに失敗した部分は position 情報付きの生 markdown として返り、**情報が一切欠落しない**

## Approach

Hono 4（Node.js 22）サーバー。DB なし、ファイルシステムが唯一の真実。remark (mdast) で markdown を AST 化し、見出し階層 + position（行/オフセット）から Requirement / Design セクション / Task をスライスする。chokidar v4（glob 非対応のため ignored フィルタで除外指定）で監視し、Hono streamSSE（onAbort での後始末 + keepalive ping 必須）で配信する。

## Scope

- **In**: .kiro/ スキャンと構造化パース、トレーサビリティグラフ構築（ID 正規化・旧表記の後方互換範囲展開・逆引き・欠損検出）、ファイル監視 + SSE 配信、承認/手戻り/ADR 作成の書込 API、パース失敗時の生データフォールバック
- **Out**: UI 一切（sdd-review-ui / sdd-workflow-ui が担う）、AI 実行連携、認証、.kiro 以外のファイル管理、スペック内容の生成・再生成

## Boundary Candidates

- パーサー層（md / JSON → 構造化データ。純粋関数として単体テスト可能に）
- トレーサビリティグラフ構築（表記法解釈の唯一の実装箇所）
- ファイル監視 + SSE 配信
- 書込操作（spec.json / ADR）とそのバリデーション・監査ログ

## Out of Boundary

- 画面表示・レンダリング一切
- 表記法そのものの定義（steering の trace-notation が正典。core はそれに従って解釈するのみ）
- スキル翻訳の生成（skill-ja 直接実装が担う。core は SKILL.ja.md を読むだけ）

## Upstream / Downstream

- **Upstream**: trace-notation / adr-notation / validate-output（直接実装。パース対象の表記法の正典。**本スペックの要件定義前に完了していること**）
- **Downstream**: sdd-review-ui、sdd-workflow-ui（本 API の消費者）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: EVM Studio 系スペック（コード共有なし。スタック構成のみ踏襲）

## Constraints

- `sdd-dashboard/server/` 配下に配置。Node.js 22、TypeScript strict、`any` 禁止
- DB 不使用（SQLite も不可）。ファイルが唯一の真実
- 全依存は MIT ライセンス（Hono 4 / remark / chokidar v4）
- 書込は対象リポジトリの `.kiro/` 配下のみに限定（パストラバーサル防止必須）
- パーサーは未知の表記に遭遇してもエラーで落とさず、生 markdown フォールバックで返す
