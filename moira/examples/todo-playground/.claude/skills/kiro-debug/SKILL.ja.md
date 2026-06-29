---
name: kiro-debug
description: Investigate implementation failures using root-cause-first debugging. Use when an implementer is blocked, verification fails, or repeated remediation does not converge.
allowed-tools: Read, Bash, Grep, Glob, WebSearch, WebFetch
argument-hint: <failure-summary>
metadata:
  origin: "cc-sdd"
---

# kiro-debug

## 概要

このスキルは新規コンテキストでの根本原因調査のためのもの。ローカルの証拠、ランタイム／設定の調査、可能な場合は外部ドキュメントや issue のリサーチを組み合わせる。推測先行デバッグのためのパッチ生成器ではない。

## 使用タイミング

- 実装者が `BLOCKED` を報告した
- 修正後もレビュアーの却下が繰り返される
- 検証が予期せず失敗する
- タスクがランタイムやプラットフォームの現実と矛盾しているように見える
- 同じ失敗が複数回の修正試行を経ても残る

証拠収集の前に修正を憶測するためにこのスキルを使わない。

## 入力

以下を提供する:
- 正確な失敗症状またはブロッカーの記述
- エラーメッセージ、スタックトレース、失敗したコマンドの出力
- 現在の `git diff` または未コミットの失敗した変更の要約
- Task Brief: 何を作ろうとしていたか
- レビュー却下に起因する失敗の場合、レビュアーのフィードバック
- 関連するスペックファイルのパス（`requirements.md`、`design.md`）
- 関連する要件／設計のセクション番号
- 関連する `## Implementation Notes`
- 既知のランタイムまたは環境の制約

## 出力

以下を返す:
- `ROOT_CAUSE`
- `CATEGORY`
- `FIX_PLAN`
- `VERIFICATION`
- `NEXT_ACTION: RETRY_TASK | BLOCK_TASK | STOP_FOR_HUMAN`
- `CONFIDENCE: HIGH | MEDIUM | LOW`
- `NOTES`

`spec.json` で指定された言語を使用する。

## 手法

### 1. エラーを注意深く読む
以下を抽出する:
- 正確なエラーテキスト
- スタックトレースまたは失敗箇所
- 失敗を生んだコマンド
- 失敗が決定的か間欠的か

### 2. ローカルのランタイムとリポジトリ状態を調査する
リポジトリからローカルの証拠を調査する:
- `package.json`、`pyproject.toml`、`go.mod`、`Makefile`、`README*`
- ビルド設定
- `tsconfig` または同等の言語／ランタイム設定
- ランタイム固有の設定
- 依存関係のバージョンとスクリプト
- `git diff` の関連する変更ファイル

### 3. 可能なら Web を検索する
Web アクセスが可能な場合、以下を検索する:
- 正確なエラーメッセージ
- 技術と症状の組み合わせ
- 公式ドキュメント
- バージョン固有の issue トラッカーや移行ノート

優先順位:
- 公式ドキュメント
- 公式リポジトリ／issue
- バージョン固有のリファレンス
- ランタイム固有のドキュメント

### 4. 根本原因を分類する
1 つのカテゴリを使用する:
- `MISSING_DEPENDENCY`
- `RUNTIME_MISMATCH`
- `MODULE_FORMAT`
- `NATIVE_ABI`
- `CONFIG_GAP`
- `LOGIC_ERROR`
- `TASK_ORDERING_PROBLEM`
- `TASK_DECOMPOSITION_PROBLEM`
- `SPEC_CONFLICT`
- `EXTERNAL_DEPENDENCY`

### 5. 最小の安全な次アクションを決定する
このリポジトリ内で以下の方法により修正可能かを判断する:
- ファイルの編集
- 設定の調整
- 依存関係の追加または修正
- コードの再構成

問題が現在の承認済みタスク計画の内側でリポジトリ修正可能な場合、`NEXT_ACTION: RETRY_TASK` を使用する。

### 6. タスク計画がまだ有効かを判断する
現在の承認済みタスク計画が、書かれたとおり安全に実行可能かを判断する。

以下の場合は `NEXT_ACTION: STOP_FOR_HUMAN` を優先する:
- このタスクの前に存在すべき前提タスクが欠けている
- 現在のタスクが未完了の作業に対して誤った順序に置かれている
- 現在のタスク境界が誤っており、分割または統合すべき
- タスクが大きすぎる、または曖昧すぎて、現在の実装ループ内で安全に修正できない

現在のタスクは停止すべきだが、残りのキューは安全に続行できる場合に限り `NEXT_ACTION: BLOCK_TASK` を使用する。

`tasks.md` や承認済み計画の見直しの代わりに、力任せのコード修正を提案しない。

## 重要なルール

複数修正の散弾銃的な計画を提案しない。まず根本原因を特定し、その後に最小限の妥当な修正計画を作る。真の問題がスペックの衝突やアーキテクチャの問題である場合、そう率直に述べる。

## 停止／エスカレーション

ブロッカーが本当に以下を必要とする場合、`NEXT_ACTION: STOP_FOR_HUMAN` を使用する:
- 人間によるプロダクト／要件の判断
- 外部の認証情報またはアクセス不能なサービス
- ハードウェアまたは利用不能な外部システム
- スペック／プラットフォームの衝突によるリスコープ

問題が現在のタスク計画内のリポジトリ変更で修正可能なら、早まってエスカレーションしない。

## よくある正当化

| 正当化 | 現実 |
|---|---|
| 「おそらく簡単なパッチで済む」 | パッチ先行のデバッグは手戻りを生む。 |
| 「いくつか修正を試してみよう」 | 複数修正の当て推量は根本原因を覆い隠す。 |
| 「スペックが間違っているのだろう、合わせて直そう」 | スペックの衝突は明示的に表面化させなければならない。 |
| 「ドキュメント検索は任意だ」 | ランタイム／依存関係の問題では、ドキュメントやバージョン issue が根本原因への最短経路を含むことが多い。 |

## 出力フォーマット

```md
## Debug Report
- ROOT_CAUSE: <1-2 sentence root cause>
- CATEGORY: MISSING_DEPENDENCY | RUNTIME_MISMATCH | MODULE_FORMAT | NATIVE_ABI | CONFIG_GAP | LOGIC_ERROR | TASK_ORDERING_PROBLEM | TASK_DECOMPOSITION_PROBLEM | SPEC_CONFLICT | EXTERNAL_DEPENDENCY
- FIX_PLAN:
  1. <specific repo-fixable action>
  2. <specific repo-fixable action>
- VERIFICATION: <command(s) to confirm the fix>
- NEXT_ACTION: RETRY_TASK | BLOCK_TASK | STOP_FOR_HUMAN
- CONFIDENCE: HIGH | MEDIUM | LOW
- NOTES: <context the next implementer should know>
```
